# Local-First RAG MVP

## Problem Restatement

This project is a production-structured MVP for a local-first retrieval-augmented generation system. The main constraints are:

- Everything important should run on the user's machine.
- The user can stay fully local with Ollama or switch the generation layer to a cloud provider through LiteLLM.
- Documents must support PDF, Markdown, audio, and image ingestion.
- Retrieval must be versioned by embedding provider, embedding model, and embedding version.
- If the embedding setup changes, re-indexing is mandatory before chat continues.

Assumptions used in this MVP:

- This is a single-user local application, so settings and document metadata are stored locally on disk.
- Chroma runs as an embedded local persistence layer inside the backend service instead of a separate database container.
- Anthropic is supported as an LLM provider, but embeddings are limited to providers that LiteLLM can use for embedding generation in this MVP: Ollama and OpenAI.
- PDFs use text extraction through `pypdf`; image-only PDFs are not OCR-processed in this version.

## Design & Approach

### Chosen approach

The backend is a FastAPI application with explicit service layers:

- `ingestion/` handles file persistence, extraction, chunking, and indexing.
- `embeddings/` handles embedding generation through a provider abstraction.
- `vectorstore/` wraps Chroma persistence and retrieval.
- `llm/` handles chat orchestration and streaming generation.
- `ocr/` and `audio/` isolate Tesseract and faster-whisper usage.

The frontend is a Next.js App Router application with a minimal dashboard shell:

- `Onboarding` explains the local-first setup.
- `Documents` handles upload and re-indexing.
- `Chat` streams answers and shows citations.
- `Settings` manages providers and advanced retrieval controls.

### Why this approach

- It keeps provider switching explicit instead of hiding it in route handlers.
- It avoids hardcoding Ollama-only behavior while still keeping the local-first path simple.
- It stores retrieval state separately from UI state, which matters because re-indexing is a backend data integrity concern, not just a frontend warning.

### Alternative considered

An alternative was to collapse everything into a few route files with direct Chroma and LiteLLM calls. That would be faster to write, but it would make provider switching, re-index enforcement, and future background processing harder to reason about. For an MVP expected to grow, that trade-off is not worth it.

### Relevant fundamentals

- Retrieval depends on embedding-space compatibility. Query vectors and stored vectors must come from the same embedding setup.
- Chunking is a preprocessing concern, not an LLM concern. That is why chunk size and overlap live in settings and affect indexing only.
- Streaming is implemented with Server-Sent Events from FastAPI because the frontend only needs one-way token delivery from the backend.
- Chroma persistence is local disk state. Document metadata is stored separately in JSON so re-indexing can replay the original source files.

## Folder Structure

```text
rag-app/
  .env.example
  README.md
  Checklist.md
  backend/
    Dockerfile
    requirements.txt
    app/
      api/
        routes.py
      core/
        config.py
        constants.py
      providers/
        llm_provider.py
        embedding_provider.py
      schemas/
        chat.py
        documents.py
        settings.py
      services/
        audio/
          transcription_service.py
        embeddings/
          service.py
        ingestion/
          chunking.py
          extractors.py
          pipeline.py
        llm/
          chat_service.py
        ocr/
          tesseract_service.py
        vectorstore/
          chroma_store.py
        document_registry.py
        settings_service.py
      main.py
    data/
      uploads/
      processed/
  frontend/
    Dockerfile
    package.json
    tailwind.config.ts
    postcss.config.js
    tsconfig.json
    app/
      api/[...path]/route.ts
      chat/page.tsx
      documents/page.tsx
      onboarding/page.tsx
      settings/page.tsx
      globals.css
      layout.tsx
      page.tsx
    components/
      shell.tsx
      sidebar.tsx
      status-banner.tsx
    lib/
      api.ts
      types.ts
  docker/
    docker-compose.yml
```

## Implementation (Incremental)

### 1. Backend configuration and persistence

The backend uses `EnvironmentSettings` for runtime paths and environment defaults, and `PersistedSettings` for user-configurable application behavior.

Why it exists:

- Environment values belong to deployment and container setup.
- User settings belong to application state.
- Mixing those two makes re-index logic fragile.

Key files:

- `backend/app/core/config.py`
- `backend/app/schemas/settings.py`
- `backend/app/services/settings_service.py`
- `backend/app/services/document_registry.py`

### 2. Provider abstraction

The provider abstraction is intentionally narrow:

- `llm_provider.py` only knows how to stream chat completions.
- `embedding_provider.py` only knows how to produce embeddings.

Why it exists:

- LLM generation and embedding generation change at different times.
- Anthropic may be valid for generation but not for embeddings in this MVP.
- The rest of the code should not care whether the backend is using Ollama or a cloud provider.

Key files:

- `backend/app/providers/llm_provider.py`
- `backend/app/providers/embedding_provider.py`

### 3. Ingestion pipeline

The ingestion pipeline does four things in sequence:

1. Save the uploaded file locally.
2. Extract text based on file type.
3. Chunk the text using the current retrieval settings.
4. Generate embeddings and upsert them into Chroma.

Why it exists:

- Extraction is file-type specific.
- Chunking is retrieval specific.
- Embedding is provider specific.
- Upserting is vector-store specific.

Keeping them separated avoids one large upload handler with mixed responsibilities.

Key files:

- `backend/app/services/ingestion/extractors.py`
- `backend/app/services/ingestion/chunking.py`
- `backend/app/services/ingestion/pipeline.py`
- `backend/app/services/ocr/tesseract_service.py`
- `backend/app/services/audio/transcription_service.py`

### 4. Chat orchestration

The chat flow is:

