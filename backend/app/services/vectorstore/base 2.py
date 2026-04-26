from __future__ import annotations

from typing import Any, Protocol

from app.schemas.chat import SourceCitation
from app.schemas.documents import DocumentRecord
from app.schemas.settings import EmbeddingSignature
from app.services.ingestion.chunking import ChunkWithMeta


class VectorStore(Protocol):
    def upsert_document(
        self,
        document: DocumentRecord,
        chunks: list[str],
        embeddings: list[list[float]],
        signature: EmbeddingSignature,
        chunk_metas: list[ChunkWithMeta] | None = None,
    ) -> None: ...

    def query(
        self,
        query_embedding: list[float],
        top_k: int,
        filters: dict[str, Any] | None = None,
    ) -> list[SourceCitation]: ...

    def delete_document(self, document_id: str) -> None: ...

    def reset(self) -> None: ...

    def count(self) -> int: ...

    def get_all_chunks(self, filters: dict[str, Any] | None = None) -> dict[str, Any]: ...
