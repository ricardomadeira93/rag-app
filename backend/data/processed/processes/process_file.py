from services.embedding_service import store_documents

def process_file(content: bytes):
    text = content.decode("utf-8")

    # chunk
    chunks = [text[i:i+500] for i in range(0, len(text), 500)]

    # TEMP embeddings
    embeddings = [[0.0]*768 for _ in chunks]

    store_documents(chunks, embeddings)