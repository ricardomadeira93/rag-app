from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from typing import Any

from app.schemas.chat import ChatFilters, ChatScopingInfo, RetrievalDebugChunk, RetrievalDebugInfo, SourceCitation
from app.schemas.settings import PersistedSettings
from app.services.document_service import DocumentService
from app.services.embeddings.service import EmbeddingService
from app.services.vectorstore.base import VectorStore
from app.services.vectorstore.bm25_store import BM25Store
from app.services.vectorstore.cross_encoder import CrossEncoderService

TEMPORAL_PATTERNS = {
    "last_week": r"last week|past week|this week",
    "last_month": r"last month|past month|this month",
    "last_quarter": r"last quarter|q[1-4]|quarter",
    "recent": r"recently|latest|newest|most recent",
    "oldest": r"oldest|first|original|earliest",
    "specific": r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b20\d\d\b",
}


@dataclass
class RetrievalResult:
    sources: list[SourceCitation]
    confidence: str = "none"
    debug: RetrievalDebugInfo | None = None
    scoping: ChatScopingInfo | None = None
    comparison: dict[str, Any] | None = None


class RetrievalService:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_store: VectorStore,
        bm25_store: BM25Store,
        cross_encoder: CrossEncoderService | None = None,
        chunking_db_path: Path | str | None = None,
        document_service: DocumentService | None = None,
    ) -> None:
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.bm25_store = bm25_store
        self.cross_encoder = cross_encoder
        self.chunking_db_path = chunking_db_path
        self.document_service = document_service

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

        # 4. Neural Re-ranking via CrossEncoder (if enabled)
        if self.cross_encoder:
            # Re-rank the top K + buffer hits before truncating
            rerank_candidates = fused_candidates[:max(settings.top_k * 2, 20)]
            fused_candidates = self.cross_encoder.rerank(query, rerank_candidates, top_k=settings.top_k)

        # 5. Fallback Date Rerank and truncate
        reranked = self._rerank(fused_candidates)
        # Ensure the AI receives an absolute minimum of 8 chunks (unless they configured more)
        # Without this, low UI settings forcibly push slightly-older but highly relevant chunks out of bounds
        actual_top_k = max(settings.top_k, 8)
        selected = reranked[: actual_top_k]
        selected = self._expand_with_related_documents(query_embedding, selected, where_filter, actual_top_k)

        # 6. Swap Child Chunks for Parent Chunks (Context Expansion)
        if self.chunking_db_path:
            await self._augment_with_parents(selected)

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

    async def action_item_retrieve(
        self,
        query: str,
        settings: PersistedSettings,
        filters: ChatFilters | None = None,
        debug: bool = False,
    ) -> RetrievalResult:
        task_queries = [
            query,
            "should do will do need to action task todo next step",
            "deadline due by complete finish implement",
        ]

        combined: list[SourceCitation] = []
        debug_chunks: list[RetrievalDebugChunk] = []
        scoping: ChatScopingInfo | None = None

        for task_query in task_queries:
            result = await self.retrieve(task_query, settings, filters=filters, debug=debug)
            combined.extend(result.sources[:4])
            if result.debug:
                debug_chunks.extend(result.debug.chunks[:4])
            scoping = result.scoping

        deduped: list[SourceCitation] = []
        seen: set[str] = set()
        for chunk in combined:
            key = chunk.chunk_text[:100] if chunk.chunk_text else chunk.snippet[:100]
            if key in seen:
                continue
            seen.add(key)
            deduped.append(chunk)

        selected = deduped[:10]
        confidence = "none"
        if selected:
            max_similarity = max(source.similarity_score for source in selected)
            if max_similarity >= 0.82:
                confidence = "high"
            elif max_similarity >= 0.74:
                confidence = "medium"
            else:
                confidence = "low"

        debug_payload = None
        if debug:
            debug_payload = RetrievalDebugInfo(
                query=query,
                filters={"mode": "action_items"},
                embedding_model=settings.embedding_model,
                chunks=debug_chunks[:10],
            )

        return RetrievalResult(
            sources=selected,
            confidence=confidence,
            debug=debug_payload,
            scoping=scoping,
        )

    async def comparison_retrieve(
        self,
        query: str,
        settings: PersistedSettings,
        filters: ChatFilters | None = None,
        explicit_doc_names: list[str] | None = None,
        max_docs: int = 10,
        chars_per_doc: int = 800,
        debug: bool = False,
    ) -> RetrievalResult:
        query_embedding = await self.embedding_service.embed_query(settings, query)
        where_filter, understanding = self._build_filters(query, filters)
        all_results = self.vector_store.get_all_chunks(filters=where_filter)

        documents = all_results.get("documents") or []
        metadatas = all_results.get("metadatas") or []
        if not documents:
            return RetrievalResult(
                sources=[],
                confidence="none",
                debug=None,
                scoping=ChatScopingInfo(
                    document_ids=filters.document_ids if filters else [],
                    file_type=filters.file_type if filters else None,
                    days=filters.days if filters else None,
                ),
                comparison={
                    "mode": "comparison",
                    "documents": [],
                    "total_docs": 0,
                    "truncated": False,
                    "message": None,
                },
            )

        doc_map: dict[str, dict[str, Any]] = {}
        for index, metadata in enumerate(metadatas):
            if index >= len(documents):
                continue
            source = str(metadata.get("filename") or "unknown")
            entry = doc_map.setdefault(
                source,
                {
                    "document_id": str(metadata.get("document_id", "unknown")),
                    "doc_type": str(metadata.get("doc_type") or metadata.get("document_type") or "unknown"),
                    "source_type": str(metadata.get("source_type", "upload")),
                    "chunks": [],
                    "metadata": metadata,
                },
            )
            entry["chunks"].append(documents[index])

        if explicit_doc_names:
            explicit_lowers = [name.lower() for name in explicit_doc_names]
            doc_map = {
                key: value
                for key, value in doc_map.items()
                if any(name in key.lower() or key.lower() in name for name in explicit_lowers)
            }

        total_docs = len(doc_map)
        truncated = False
        truncation_message: str | None = None

        if total_docs > max_docs:
            truncated = True
            truncation_message = (
                f"Your knowledge base has {total_docs} documents. "
                f"Showing the {max_docs} most relevant for this comparison. "
                f"To compare specific documents, name them in your question."
            )
            quick_candidates = self.vector_store.query(
                query_embedding=query_embedding,
                top_k=min(len(documents), max_docs * 8),
                filters=where_filter,
            )
            ranked_sources = list(dict.fromkeys(source.filename for source in quick_candidates))
            selected_sources = ranked_sources[:max_docs]
            if len(selected_sources) < max_docs:
                for source in doc_map:
                    if source not in selected_sources:
                        selected_sources.append(source)
                    if len(selected_sources) >= max_docs:
                        break
            doc_map = {key: doc_map[key] for key in selected_sources if key in doc_map}

        comparison_docs: list[dict[str, Any]] = []
        comparison_sources: list[SourceCitation] = []

        for source, data in doc_map.items():
            chunk_count = len(data["chunks"])
            doc_filter = dict(where_filter or {})
            doc_filter["filename"] = {"$eq": source}

            best_matches = self.vector_store.query(
                query_embedding=query_embedding,
                top_k=min(3, max(chunk_count, 1)),
                filters=doc_filter,
            )

            best_source = best_matches[0] if best_matches else None
            best_chunk = best_source.chunk_text if best_source and best_source.chunk_text else data["chunks"][0]
            similarity = round(best_source.similarity_score, 3) if best_source else 0.5

            representative = best_chunk[:chars_per_doc]
            if len(best_chunk) > chars_per_doc:
                representative += "..."

            comparison_docs.append(
                {
                    "source": source,
                    "document_id": data["document_id"],
                    "source_type": data["source_type"],
                    "doc_type": data["doc_type"],
                    "representative_chunk": representative,
                    "total_chunks": chunk_count,
                    "similarity": similarity,
                }
            )

            comparison_sources.append(
                SourceCitation(
                    id=f"{data['document_id']}:comparison",
                    document_id=data["document_id"],
                    filename=source,
                    snippet=representative[:280].strip(),
                    chunk_text=representative,
                    score=similarity,
                    similarity_score=similarity,
                    similarity_percent=f"{int(similarity * 100)}% match",
                    chunk_index=0,
                    page=best_source.page if best_source else None,
                    offset=best_source.offset if best_source else 0,
                    created_at=best_source.created_at if best_source else None,
                    source_type=data["source_type"],
                    doc_type=data["doc_type"],
                    parent_id=best_source.parent_id if best_source else None,
                )
            )

        comparison_docs.sort(key=lambda item: item["similarity"], reverse=True)
        comparison_sources.sort(key=lambda item: item.similarity_score, reverse=True)

        confidence = "none"
        if comparison_sources:
            max_similarity = max(source.similarity_score for source in comparison_sources)
            if max_similarity >= 0.82:
                confidence = "high"
            elif max_similarity >= 0.74:
                confidence = "medium"
            else:
                confidence = "low"

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
                    for source in comparison_sources
                ],
            )

        scoping = ChatScopingInfo(
            document_ids=filters.document_ids if filters else [],
            file_type=filters.file_type if filters else None,
            days=filters.days if filters else None,
        )

        return RetrievalResult(
            sources=comparison_sources,
            confidence=confidence,
            debug=debug_payload,
            scoping=scoping,
            comparison={
                "mode": "comparison",
                "documents": comparison_docs,
                "total_docs": total_docs,
                "truncated": truncated,
                "message": truncation_message,
            },
        )

    def format_comparison_context(self, retrieval_result: dict[str, Any]) -> str:
        if retrieval_result.get("mode") != "comparison":
            raise ValueError("Expected comparison mode retrieval result")

        lines: list[str] = []

        if retrieval_result.get("message"):
            lines.append(f"Note: {retrieval_result['message']}\n")

        lines.append(
            f"You have access to {len(retrieval_result.get('documents', []))} documents "
            "from the knowledge base. Analyze ALL of them in your response.\n"
        )

        for index, doc in enumerate(retrieval_result.get("documents", []), start=1):
            lines.append(f"--- Document {index}: {doc['source']} ---")
            lines.append(f"Type: {doc['doc_type']}")
            lines.append(f"Relevance to query: {int(doc['similarity'] * 100)}%")
            lines.append(f"Content excerpt:\n{doc['representative_chunk']}")
            lines.append("")

        return "\n".join(lines)

    def get_all_document_names(self, filters: ChatFilters | None = None) -> list[str]:
        where_filter, _ = self._build_filters("", filters)
        all_results = self.vector_store.get_all_chunks(filters=where_filter)
        metadatas = all_results.get("metadatas") or []
        names = []
        for metadata in metadatas:
            filename = str(metadata.get("filename") or "")
            if filename and filename not in names:
                names.append(filename)
        return names

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


    async def _augment_with_parents(self, sources: list[SourceCitation]) -> None:
        """Looks up the parent chunks in sqlite and swaps the short chunk_text for massive context."""
        parent_ids = {s.parent_id for s in sources if s.parent_id}
        if not parent_ids:
            return
            
        import aiosqlite
        # We need a quick read
        parent_map = {}
        try:
            async with aiosqlite.connect(str(self.chunking_db_path)) as db:
                db.row_factory = aiosqlite.Row
                # sqlite python driver doesn't support an array natively, so we chunk it or build the IN clause
                placeholders = ",".join(["?"] * len(parent_ids))
                cursor = await db.execute(f"SELECT id, content FROM parent_chunks WHERE id IN ({placeholders})", list(parent_ids))
                rows = await cursor.fetchall()
                for row in rows:
                    parent_map[row["id"]] = row["content"]
        except Exception:
            pass # fallback to children if sqlite fails
            
        for source in sources:
            if source.parent_id and source.parent_id in parent_map:
                source.chunk_text = parent_map[source.parent_id]

    def _expand_with_related_documents(
        self,
        query_embedding: list[float],
        sources: list[SourceCitation],
        where_filter: dict[str, Any] | None,
        limit: int,
    ) -> list[SourceCitation]:
        if not self.document_service or not sources:
            return sources

        document_index = {document.id: document for document in self.document_service.list_documents()}
        existing_ids = {source.id for source in sources}
        related_doc_ids: list[str] = []

        for source in sources:
            document = document_index.get(source.document_id)
            if not document:
                continue
            for related in document.related_docs:
                related_id = str(related.get("doc_id") or "")
                if related_id and related_id not in related_doc_ids and related_id != source.document_id:
                    related_doc_ids.append(related_id)

        if not related_doc_ids:
            return sources

        expanded = list(sources)
        for related_doc_id in related_doc_ids:
            doc_filter = dict(where_filter or {})
            doc_filter["document_id"] = {"$eq": related_doc_id}
            matches = self.vector_store.query(
                query_embedding=query_embedding,
                top_k=1,
                filters=doc_filter,
            )
            if not matches:
                continue
            candidate = matches[0]
            if candidate.similarity_score < 0.5 or candidate.id in existing_ids:
                continue
            expanded.append(candidate)
            existing_ids.add(candidate.id)
            if len(expanded) >= limit:
                break

        return self._rerank(expanded)[:limit]

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
        created_before_timestamp = None
        if filters and filters.days is not None:
            created_after_timestamp = self._recent_threshold_days(filters.days)
            understanding["days"] = filters.days
        elif filters and filters.created_after:
            created_after_timestamp = self._parse_datetime(filters.created_after)
        elif filters and filters.recent_only:
            created_after_timestamp = self._recent_threshold_days(30)
        else:
            temporal_filter = self.extract_temporal_filter(query)
            if temporal_filter:
                created_after_timestamp = temporal_filter.get("after")
                created_before_timestamp = temporal_filter.get("before")
                understanding["temporal_filter"] = temporal_filter

        if created_after_timestamp is not None:
            merged_filters["created_at_ts"] = {"$gte": created_after_timestamp}
            understanding["created_after_ts"] = created_after_timestamp
        if created_before_timestamp is not None:
            existing = merged_filters.get("created_at_ts", {})
            if isinstance(existing, dict):
                existing["$lte"] = created_before_timestamp
                merged_filters["created_at_ts"] = existing
            else:
                merged_filters["created_at_ts"] = {"$lte": created_before_timestamp}
            understanding["created_before_ts"] = created_before_timestamp

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

    def extract_temporal_filter(self, message: str) -> dict[str, float] | None:
        lower = message.lower()
        now = datetime.now(timezone.utc)

        if re.search(TEMPORAL_PATTERNS["last_week"], lower):
            return {"after": (now - timedelta(days=7)).timestamp()}
        if re.search(TEMPORAL_PATTERNS["last_month"], lower):
            return {"after": (now - timedelta(days=30)).timestamp()}
        if re.search(TEMPORAL_PATTERNS["last_quarter"], lower):
            return {"after": (now - timedelta(days=90)).timestamp()}
        if re.search(TEMPORAL_PATTERNS["recent"], lower):
            return {"after": (now - timedelta(days=14)).timestamp()}
        if re.search(TEMPORAL_PATTERNS["oldest"], lower):
            return {"before": (now - timedelta(days=180)).timestamp()}

        year_match = re.search(r"\b(20\d\d)\b", lower)
        if year_match:
            year = int(year_match.group(1))
            start = datetime(year, 1, 1, tzinfo=timezone.utc).timestamp()
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp()
            return {"after": start, "before": end}

        month_match = re.search(
            r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b",
            lower,
        )
        if month_match:
            month_names = {
                "january": 1,
                "february": 2,
                "march": 3,
                "april": 4,
                "may": 5,
                "june": 6,
                "july": 7,
                "august": 8,
                "september": 9,
                "october": 10,
                "november": 11,
                "december": 12,
            }
            month = month_names[month_match.group(1)]
            year = now.year
            start = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
            return {"after": start.timestamp(), "before": end.timestamp()}

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
