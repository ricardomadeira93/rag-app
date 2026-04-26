import os

from app.core.config import EnvironmentSettings
from app.services.vectorstore.base import VectorStore
from app.services.vectorstore.chroma_store import ChromaVectorStore
from app.services.vectorstore.pinecone_store import PineconeVectorStore


def get_vector_store(env: EnvironmentSettings) -> VectorStore:
    """
    Returns Cloud Pinecone vector store if the API key exists,
    otherwise falls back to local Chroma setup.
    """
    pinecone_api_key = os.getenv("PINECONE_API_KEY")
    if pinecone_api_key:
        return PineconeVectorStore(api_key=pinecone_api_key)
    
    return ChromaVectorStore(env)
