# 04. AI Concepts Explained

AI is full of heavy technical jargon. As an engineer in this codebase, you only truly need to master four core concepts. We are going to explain them with plain English and simple analogies.

---

## 1. Large Language Models (LLM)

**What it means:** An LLM is essentially an extremely powerful auto-complete engine that has read the entire internet. It takes the text you type, understands the patterns of human grammar and facts, and predicts what word should naturally come next.

**Analogy:** Imagine a college professor who has read millions of books. If you ask the professor a question, they will easily explain the concept back to you. However, you are talking to them right now; they aren't looking at books in real-time. They are generating the answer from memory.

**In this project:** We use Ollama running `llama3.1:8b` as our primary LLM. The `ChatService` talks to the LLM. It generates the final text that the user reads on the screen.

---

## 2. Embeddings

**What it means:** An embedding is the process of translating Human Language into Mathematics. Words that have similar *meanings* are assigned mathematical numbers that are close together.

**Analogy:** Imagine a giant geographic map of concepts. 
- You place the word "King" in the middle. 
- You place "Queen" right next to it, because they describe similar things.
- You place "Apple" way off in the corner.
- You place "Banana" right next to "Apple".
If I ask you to search for words similar to "King", you don't look at the letters K-I-N-G. You just look at your map, and grab whatever words are standing physically closest to "King".

**In this project:** We use an embedding model (like `nomic-embed-text`) inside `app/services/embeddings/service.py`. When we embed the sentence *"The dog barked,"* the model returns an array of e.g. 768 floating point numbers (like `[0.12, -0.45, 0.98...]`). This array is the sentence's literal GPS coordinate on the conceptual map.

---

## 3. RAG (Retrieval-Augmented Generation)

**What it means:** The biggest weakness of an LLM is that it hallucinates (makes things up), and it doesn't know private information. It hasn't read the internet since last year, and it certainly hasn't read your company's private HR policy spreadsheet. RAG fixes this. It is a formula: Search for private facts + Inject facts into the AI's prompt = Factual Answers.

**Analogy:** The Open Book Test. If you ask a student to take a history test from memory, they might guess the wrong date (Hallucination). But, if you hand them the exact textbook open to Chapter 4 (Retrieval) and say, "Write your essay using ONLY this page" (Augmented Generation), the student will pass with 100% accuracy.

**In this project:** This *entire* application is a RAG pipeline! `RetrievalService` handles finding the open textbook page. `ChatService._build_messages()` handles pasting that page underneath the user's question so the LLM doesn't guess.

---

## 4. Chunking

**What it means:** Slicing a massive document into smaller, bite-sized paragraphs before you run them through the Embedding process.

**Analogy:** Eating a steak. You don't shove an entire 16oz steak into your mouth at once. You use a knife to cut it into cubes. Furthermore, when you chunk text, we use **Overlap**. Imagine reading a comic strip. If someone cuts the comic perfectly down the middle, the joke makes no sense. An overlap ensures the panels overlap slightly so the context connects correctly.

**In this project:** Look at `split_text_with_meta` in `app/services/ingestion/chunking.py`. If we upload a 300-page book, we chunk it into paragraphs of 500 characters. Why?
1. The AI model physically cannot process 300 pages at the same time.
2. If we embed a giant page into one set of numbers, the "GPS coordinate" gets washed out and confusing. By chunking into paragraphs, every single paragraph gets its own highly accurate GPS coordinate, making search perfect.
