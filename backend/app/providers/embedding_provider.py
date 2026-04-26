from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

from litellm import aembedding

from app.core.config import EnvironmentSettings
from app.schemas.settings import PersistedSettings
from app.services.llm.ollama_client import build_ollama_client


class EmbeddingProvider(Protocol):
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


@dataclass
class LiteLLMEmbeddingProvider:
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = await aembedding(
            model=_resolve_model_name(self.provider, self.model),
            input=texts,
            api_key=self.api_key,
            api_base=self.base_url,
        )
        data = _read(response, "data") or []
        embeddings: list[list[float]] = []
        for item in data:
            value = _read(item, "embedding")
            if value:
                embeddings.append(value)
        return embeddings


@dataclass
class OllamaEmbeddingProvider:
    model: str
    base_url: str
    keep_alive: str | None = None

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        client = build_ollama_client(self.base_url, keep_alive=self.keep_alive)
        embeddings: list[list[float]] = []
        for text in texts:
            embeddings.append(await client.embed(text=text, model=self.model))
        return embeddings


@dataclass
class PineconeEmbeddingProvider:
    api_key: str
    model: str = "multilingual-e5-large"

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        # pinecone inference API is synchronous in the python client, so we run it in a thread
        # or simply call it
        import asyncio
        from pinecone import Pinecone
        
        pc = Pinecone(api_key=self.api_key)
        
        def _get_embeddings():
            return pc.inference.embed(
                model=self.model,
                inputs=texts,
                parameters={"input_type": "passage", "truncate": "END"}
            )
            
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _get_embeddings)
        
        return [item["values"] for item in response.data]


def build_embedding_provider(settings: PersistedSettings, env: EnvironmentSettings) -> EmbeddingProvider:
    pinecone_api_key = os.getenv("PINECONE_API_KEY")
    if pinecone_api_key:
        return PineconeEmbeddingProvider(api_key=pinecone_api_key)
    base_url = settings.embedding_base_url
    if settings.embedding_provider == "ollama" and not base_url:
        base_url = env.ollama_base_url

    if settings.embedding_provider == "openai" and not settings.embedding_api_key:
        raise ValueError("OpenAI embeddings require an API key")

    if settings.embedding_provider == "ollama":
        return OllamaEmbeddingProvider(
            model=settings.embedding_model,
            base_url=base_url or env.ollama_base_url,
            keep_alive=env.ollama_keep_alive,
        )

    return LiteLLMEmbeddingProvider(
        provider=settings.embedding_provider,
        model=settings.embedding_model,
        api_key=settings.embedding_api_key,
        base_url=base_url,
    )


def _resolve_model_name(provider: str, model: str) -> str:
    if "/" in model:
        return model
    return f"{provider}/{model}"


def _read(value: object, key: str) -> object | None:
    if isinstance(value, dict):
        return value.get(key)
    return getattr(value, key, None)