1. Take the latest user message.
2. Embed the question with the current embedding provider.
3. Retrieve top-k chunks from Chroma.
4. Build a grounded system prompt with numbered source blocks.
5. Stream the answer back through SSE.
6. Send a final event with structured source citations.

Why it exists:

- Retrieval and answer generation are separate steps with different failure modes.
- The frontend needs streaming tokens and citations, not just a single blocking response.

Key files:

- `backend/app/services/vectorstore/chroma_store.py`
- `backend/app/services/llm/chat_service.py`
- `backend/app/api/routes.py`

### 5. Frontend UX

The frontend keeps the default mode non-technical:

- Onboarding explains the flow in plain language.
- Documents focuses on uploading and re-indexing.
- Chat focuses on answers and visible citations.
- Settings exposes only the LLM controls by default.

Developer Mode reveals:

- Embedding provider
- Embedding model
- Embedding version
- Chunk size
- Chunk overlap
- Top-k retrieval
- Optional base URL overrides

Key files:

- `frontend/app/onboarding/page.tsx`
- `frontend/app/documents/page.tsx`
- `frontend/app/chat/page.tsx`
- `frontend/app/settings/page.tsx`
- `frontend/lib/api.ts`

## API Surface

### `POST /upload`

Accepts multipart files under `files`.

Behavior:

- Rejects uploads if re-indexing is required.
- Saves each file locally.
- Extracts text.
- Chunks and embeds text.
- Stores vectors in Chroma.
- Stores document metadata in local JSON.

### `POST /chat`

Accepts:

```json
{
  "messages": [
    { "role": "user", "content": "What is in the document?" }
  ]
}
```

Response:

- SSE stream of `token` events
- final `sources` event
- final `done` event

### `GET /documents`

Returns the indexed document registry.

### `POST /reindex`

Behavior:

- Clears the Chroma collection
- Replays all stored source files
- Rebuilds vectors using the current embedding settings
- Clears the `reindex_required` flag

### `GET /settings`

Returns the current local configuration plus:

- supported providers
- current embedding signature
- indexed document count
- re-index status

### `POST /settings`

Updates settings. If the embedding signature changes and documents already exist, the backend marks the index as stale and requires re-indexing.

## Provider Switching Logic

This is the most important integrity rule in the app.

Every indexed document stores:

- `embedding_provider`
- `embedding_model`
- `embedding_version`

The global settings store also has a current embedding signature. When the signature changes:

- the backend sets `reindex_required = true`
- upload and chat routes return `409`
- the frontend shows a warning banner and a re-index action

This is necessary because vectors from different embedding models are not comparable in a meaningful way.

## Docker Setup

### Services

- `backend`: FastAPI service with Chroma persistence, Tesseract, and faster-whisper support
- `frontend`: Next.js App Router app
- `ollama`: local model runtime for chat and embeddings

### Start with Docker Compose

From `rag-app/docker`:

```bash
cp ../.env.example ../.env
docker compose up --build
```

Then open:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:8000/health](http://localhost:8000/health)
- Ollama: [http://localhost:11434](http://localhost:11434)

### Pull local models in Ollama

After Ollama is up, pull at least:

```bash
docker exec -it rag-ollama ollama pull llama3.1:8b
docker exec -it rag-ollama ollama pull nomic-embed-text
```

## Local Development Without Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

System dependencies still required:

- `tesseract`
- `ffmpeg`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Example Environment File

```env
APP_ENV=development
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
OLLAMA_BASE_URL=http://ollama:11434
DEFAULT_WHISPER_MODEL=small
```

Why `NEXT_PUBLIC_API_URL` points to `/api`:

- In Docker, the frontend cannot call `localhost:8000` from the browser container directly in a portable way.
- The Next.js catch-all route proxies browser requests to the backend service.

If you run the frontend outside Docker, point `NEXT_PUBLIC_API_URL` directly at `http://localhost:8000`.

## Edge Cases & Failure Modes

### Unsupported file types

The backend rejects unsupported extensions before processing.

### Empty extraction

If OCR, PDF parsing, or transcription yields no usable text, the backend raises a validation error instead of creating an empty index entry.

### Embedding mismatch

This is intentionally blocked. Once the embedding setup changes, the app requires a full re-index before more retrieval calls can happen.

### Missing API keys

If the selected provider requires an API key and none is configured, the provider abstraction raises a clear error.

### Scanned PDFs

This MVP does not OCR scanned PDFs. The ingestion path only OCRs standalone image files. If scanned PDFs matter, add a PDF-to-image OCR fallback next.

### Long transcription and large uploads

Everything runs inline in the request path in this MVP. That is acceptable for a first version, but larger installations should move ingestion and re-indexing into background jobs.

## Summary

This scaffold gives you a local-first RAG MVP with:

- FastAPI backend
- Next.js frontend
- Chroma local persistence
- LiteLLM provider abstraction
- Ollama local generation and embeddings
- OCR and audio transcription
- SSE chat streaming with citations
- explicit embedding versioning and forced re-indexing

It stays minimal on purpose, but the boundaries are already set up so you can add authentication, jobs, better document lifecycle management, and more providers without rewriting the core flow.

## Optional Suggestion

If you plan to ingest large audio files or many PDFs, add a background job queue next. The concrete benefit is that uploads and re-indexing stop blocking HTTP requests, which makes the UI more reliable under heavier local workloads.

## Self-Audit

- The provider-switching rule is implemented consistently in the backend and reflected in the frontend.
- The chat flow only works against the current embedding signature.
- The code stays modular and avoids hardcoding a single provider path.
- The main uncertainty is operational rather than structural: exact model availability depends on what the local Ollama instance has already pulled.

After you review this scaffold, explain back why the app blocks chat after an embedding change instead of silently continuing. That will tell me whether the retrieval integrity model is clear.
