from __future__ import annotations

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

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        client = build_ollama_client(self.base_url)
        embeddings: list[list[float]] = []
        for text in texts:
            embeddings.append(await client.embed(text=text, model=self.model))
        return embeddings


def build_embedding_provider(settings: PersistedSettings, env: EnvironmentSettings) -> EmbeddingProvider:
    base_url = settings.embedding_base_url
    if settings.embedding_provider == "ollama" and not base_url:
        base_url = env.ollama_base_url

    if settings.embedding_provider == "openai" and not settings.embedding_api_key:
        raise ValueError("OpenAI embeddings require an API key")

    if settings.embedding_provider == "ollama":
        return OllamaEmbeddingProvider(model=settings.embedding_model, base_url=base_url or env.ollama_base_url)

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
