# 09. Advanced RAG Concepts & Roadmap

As you scale this application from a prototype into an enterprise-grade AI system, you will encounter advanced Retrieval-Augmented Generation (RAG) terminology. 

This document defines the state-of-the-art strategies, explains why they are needed, and explicitly compares them to **what our app is currently doing.**

---

## 1. Contextual Retrieval (The Anthropic Method)
**The Concept:** When a document is sliced into chunks, individual paragraphs lose the context of the title and the surrounding document. Contextual Retrieval uses an AI to read the whole document, and then write a "Context Header" (e.g., `[Document: HR Policy, Topic: PTO]`) which is glued to the beginning of *every single chunk* before math embeddings are calculated.
**What we currently use:** 
*We do NOT use this yet.* Our app chunks text purely based on characters (e.g., every 500 letters ending in a period). If a chunk says *"He fired the employee,"* the embedding has no idea who "He" is unless the user's search query happens to match perfectly.

## 2. Parent-Child / Multi-Vector Retrieval
**The Concept:** Searching for small sentences is mathematically highly accurate, but feeding an AI small sentences removes nuance. In Parent-Child retrieval, a document is sliced into massive "Parent" chunks (3,000 characters), which are sliced into tiny "Child" sentences (200 characters). Only the Children are embedded into the Database. When a match is found on a Child, the Database returns the entire Parent block to the Chat AI to provide massive surrounding context.
**What we currently use:** 
*We do NOT use this yet.* We use an "Overlap" chunking strategy. We chunk at around 1,000 characters and overlap by 200 characters. We retrieve and feed that exact same 1,000-character chunk to the LLM. 

## 3. Semantic Routing (Automatic Mode) - ✨ NOW IMPLEMENTED
**The Concept:** Different user questions require different levels of intelligence. A request to "summarize this paragraph" requires very little compute, whereas "cross-reference the financial penalties in these 3 contracts" requires a genius-level LLM. Semantic Routing uses an ultra-fast local LLM to intercept the query, determine its complexity in 100 milliseconds, and dynamically route the query to either a small/cheap model or a huge/expensive model on autopilot.
**What we currently use:**
*We use this!* We built a `_route_intent` engine in the `ChatService`. 

**Frontend Integration:**
In the Frontend Settings dashboard, an "Orchestration & Routing" panel explicitly exposes this to the user via the `semantic_routing_enabled` toggle and an auto-completing `enrichment_model` Datalist dropdown. If the router economizes a query, the backend fires an Server-Sent Event (SSE) to the frontend alerting the user that the background enrichment model was silently used.

## 4. Agentic Query Decomposition
**The Concept:** Vector embeddings look for "meaning" (Dense Search). BM25/Elasticsearch looks for exact character matches (Lexical Search). Hybrid Search runs both databases at the same time and uses RRF math to combine the score of the meaning search with the score of the exact keyword search.
**What we currently use:**
*We use 100% Dense Vector Search (ChromaDB).* If a user searches for an exact serial number like "AX-491", our system might struggle because it is looking for the "semantic meaning" of those alphanumeric characters, which doesn't exist.

## 5. Audio Speaker Diarization
**The Concept:** Using neural networks to analyze the pitch and tone of an audio waveform to identify *who* is speaking, turning a single block of text into a script (`Speaker 1: Hi. Speaker 2: Hello.`).
**What we currently use:**
*We use basic Whisper transcription.* Our app listens to an MP3 and generates a continuous wall of text without separating or identifying individual human voices.
