import chromadb
from chromadb.config import Settings

client = chromadb.Client(
    Settings(
        persist_directory="/app/data/chroma",
        anonymized_telemetry=False
    )
)

collection = client.get_or_create_collection(
    name="documents"
)