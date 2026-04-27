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
        workspace_id: str | None = None,
    ) -> None: ...

    def query(
        self,
        query_embedding: list[float],
        top_k: int,
        filters: dict[str, Any] | None = None,
        workspace_id: str | None = None,
    ) -> list[SourceCitation]: ...

    def delete_document(self, document_id: str, workspace_id: str | None = None) -> None: ...

    def reset(self, workspace_id: str | None = None) -> None: ...

    def count(self, workspace_id: str | None = None) -> int: ...

    def get_all_chunks(self, filters: dict[str, Any] | None = None, workspace_id: str | None = None) -> dict[str, Any]: ...

