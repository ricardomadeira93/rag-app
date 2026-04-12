# 09. Advanced RAG Concepts & Roadmap

As you scale this application from a prototype into an enterprise-grade AI system, you will encounter advanced Retrieval-Augmented Generation (RAG) terminology. 

This document defines the state-of-the-art strategies, explains why they are needed, and explicitly compares them to **what our app is currently doing.**

---

## 1. Contextual Retrieval (The Anthropic Method) - ✨ NOW IMPLEMENTED
**The Concept:** When a document is sliced into chunks, individual paragraphs lose the context of the title and the surrounding document. Contextual Retrieval uses an AI to read the whole document, and then write a "Context Header" (e.g., `[Document: HR Policy, Topic: PTO]`) which is glued to the beginning of *every single chunk* before math embeddings are calculated.
**What we currently use:** 
*We use this!* We heavily leverage the Anthropic Contextual Retrieval methodology during document ingestion. We natively prepend both the explicitly queried `Filename` and the AI-generated `Context` summary headers explicitly into the chunk strings. To circumvent heavy latency, these LLM enrichment calls are fanned out in parallel via `asyncio.gather` while respecting strict API limits via Semaphores.

## 2. Parent-Child / Multi-Vector Retrieval
**The Concept:** Searching for small sentences is mathematically highly accurate, but feeding an AI small sentences removes nuance. In Parent-Child retrieval, a document is sliced into massive "Parent" chunks (3,000 characters), which are sliced into tiny "Child" sentences (200 characters). Only the Children are embedded into the Database. When a match is found on a Child, the Database returns the entire Parent block to the Chat AI to provide massive surrounding context.
**What we currently use:** 
*We do NOT use this yet.* We use an "Overlap" chunking strategy. We chunk at around 1,000 characters and overlap by 200 characters. We retrieve and feed that exact same 1,000-character chunk to the LLM. 

## 3. Semantic Routing (Automatic Mode) - ✨ NOW IMPLEMENTED
**The Concept:** Different user questions require different levels of intelligence. A request to "summarize this paragraph" requires very little compute, whereas "cross-reference the financial penalties in these 3 contracts" requires a genius-level LLM.
**What we currently use:**
*We use RegEx Pattern Matching!* We replaced the latency-heavy LLM JSON intent router with a lightning-fast Python RegEx scanner array (`WORKSPACE_PATTERNS`, `AMBIGUOUS_PATTERNS`). This categorizes questions into distinct `answer_types` (factual, procedural, workspace, ambiguous) in zero milliseconds, and dynamically yields those types directly into the Server-Sent Event stream to render Answer Type Badges on the frontend UI.

**Disambiguation Triggers:**
If the Pattern Matcher labels a query as `ambiguous` (e.g. *"tell me more about this"*), the backend forcibly scoops the last 3 turns of the conversation history, extracts the preceding nouns, and invisible-prepends a `Previous context:` String onto the search query to rescue the retrieval algorithms from Semantic Drift without consuming massive token overhead context windows.

## 4. Pre-Retrieval Query Optimization (Typo Correction) - ✨ NOW IMPLEMENTED
**The Concept:** Dense embedding models are extremely brittle and rely on generic sub-word tokens. The embedding vector for `pyhton` is drastically mathematically divergent from the embedding vector for `python`. Queries with typos or slang often fail entirely. Query Optimization runs a fast AI-check on incoming questions to identify semantic intent and repair spelling arrays before ever touching mathematical arrays. 
**What we currently use:**
*We use this!* Inside the `ChatService`, if semantic routing is enabled, we immediately pass the user's raw input through the light `enrichment_model` exclusively to rewrite formatting and typographical errors, silently rescuing mathematical precision completely out of view of the user.

## 5. Hybrid Search (Dense + Lexical) - ✨ NOW IMPLEMENTED
**The Concept:** Vector embeddings look for "meaning" (Dense Search). BM25/Elasticsearch looks for exact character matches (Lexical Search). Hybrid Search runs both databases at the same time and uses RRF math to combine the score of the meaning search with the score of the exact keyword search.
**What we currently use:**
*We use this!* We integrated a localized `rank_bm25` lexer running simultaneously alongside our ChromaDB sparse vector embeddings. Retrieval hits both engines in parallel and mathematically unions the list together using the standard Reciprocal Rank Fusion (RRF) algorithm to ensure you never miss exact filenames or serial numbers while retaining semantic capability.

## 6. Audio Speaker Diarization
**The Concept:** Using neural networks to analyze the pitch and tone of an audio waveform to identify *who* is speaking, turning a single block of text into a script (`Speaker 1: Hi. Speaker 2: Hello.`).
**What we currently use:**
*We use basic Whisper transcription.* Our app listens to an MP3 and generates a continuous wall of text without separating or identifying individual human voices.
