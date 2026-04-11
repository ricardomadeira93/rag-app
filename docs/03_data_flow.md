# 03. The Data Flow

This is where the magic happens. We are going to trace the exact journey data takes through our application. For our examples, we are going to use `app/services/ingestion/pipeline.py` and `app/api/routes.py`.

---

## 1. The Upload Flow

**Example:** A user uploads a recorded memo (`ideas.mp3`).

**Analogy:** Imagine a factory. A truck dumps a massive pile of raw iron ore (the `.mp3` file) at the loading dock. Before it can become a car, it is physically melted into liquid steel, then poured into a completely standardized mold so the rest of the factory machines know how to work with it.

**Step-by-step:**
1. **The Request:** The user drops the file in the browser. It hits `upload_documents()` inside `app/api/routes.py`.
2. **Saving the Ore:** The backend saves the raw `.mp3` file in exactly the form it arrived into `data/uploads/`.
3. **Extraction (Melting the Ore):** If you look at `TextExtractionService.extract_text()`, it uses `if/else` logic. Because it's an MP3, it sends it to the `AudioTranscriptionService` (Whisper). Whisper plays the audio, listens to the words, and returns a massive string: *"Hi, so my idea for the company is..."*
4. **Enrichment (The Output Mold):** Before we do anything else, the `EnrichmentService` runs. We ask the AI to quickly read the whole text and pull out global metadata: "What is this?" (An ideas memo), "Who is speaking?" ("John").

---

## 2. The Embedding Flow

Now that we have extracted the English text from the MP3, we have to make it "searchable" by the AI.

**Example:** Slicing the transcript of `ideas.mp3` and storing it.

**Analogy:** Think of reading an encyclopedia. If I ask you, "What do turtles eat?", you don't read the encyclopedia from page 1 to page 900. You go to the index, find the exact paragraph about Turtle Dietary Habits, and only read that. The embedding flow is the process of generating that index.

**Step-by-step:**
1. **Chunking (`split_text_with_meta`):** The long text transcript is chopped into small paragraphs (e.g., 500 characters each). We do this because an AI model literally cannot hold a 900-page book in its brain at the same time. 
2. **Embedding (`EmbeddingService.embed_texts`):** Each chopped paragraph is sent to Ollama. Ollama converts the paragraph's *meaning* into numbers (Embeddings). (We will learn exactly what an embedding is in the next file).
3. **Storing (`ChromaVectorStore.upsert_document`):** The text paragraphs, and their new number equivalents, are saved into ChromaDB. 

---

## 3. The Chat Flow

The user's file is saved. Now, the user wants to talk to it.

**Example:** The user asks the chat, *"What were John's ideas for the company?"*

**Analogy:** It is an open-book test. A student (the AI) sits at a desk. You ask a question. The student is forbidden from guessing off the top of their head. Instead, they must run to the library index (Chroma DB), grab the one physical page dealing with the topic (Retrieval), bring the page back to their desk, read it, and then write down the answer for you.

**Step-by-step:**
1. **The Request:** The chat question hits `chat()` inside `app/api/routes.py`.
2. **Retrieval (`RetrievalService.retrieve`):** 
   - The backend converts the user's question into math numbers (embedding it).
   - It searches ChromaDB to find the document chunks that have math numbers nearest to the question.
   - It retrieves the top 5 chunks that best match the question.
3. **Prompt Building (`ChatService._build_messages`):** We secretly take the retrieved chunks and paste them together into a giant hidden prompt for the AI. It looks like:
   *"You are an assistant. ONLY use this context: [1] Hi, so my idea for the company is to sell more hats... Answer the user's question: What were John's ideas?"*
4. **Streaming the Answer:** The prompt is sent to the LLM (Large Language Model). As the LLM predicts words representing the answer, the backend uses `yield sse_event(...)` to stream the answer back to the frontend in real-time, creating a typewriter effect!
