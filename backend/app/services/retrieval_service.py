from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.schemas.chat import ChatFilters, ChatScopingInfo, RetrievalDebugChunk, RetrievalDebugInfo, SourceCitation
from app.schemas.settings import PersistedSettings
from app.services.embeddings.service import EmbeddingService
from app.services.vectorstore.chroma_store import ChromaVectorStore
from app.services.vectorstore.bm25_store import BM25Store


@dataclass
class RetrievalResult:
    sources: list[SourceCitation]
    confidence: str = "none"
    debug: RetrievalDebugInfo | None = None
    scoping: ChatScopingInfo | None = None


class RetrievalService:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_store: ChromaVectorStore,
        bm25_store: BM25Store,
    ) -> None:
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.bm25_store = bm25_store

    async def retrieve(
        self,
        query: str,
        settings: PersistedSettings,
        filters: ChatFilters | None = None,
        debug: bool = False,
    ) -> RetrievalResult:
        query_embedding = await self.embedding_service.embed_query(settings, query)
        where_filter, understanding = self._build_filters(query, filters)
        
        # 1. Semantic Search
        semantic_candidates = self.vector_store.query(
            query_embedding=query_embedding,
            top_k=max(settings.top_k, 20),
            filters=where_filter,
        )
        
        # 2. Lexical Search (BM25)
        lexical_candidates = self.bm25_store.search(
            query=query,
            top_k=max(settings.top_k, 20),
            filters=where_filter,
        )
        
        # 3. Reciprocal Rank Fusion (RRF)
        fused_candidates = self._rrf(semantic_candidates, lexical_candidates)

        # 4. Rerank and truncate
        reranked = self._rerank(fused_candidates)
        # Ensure the AI receives an absolute minimum of 8 chunks (unless they configured more)
        # Without this, low UI settings forcibly push slightly-older but highly relevant chunks out of bounds
        actual_top_k = max(settings.top_k, 8)
        selected = reranked[: actual_top_k]

        debug_payload = None
        if debug:
            debug_payload = RetrievalDebugInfo(
                query=query,
                filters=understanding,
                embedding_model=settings.embedding_model,
                chunks=[
                    RetrievalDebugChunk(
                        id=source.id,
                        document_id=source.document_id,
                        filename=source.filename,
                        snippet=source.snippet,
                        score=source.score,
                        similarity_score=source.similarity_score,
                        created_at=source.created_at,
                    )
                    for source in selected
                ],
            )

        scoping = ChatScopingInfo(
            document_ids=filters.document_ids if filters else [],
            file_type=filters.file_type if filters else None,
            days=filters.days if filters else None,
        )

        # Calculate Confidence & Display Percentages
        confidence = "none"
        if selected:
            max_sim = max([s.similarity_score for s in selected])
            if max_sim >= 0.82:
                confidence = "high"
            elif max_sim >= 0.74:
                confidence = "medium"
            else:
                confidence = "low"
            
            for source in selected:
                source.similarity_percent = f"{int(source.similarity_score * 100)}% match"

        return RetrievalResult(sources=selected, confidence=confidence, debug=debug_payload, scoping=scoping)

    def _rrf(self, semantic: list[SourceCitation], lexical: list[SourceCitation], k: int = 60) -> list[SourceCitation]:
        # Reciprocal Rank Fusion
        scores_by_id = {}
        sources_by_id = {}

        for rank, source in enumerate(semantic):
            sources_by_id[source.id] = source
            scores_by_id[source.id] = 1 / (k + rank + 1)

        for rank, source in enumerate(lexical):
            if source.id not in sources_by_id:
                sources_by_id[source.id] = source
                scores_by_id[source.id] = 0
            scores_by_id[source.id] += 1 / (k + rank + 1)

        fused = []
        for id_, score in scores_by_id.items():
            source = sources_by_id[id_].model_copy(update={"score": score})
            fused.append(source)

        fused.sort(key=lambda s: s.score, reverse=True)
        return fused

    def _rerank(self, sources: list[SourceCitation]) -> list[SourceCitation]:
        if not sources:
            return []

        timestamps = [self._to_timestamp(source.created_at) for source in sources]
        min_timestamp = min(timestamps, default=0.0)
        max_timestamp = max(timestamps, default=0.0)
        span = max(max_timestamp - min_timestamp, 1.0)

        reranked: list[SourceCitation] = []
        for source, timestamp in zip(sources, timestamps):
            recency_score = (timestamp - min_timestamp) / span if max_timestamp != min_timestamp else 1.0
            # Reduced recency penalty from 30% to 5% to prevent it from burying highly semantically relevant older documents.
            final_score = (source.similarity_score * 0.95) + (recency_score * 0.05)
            reranked.append(source.model_copy(update={"score": final_score}))

        reranked.sort(key=lambda item: item.score, reverse=True)
        return reranked

    def _build_filters(
        self,
        query: str,
        filters: ChatFilters | None,
    ) -> tuple[dict[str, Any] | None, dict[str, Any]]:
        merged_filters: dict[str, Any] = {}
        understanding: dict[str, Any] = {}

        # --- Document scoping (explicit document_ids take precedence over full collection) ---
        document_ids = filters.document_ids if filters else []
        if document_ids:
            merged_filters["document_id"] = {"$in": document_ids}
            understanding["document_ids"] = document_ids

        # --- File type (explicit filter overrides auto-detected hint from query text) ---
        explicit_file_type = filters.file_type if filters else None
        if explicit_file_type:
            merged_filters["file_type_normalized"] = explicit_file_type
            understanding["file_type"] = explicit_file_type
        else:
            hinted_file_type = self._detect_file_type_hint(query)
            if hinted_file_type:
                merged_filters["file_type_normalized"] = hinted_file_type
                understanding["file_type"] = hinted_file_type

        # --- Document type hint (existing behaviour) ---
        explicit_document_type = filters.document_type.lower().strip() if filters and filters.document_type else None
        hinted_document_type = explicit_document_type or self._detect_document_type_hint(query)
        if hinted_document_type:
            merged_filters["document_type_normalized"] = hinted_document_type
            understanding["document_type"] = hinted_document_type

        # --- Recency: days shorthand supersedes recent_only / created_after when present ---
        created_after_timestamp = None
        if filters and filters.days is not None:
            created_after_timestamp = self._recent_threshold_days(filters.days)
            understanding["days"] = filters.days
        elif filters and filters.created_after:
            created_after_timestamp = self._parse_datetime(filters.created_after)
        elif filters and filters.recent_only:
            created_after_timestamp = self._recent_threshold_days(30)
        else:
            created_after_timestamp = self._detect_time_intent(query)

        if created_after_timestamp is not None:
            merged_filters["created_at_ts"] = {"$gte": created_after_timestamp}
            understanding["created_after_ts"] = created_after_timestamp

        return (merged_filters or None), understanding

    def _detect_time_intent(self, query: str) -> float | None:
        text = query.lower()
        if "last week" in text or "past week" in text or "this week" in text:
            return self._recent_threshold_days(7)
        if "yesterday" in text or "today" in text:
            return self._recent_threshold_days(1)
        if "last month" in text or "this month" in text:
            return self._recent_threshold_days(30)
        if any(token in text for token in ["recent", "latest", "newest"]):
            return self._recent_threshold_days(30)
        return None

    def _detect_document_type_hint(self, query: str) -> str | None:
        text = query.lower()
        hints = {
            "invoice": "invoice",
            "contract": "contract",
            "report": "report",
            "proposal": "proposal",
            "policy": "policy",
            "transcript": "transcript",
            "manual": "manual",
            "specification": "specification",
            "spec": "specification",
            "resume": "resume",
            "meeting notes": "meeting_notes",
        }
        for term, value in hints.items():
            if term in text:
                return value
        return None

    def _detect_file_type_hint(self, query: str) -> str | None:
        text = query.lower()
        hints = {
            "audio": "audio",
            "audios": "audio",
            "mp3": "audio",
            "recording": "audio",
            "recordings": "audio",
            "voice note": "audio",
            "voice notes": "audio",
            "pdf": "pdf",
            "pdfs": "pdf",
            "image": "image",
            "images": "image",
            "photo": "image",
            "photos": "image",
            "markdown": "markdown",
            "md file": "markdown",
            "text file": "markdown",
        }
        for term, value in hints.items():
            if term in text:
                return value
        return None

    def _recent_threshold_days(self, days: int) -> float:
        return (datetime.now(timezone.utc) - timedelta(days=days)).timestamp()

    def _parse_datetime(self, value: str) -> float | None:
        try:
            return datetime.fromisoformat(value).timestamp()
        except ValueError:
            return None

    def _to_timestamp(self, value: str | None) -> float:
        if not value:
            return 0.0
        try:
            return datetime.fromisoformat(value).timestamp()
        except ValueError:
            return 0.0
