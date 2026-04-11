# 07. The "Why" File

When learning a codebase, knowing *why* a decision was made is more important than knowing *what* the decision was. Here are the core architectural questions answered.

---

### Why Embeddings instead of Keyword Search?
If you've built web apps before, you probably used a simple SQL search like `SELECT * WHERE text LIKE '%dog%'`. 

**Why we don't do that:**
If a user searches for *"canine companions"*, a keyword search will look literally for "canine" and find zero results. But the text might contain a thousand references to "dogs" and "puppies".
Embeddings measure *meaning*. "Canine" and "Dog" are mathematically assigned the exact same neighborhood on the semantic map. By using Embeddings, the AI truly "understands" what you are looking for regardless of the vocabulary you use.

**Trade-off:** Calculating and storing millions of mathematical coordinates takes heavily specialized Databases (like Chroma DB or pgvector) and uses a significant amount of RAM.

---

### Why Chunking exists?
If you upload the entire Harry Potter book series as a single text file, why can't we just embed the entire book into one single coordinate?

**Analogy:** Averaging colors.
Imagine you have a jar of black sand, and a jar of white sand. If you look at them individually, you clearly see black and white. If you mix the two jars together into one jar, you just see grey.
If you embed a 300 page book into a single math number, the "meaning" of every sentence is averaged together. The nuances vanish into a grey paste.
By "chunking" the book into 500-character paragraphs, every single paragraph gets its own perfect mathematical coordinate.

**Trade-off:** A 300 page book turns into 1,500 separate database rows instead of just 1.

---

### Why do we overlap chunks?
In `chunking.py`, we overlap the end of Chunk A with the beginning of Chunk B.

**Analogy:** Listening to half a joke.
If Chunk A ends with *"Why did the chicken cross the road?"* and Chunk B begins with *"To get to the other side!"*, an AI reading Chunk B completely alone won't understand what is crossing to the other side.
Overlapping ensures Chunk B begins with *"Why did the chicken cross the road? To get to the other side!"*

---

### Why so many small "Services"?
Why isn't this entire app just one giant `app.py` file with 5,000 lines of code?

**Analogy:** Lego Blocks vs a Solid Statue.
If you mold a solid plastic statue of a spaceship, and you decide you want to change its wings, you have to melt the entire statue down and start over.
If you build it with Lego blocks, you just snap the wings off and snap new wings on.
By separating `SettingsService`, `DocumentService`, and `RetrievalService`, we can completely delete `ChromaVectorStore` and replace it with PostgreSQL later without breaking a single line of code inside the `ChatService`.
