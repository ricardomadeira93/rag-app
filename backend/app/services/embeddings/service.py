from __future__ import annotations

from app.core.config import EnvironmentSettings
from app.providers.embedding_provider import build_embedding_provider
from app.schemas.settings import EmbeddingSignature, PersistedSettings


class EmbeddingService:
    def __init__(self, env: EnvironmentSettings) -> None:
        self.env = env

    async def embed_texts(self, settings: PersistedSettings, texts: list[str]) -> list[list[float]]:
        provider = build_embedding_provider(settings, self.env)
        batch_size = 32
        embeddings: list[list[float]] = []

        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            embeddings.extend(await provider.embed_texts(batch))

        return embeddings

    async def embed_query(self, settings: PersistedSettings, query: str) -> list[float]:
        results = await self.embed_texts(settings, [query])
        return results[0]

    def get_signature(self, settings: PersistedSettings) -> EmbeddingSignature:
        return settings.embedding_signature
