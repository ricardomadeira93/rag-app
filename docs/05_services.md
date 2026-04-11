# 05. The Core Services Explained

To make the app easy to maintain, we break logic down into "Services". Here is how the key workers in our app operate.

---

## 1. TextExtractionService

**What it does:** It acts as the "Bouncer" at the door of the database. When a physical file arrives, it looks at the file extension and decides which specialized tool is needed to rip the English characters out of it.

**Example Input/Output:**
- **Input:** `/uploads/meeting_notes.pdf`
- **Output:** `ExtractionResult(text="These are the meeting notes...", file_type="pdf")`

**Analogy:** A language translator. You hand them German, French, or Japanese documents, and they use different dictionaries to return a single, unified English document to you.

---

## 2. AudioTranscriptionService

**What it does:** Uses a speech-to-text AI model called **Whisper** to listen to `.mp3` or `.wav` files and convert the spoken words into text.

**Example Input/Output:**
- **Input:** `/uploads/CEO_briefing.mp3`
- **Output:** `"Alright team, let's look at the numbers for Q1..."`

**Analogy:** A courtroom stenographer. They sit in the corner, listen to the trial, and relentlessly type every single word spoken into a massive transcript.

---

## 3. TesseractOCRService

**What it does:** OCR stands for "Optical Character Recognition". If you scan a receipt, the computer just sees millions of colored pixels. It doesn't see "letters". Tesseract scans the shapes of the pixels and calculates, "That shape looks like an 'E', and that looks like an 'A'."

**Example Input/Output:**
- **Input:** `/uploads/scanned_contract_page1.png`
- **Output:** `"AGREEMENT between ACME Corp and..."`

**Analogy:** A physical human eyeball. When you look at an image with a sign in the background, you have to actively trace the shapes of the letters to read what it says.

---

## 4. ChatService

**What it does:** Handles the logic when a user types a question. It is responsible for grabbing the evidence (retrieval) and whispering it into the ear of the LLM so it answers correctly.

**Example Input/Output:**
- **Input:** User asks: *"Who is the CEO?"*. Evidence retrieved: `"[1] John Smith was named CEO in 2021."`
- **Output:** (To the user) *"According to the document, John Smith became the CEO in 2021."*

**Analogy:** A lawyer in court. The user is the Judge asking a question. The `ChatService` is the lawyer who frantically grabs Exhibit A (the retrieved text) and reads it out loud for the Judge.
