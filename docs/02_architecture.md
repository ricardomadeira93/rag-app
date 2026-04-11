# 02. System Architecture

To understand how the app works, we need to know the basic building blocks. The system uses a standard client-server model, meaning there is a "Frontend" (the website the user clicks on) and a "Backend" (our Python code doing the heavy lifting).

## The Restaurant Kitchen Analogy 🍳

If an app is a restaurant:
- **The Frontend (Next.js):** This is the **Waiter** and the **Menu**. Customers interact with it. The Waiter takes the order ("Upload this file" or "Answer this chat question") and runs it to the back.
- **The Backend (FastAPI):** This is the **Head Chef**. The Head Chef receives the order and coordinates the entire kitchen to get the job done.
- **AI Services (Ollama, Whisper, Tesseract):** These are the **Specialized Sous-Chefs**. One knows how to perfectly dice onions (extract text from images). Another knows how to perfectly grill a steak (transcribe audio to text). The Head Chef hands them raw ingredients and waits for the finished product.
- **Storage Spaces:**
  - **SQLite (`conversations.db`):** The **Receipt String** where the restaurant keeps a running log of everything ordered (Chat History).
  - **ChromaDB:** A highly organized **Filing Cabinet** where chunks of text are stored based on their meaning.

## The Diagram

Here is what the architecture looks like from a bird's-eye view:

```
[ User's Browser ]
       |
       v
[ Frontend (Next.js & React) ]
       |
       | (Sends HTTP requests & receives streaming SSE data)
       v
[ Backend (FastAPI Python App) ]
       |
       |--- Orchestrates actions ---|
       |                            |
[ Storage Systems ]          [ AI & Helpers ]
  • SQLite (Chat DB)           • Ollama (LLM & Embeddings)
  • ChromaDB (Vectors)         • Whisper (Audio to Text)
  • Local Folder (Files)       • Tesseract (Optical Character Recognition)
```

## Explaining the Layers

1. **Frontend (Next.js):** The user interface. We provide an advanced Settings Dashboard leveraging HTML5 `<datalist>` dropdowns mapped to API recommendations for dynamically tuning the LLM Models. The UI receives streaming Server-Sent Events (SSE) including explicit Source Citations which it renders as clickable document Reference Cards.
2. **Backend (FastAPI):** Python is the language pulling the strings. FastAPI is a lightning-fast framework. Notably, it is **Asynchronous**. If the Head Chef asks a Sous-Chef to boil potatoes for 30 minutes, the Head Chef doesn't stand there watching the water boil! The Head Chef immediately turns around to accept a new Waiter's order. This allows our backend to handle many users at once.
3. **AI Services:** 
   - **Ollama:** A tool running on your machine that acts as the "Brain". It runs Large Language Models (like `llama3.1`) to answer chat questions.
   - **Tesseract & Whisper:** Tools to handle edge cases. LLMs read text. They don't read pictures, and they don't have ears. Tesseract is the "eyes", Whisper is the "ears".
4. **Storage:** We use local files heavily in this MVP.
   - **ChromaDB:** A special database designed purely for AI. Instead of organizing things alphabetically like a normal database, it organizes things by *meaning* (we call this Semantic Search).
   - **SQLite:** A simple file-based relational database to track conversations.
