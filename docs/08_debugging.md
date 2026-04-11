# 08. Debugging Guide

Things will break. That is part of software engineering. Here is how you tackle bugs in this specific AI codebase like a senior engineer.

---

## What Usually Goes Wrong

Because this app connects multiple independent AI models and databases, the errors usually happen at the boundaries where data crosses over.

### 1. "The Chat AI is returning empty answers or saying it doesn't know."

**The Logic:** Does the LLM not know the answer, or did we literally fail to hand it the evidence?
**How to Debug:**
1. Open up FastAPI's console.
2. Check `app/api/routes.py` inside the `chat()` function. Put a `print(final_sources)` right there.
3. **If `final_sources` is empty:** The failure is in retrieval! ChromaDB didn't find the math vectors. Did the document actually finish indexing? Did the UI pass an overly strict filter (like `days=1`)?
4. **If `final_sources` has data:** The retrieval worked! The LLM is failing to read it. The prompt is flawed or the model is hallucinating.

### 2. "Audio transcription returns empty text or nothing happens."

**The Logic:** The audio extraction silently failed or hung in the background. FastAPI `asyncio.create_task` hides errors if you aren't careful.
**How to Debug:**
1. Navigate to `app/services/ingestion/extractors.py`.
2. Locate `text = self.audio_service.transcribe(file_path)` inside the `AudioTranscriptionService`.
3. Add a log: `print("Calling Whisper on file:", file_path)`.
4. If it never fires, the `file_path.suffix` whitelist in constants might be blocking `.wav` files. 
5. Also, ensure the machine actually has the memory to run Whisper. It can silently crash if your RAM maxes out.

### 3. "The document uploads, but instantly fails with status 'failed'."

**The Logic:** Python encountered an exception in the middle of the dark background pipeline, caught it, and updated `DocumentService`.
**How to Debug:**
1. Navigate to `app/services/ingestion/pipeline.py`.
2. Find `_index_saved_file_task()`. See the `except Exception as exc:` block?
3. Add a `print("PIPELINE CRASHED:", str(exc))` or use the `logging` module to print the traceback.
4. Usually, this means `EnrichmentService` failed because Ollama timed out, or ChromaDB was locked.

---

## The Golden Rule of AI Debugging

When regular code breaks, you get a Python Stack Trace with a red error on line 42.

When AI code breaks, **you don't get an error**. The AI just confidently gives you incredibly wrong/garbled text.

**Always inspect the Prompt.** If you are ever confused as to why the AI generated a weird output, you must intercept the exact string we sent to it. Inside `app/services/llm/chat_service.py` at `_build_messages()`, print out the final stitched system prompt. 99% of the time, you will look at the Prompt and realize, *"Oh, we accidentally pasted 14 paragraphs about bananas into the evidence box when the user asked about apples."*
