from __future__ import annotations

from collections import defaultdict
import re

from app.schemas.chat import SourceCitation


class BM25Store:
    def __init__(self, vector_store: object) -> None:
        self.vector_store = vector_store
        self._chunks: dict[str, dict[str, object]] = {}

    def initialize(self) -> None:
        return None

    def reset(self) -> None:
        self._chunks.clear()

    def delete_document(self, document_id: str) -> None:
        self._chunks = {
            chunk_id: payload
            for chunk_id, payload in self._chunks.items()
            if payload.get("document_id") != document_id
        }

    def upsert_chunks(self, document_id: str, chunk_ids: list[str], chunks: list[str], metadatas: list[dict]) -> None:
        for chunk_id, chunk, metadata in zip(chunk_ids, chunks, metadatas):
            stored_metadata = dict(metadata)
            stored_metadata["document_id"] = document_id
            self._chunks[chunk_id] = {
                "text": chunk,
                "metadata": stored_metadata,
            }

    def search(self, query: str, top_k: int = 10, filters: dict | None = None) -> list[SourceCitation]:
        query_terms = {term for term in re.findall(r"\w+", query.lower()) if len(term) > 1}
        scores: list[tuple[int, str, dict[str, object]]] = []
        for chunk_id, payload in self._chunks.items():
            metadata = payload["metadata"]
            if filters and not _matches_filters(metadata, filters):
                continue
            text = str(payload["text"])
            lowered = text.lower()
            score = sum(1 for term in query_terms if term in lowered)
            if score <= 0:
                continue
            scores.append((score, text, metadata))

        scores.sort(key=lambda item: item[0], reverse=True)
        results: list[SourceCitation] = []
        for score, text, metadata in scores[:top_k]:
            similarity = min(0.99, 0.5 + (score / max(len(query_terms), 1)) * 0.4)
            results.append(
                SourceCitation(
                    id=f"{metadata.get('document_id')}:{metadata.get('chunk_index', 0)}",
                    document_id=str(metadata.get("document_id", "")),
                    filename=str(metadata.get("filename", "unknown")),
                    snippet=text[:280].strip(),
                    chunk_text=text,
                    score=float(score),
                    similarity_score=similarity,
                    similarity_percent=f"{int(similarity * 100)}% match",
                    chunk_index=int(metadata.get("chunk_index", 0)),
                    parent_id=str(metadata.get("parent_id") or "") or None,
                    page=int(metadata.get("page", -1)) if int(metadata.get("page", -1)) >= 0 else None,
                    offset=int(metadata.get("offset", 0)),
                    created_at=str(metadata.get("created_at")) if metadata.get("created_at") else None,
                    source_type=str(metadata.get("source_type", "upload")),
                    doc_type=str(metadata.get("doc_type", "file")),
                )
            )
        return results


def _matches_filters(metadata: dict[str, object], filters: dict[str, object]) -> bool:
    for key, value in filters.items():
        actual = metadata.get(key)
        if isinstance(value, dict) and "$eq" in value:
            if actual != value["$eq"]:
                return False
        elif actual != value:
            return False
    return True
