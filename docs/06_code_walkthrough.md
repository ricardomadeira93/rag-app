# 06. Codebestand Walkthrough

When you get lost, come to this document. These are the central files that run the application.

### `app/api/routes.py`
- **What it does:** This is the entry point. The Frontend is only allowed to talk to this file. It holds the "Endpoints" (like URLs).
- **How it connects:** It receives requests and passes them to the internal Services.
- **Example Snippet:**
  ```python
  @router.post("/chat")
  async def chat(request: Request, payload: ChatRequest):
      # Grab our pre-built Chat Service from the application memory
      container = request.app.state.container
      
      # Tell the Chat Service to start streaming words!
      async for event in container.chat.stream_response(payload):
          yield event
  ```

### `app/services/ingestion/pipeline.py`
- **What it does:** The boss of the file upload process. 
- **How it connects:** It gets invoked by `routes.py`. It then calls `TextExtractionService` to read the file, `EnrichmentService` to summarize the file, chunks the text, and calls `ChromaVectorStore` to save the math.
- **Example Snippet:**
  ```python
  async def _index_saved_file(self, source_path):
      # Step 1: Translate the file to text
      extracted = self.extractor.extract_text(source_path)
      
      # Step 2: Slice it into paragraphs
      chunk_metas = split_text_with_meta(extracted.text, chunk_size=500)
      
      # Step 3: Turn text into math and save it to the DB!
      embeddings = await self.embeddings.embed_texts(chunks)
      self.vector_store.upsert_document(document, chunks, embeddings)
  ```

### `app/services/llm/chat_service.py`
- **What it does:** Creates the prompt for the AI.
- **How it connects:** It is called by `routes.py`. It calls `RetrievalService` to fetch evidence, then talks to Ollama to generate an answer.
- **Example Snippet:**
  ```python
  def _build_messages(self, messages, context):
      # We create a hidden instruction for the AI, embedding the evidence
      system_prompt = ChatMessage(
          role="system",
          content=f"You are an assistant. Answer using ONLY this context: \n\n {context}"
      )
      return [system_prompt, *messages]
  ```

### `app/services/retrieval_service.py`
- **What it does:** Searches the Vector Database.
- **How it connects:** Called by `chat_service.py`. Connects to `ChromaVectorStore`.
- **Example Snippet:**
  ```python
  async def retrieve(self, query):
      # Convert the user's string question into a list of numbers
      query_embedding = await self.embedding_service.embed_query(query)
      
      # Ask the database to find the 10 closest matches!
      candidates = self.vector_store.query(query_embedding=query_embedding, top_k=10)
      return candidates
  ```
