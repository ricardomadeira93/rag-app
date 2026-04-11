# Checklist

## Done

- Created the required `rag-app` folder structure with `backend`, `frontend`, and `docker`.
- Implemented FastAPI routes for upload, chat, documents, settings, and re-indexing.
- Added service layers for ingestion, embeddings, vector storage, LLM access, OCR, and audio transcription.
- Added provider abstractions in `llm_provider.py` and `embedding_provider.py`.
- Implemented local Chroma persistence and document registry persistence in JSON.
- Added embedding signature tracking with provider, model, and version.
- Enforced re-indexing when the embedding setup changes.
- Implemented PDF, markdown, image OCR, and audio transcription ingestion.
- Added SSE-based streaming chat responses with source citations.
- Built Next.js App Router pages for onboarding, chat, documents, and settings.
- Added Developer Mode with advanced retrieval controls.
- Added Dockerfiles for backend and frontend plus a `docker-compose.yml`.
- Added `.env.example` and a detailed `README.md`.

## Pending / Next Useful Steps

- Add authentication if this moves beyond a single-user local desktop setup.
- Add OCR fallback for scanned PDFs, not just standalone image files.
- Add delete and refresh actions for individual documents.
- Add automated tests for ingestion, settings transitions, and chat streaming.
- Add background job handling for large uploads and long re-index runs.
- Add provider-specific validation for supported embedding models before save.
