from __future__ import annotations

from app.schemas.chat import SourceCitation


class CrossEncoderService:
    def rerank(self, query: str, candidates: list[SourceCitation], top_k: int) -> list[SourceCitation]:
        return candidates[:top_k]
