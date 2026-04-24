from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import chromadb

from app.core.config import EnvironmentSettings
from app.core.constants import COLLECTION_NAME
from app.schemas.chat import SourceCitation
from app.schemas.documents import DocumentRecord
from app.schemas.settings import EmbeddingSignature
from app.services.ingestion.chunking import ChunkWithMeta


class ChromaVectorStore:
    def __init__(self, env: EnvironmentSettings) -> None:
        self.client = chromadb.PersistentClient(path=str(env.chroma_dir))
        self.collection_name = COLLECTION_NAME

    def upsert_document(
        self,
        document: DocumentRecord,
        chunks: list[str],
        embeddings: list[list[float]],
        signature: EmbeddingSignature,
        chunk_metas: list[ChunkWithMeta] | None = None,
    ) -> None:
        collection = self._get_collection()
        collection.delete(where={"document_id": document.id})
        ids = [f"{document.id}:{index}" for index in range(len(chunks))]
        metadatas = [
            self._sanitize_metadata(
                {
                    "document_id": document.id,
                    "filename": document.filename,
                    "chunk_index": index,
                    "embedding_provider": signature.provider,
                    "embedding_model": signature.model,
                    "embedding_version": signature.version,
                    "file_type": document.file_type,
                    "file_type_normalized": document.file_type.strip().lower(),
                    "document_type": document.document_type or "",
                    "source_type": document.source_type,
                    "source_connector": document.source_connector,
                    "doc_type": document.doc_type,
                    "summary": document.summary or "",
                    "topics": json.dumps(document.topics),
                    "created_at": document.created_at,
                    "updated_at": document.updated_at,
                    "created_at_ts": self._to_timestamp(document.created_at),
                    "document_type_normalized": (document.document_type or "").strip().lower(),
                    # Page / offset metadata — page stored as -1 sentinel when not applicable
                    # because ChromaDB does not accept None values in metadata.
                    "page": chunk_metas[index].page if chunk_metas and chunk_metas[index].page is not None else -1,
                    "offset": chunk_metas[index].offset if chunk_metas else 0,
                    "parent_id": chunk_metas[index].parent_id if chunk_metas and chunk_metas[index].parent_id else "",
                }
            )
            for index in range(len(chunks))
        ]
        collection.upsert(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)

    def query(
        self,
        query_embedding: list[float],
        top_k: int,
        filters: dict[str, Any] | None = None,
    ) -> list[SourceCitation]:
        collection = self._get_collection()
        query_args: dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
            "include": ["documents", "metadatas", "distances"],
        }
        if filters:
            if len(filters) == 1:
                query_args["where"] = filters
            else:
                query_args["where"] = {"$and": [{key: value} for key, value in filters.items()]}
        results = collection.query(**query_args)
        return self._to_sources(results)

    def delete_document(self, document_id: str) -> None:
        collection = self._get_collection()
        collection.delete(where={"document_id": document_id})

    def reset(self) -> None:
        try:
            self.client.delete_collection(self.collection_name)
        except Exception:
            pass
        self._get_collection()

    def count(self) -> int:
        return self._get_collection().count()

    def get_all_chunks(self, filters: dict[str, Any] | None = None) -> dict[str, Any]:
        collection = self._get_collection()
        query_args: dict[str, Any] = {
            "include": ["documents", "metadatas"],
        }
        if filters:
            if len(filters) == 1:
                query_args["where"] = filters
            else:
                query_args["where"] = {"$and": [{key: value} for key, value in filters.items()]}
        return collection.get(**query_args)

    def _get_collection(self) -> Any:
        return self.client.get_or_create_collection(name=self.collection_name, metadata={"hnsw:space": "cosine"})

    def _to_sources(self, results: dict[str, Any]) -> list[SourceCitation]:
        documents = (results.get("documents") or [[]])[0]
        metadatas = (results.get("metadatas") or [[]])[0]
        distances = (results.get("distances") or [[]])[0]

        sources: list[SourceCitation] = []
        for index, document in enumerate(documents):
            metadata = metadatas[index] if index < len(metadatas) else {}
            distance = distances[index] if index < len(distances) else 0.0
            score = max(0.0, 1 - float(distance))
            snippet = document[:280].strip()
            # Deserialise page: -1 sentinel → None (ChromaDB does not store None)
            raw_page = metadata.get("page")
            page: int | None = None if raw_page is None or int(raw_page) == -1 else int(raw_page)
            sources.append(
                SourceCitation(
                    id=f'{metadata.get("document_id", "unknown")}:{metadata.get("chunk_index", index)}',
                    document_id=str(metadata.get("document_id", "unknown")),
                    filename=str(metadata.get("filename", "Unknown source")),
                    snippet=snippet,
                    chunk_text=document.strip(),
                    score=score,
                    similarity_score=score,
                    chunk_index=int(metadata.get("chunk_index", index)),
                    page=page,
                    offset=int(metadata.get("offset", 0)),
                    created_at=str(metadata.get("created_at")) if metadata.get("created_at") else None,
                    source_type=str(metadata.get("source_type", "upload")),
                    doc_type=str(metadata.get("doc_type", "file")),
                    parent_id=str(metadata.get("parent_id")) if metadata.get("parent_id") else None,
                )
            )
        return sources

    def _to_timestamp(self, value: str | None) -> float:
        if not value:
            return 0.0
        try:
            return datetime.fromisoformat(value).timestamp()
        except ValueError:
            return 0.0

    def _sanitize_metadata(self, metadata: dict[str, Any]) -> dict[str, Any]:
        sanitized: dict[str, Any] = {}
        for key, value in metadata.items():
            if value is None:
                sanitized[key] = ""
            else:
                sanitized[key] = value
        return sanitized
