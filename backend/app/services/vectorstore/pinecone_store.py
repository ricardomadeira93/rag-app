from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any

from pinecone import Pinecone, ServerlessSpec

from app.core.config import EnvironmentSettings
from app.core.constants import COLLECTION_NAME
from app.schemas.chat import SourceCitation
from app.schemas.documents import DocumentRecord
from app.schemas.settings import EmbeddingSignature
from app.services.ingestion.chunking import ChunkWithMeta
from app.services.vectorstore.base import VectorStore

logger = logging.getLogger(__name__)

PINECONE_DIMENSION = 1024  # multilingual-e5-large


class PineconeVectorStore(VectorStore):
    def __init__(self, api_key: str) -> None:
        self.pc = Pinecone(api_key=api_key)
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "stark-index")

        existing = self.pc.list_indexes().names()
        if self.index_name not in existing:
            logger.info("Pinecone index '%s' not found — creating it now…", self.index_name)
            self.pc.create_index(
                name=self.index_name,
                dimension=PINECONE_DIMENSION,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            logger.info("Pinecone index '%s' created.", self.index_name)

        self.index = self.pc.Index(self.index_name)

    def upsert_document(
        self,
        document: DocumentRecord,
        chunks: list[str],
        embeddings: list[list[float]],
        signature: EmbeddingSignature,
        chunk_metas: list[ChunkWithMeta] | None = None,
    ) -> None:
        self.delete_document(document.id)
        
        vectors = []
        for index in range(len(chunks)):
            metadata = self._sanitize_metadata(
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
                    "page": chunk_metas[index].page if chunk_metas and chunk_metas[index].page is not None else -1,
                    "offset": chunk_metas[index].offset if chunk_metas else 0,
                    "parent_id": chunk_metas[index].parent_id if chunk_metas and chunk_metas[index].parent_id else "",
                    "text": chunks[index], # Pinecone needs the text stored in metadata
                }
            )
            
            vectors.append({
                "id": f"{document.id}:{index}",
                "values": embeddings[index],
                "metadata": metadata
            })
            
            # Batch upsert to avoid payload limits
            if len(vectors) >= 100:
                self.index.upsert(vectors=vectors)
                vectors = []
                
        if vectors:
            self.index.upsert(vectors=vectors)

    def query(
        self,
        query_embedding: list[float],
        top_k: int,
        filters: dict[str, Any] | None = None,
    ) -> list[SourceCitation]:
        pinecone_filter = self._convert_filters(filters)
        
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            filter=pinecone_filter,
            include_metadata=True
        )
        
        return self._to_sources(results)

    def delete_document(self, document_id: str) -> None:
        # Pinecone Serverless doesn't support delete by filter.
        # We must list the IDs or use delete by metadata if supported, but Serverless restricts delete by metadata.
        # However, for a simple implementation, assuming namespaces or we keep track of IDs.
        # To mimic Chroma without tracking IDs, we can query top_k=1000 for the document_id and delete those IDs.
        dummy_vector = [0.0] * PINECONE_DIMENSION
        while True:
            res = self.index.query(
                vector=dummy_vector,
                top_k=1000,
                filter={"document_id": {"$eq": document_id}},
                include_metadata=False
            )
            ids_to_delete = [match.id for match in res.matches]
            if not ids_to_delete:
                break
            self.index.delete(ids=ids_to_delete)

    def reset(self) -> None:
        # Dangerous, normally we don't want to wipe the whole prod index, but to match protocol:
        self.index.delete(delete_all=True)

    def count(self) -> int:
        stats = self.index.describe_index_stats()
        return stats.get("total_vector_count", 0)

    def get_all_chunks(self, filters: dict[str, Any] | None = None) -> dict[str, Any]:
        # Mimic Chroma's get_all_chunks by querying a large number of docs.
        # This is a limitation of Pinecone compared to Chroma.
        dummy_vector = [0.0] * PINECONE_DIMENSION
        pinecone_filter = self._convert_filters(filters)
        
        results = self.index.query(
            vector=dummy_vector,
            top_k=10000,
            filter=pinecone_filter,
            include_metadata=True
        )
        
        documents = []
        metadatas = []
        for match in results.matches:
            metadata = match.metadata or {}
            documents.append(metadata.get("text", ""))
            metadatas.append(metadata)
            
        return {"documents": [documents], "metadatas": [metadatas]}

    def _convert_filters(self, filters: dict[str, Any] | None) -> dict[str, Any] | None:
        if not filters:
            return None
        # Basic mapping of Chroma filters to Pinecone filters
        # Chroma uses {"$and": [{"key": "val"}]} or {"key": "val"}
        # Pinecone uses same MongoDB style operators
        return filters

    def _to_sources(self, results: Any) -> list[SourceCitation]:
        sources: list[SourceCitation] = []
        for match in results.matches:
            metadata = match.metadata or {}
            score = match.score if match.score is not None else 0.0
            
            document_text = str(metadata.get("text", ""))
            snippet = document_text[:280].strip()
            
            raw_page = metadata.get("page")
            page: int | None = None if raw_page is None or int(raw_page) == -1 else int(raw_page)
            
            sources.append(
                SourceCitation(
                    id=match.id,
                    document_id=str(metadata.get("document_id", "unknown")),
                    filename=str(metadata.get("filename", "Unknown source")),
                    snippet=snippet,
                    chunk_text=document_text.strip(),
                    score=score,
                    similarity_score=score,
                    chunk_index=int(metadata.get("chunk_index", 0)),
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
            elif isinstance(value, list):
                # Pinecone supports lists of strings
                sanitized[key] = [str(v) for v in value]
            else:
                sanitized[key] = value
        return sanitized
