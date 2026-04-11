from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from app.core.config import EnvironmentSettings
from app.providers.llm_provider import build_llm_provider
from app.schemas.chat import ChatMessage
from app.schemas.settings import PersistedSettings
from app.services.settings_service import SettingsService

logger = logging.getLogger(__name__)


class EnrichmentEntities(BaseModel):
    people: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)


class ImportantDate(BaseModel):
    date: str
    description: str


class DocumentEnrichment(BaseModel):
    document_type: str | None = None
    summary: str = ""
    topics: list[str] = Field(default_factory=list)
    entities: EnrichmentEntities = Field(default_factory=EnrichmentEntities)
    important_dates: list[ImportantDate] = Field(default_factory=list)
    key_points: list[str] = Field(default_factory=list)
    language: str = "unknown"
    confidence: float = 0.0


class EnrichmentService:
    def __init__(self, env: EnvironmentSettings, settings_service: SettingsService | None = None) -> None:
        self.env = env
        self.settings_service = settings_service

    async def enrich(self, raw_text: str, settings: PersistedSettings | None = None) -> DocumentEnrichment:
        logger.info("enrichment started")

        clean_text = raw_text.strip()
        if not clean_text:
            logger.warning("fallback used: empty document text")
            return self._fallback(clean_text)

        excerpt = clean_text[:12000]
        prompt = self._build_prompt(excerpt)
        active_settings = settings or self._resolve_settings()

        try:
            provider = build_llm_provider(active_settings, self.env)
            response_text = await self._collect_response(
                provider.stream_chat(
                    [
                        ChatMessage(role="system", content=SYSTEM_PROMPT),
                        ChatMessage(role="user", content=prompt),
                    ]
                )
            )
            enrichment = self._parse_response(response_text)
            logger.info("enrichment completed")
            return enrichment
        except Exception as exc:
            logger.warning("fallback used: enrichment failed with %s", exc)
            return self._fallback(clean_text)

    def _resolve_settings(self) -> PersistedSettings:
        if self.settings_service is not None:
            return self.settings_service.get_settings()
        return PersistedSettings()

    async def _collect_response(self, stream: Any) -> str:
        parts: list[str] = []
        async for token in stream:
            parts.append(token)
        return "".join(parts).strip()

    def _build_prompt(self, text: str) -> str:
        return (
            "Extract structured document metadata from the text below.\n"
            "Return JSON only.\n"
            "Use this exact shape:\n"
            "{\n"
            '  "document_type": "string or null",\n'
            '  "summary": "short summary",\n'
            '  "topics": ["topic"],\n'
            '  "entities": {\n'
            '    "people": ["name"],\n'
            '    "organizations": ["name"],\n'
            '    "locations": ["name"]\n'
            "  },\n"
            '  "important_dates": [{"date": "YYYY-MM-DD or original text", "description": "why it matters"}],\n'
            '  "key_points": ["point"],\n'
            '  "language": "language name",\n'
            '  "confidence": 0.0\n'
            "}\n\n"
            "Document text:\n"
            f"{text}"
        )

    def _parse_response(self, payload: str) -> DocumentEnrichment:
        candidate = payload.strip()
        if candidate.startswith("```"):
            candidate = candidate.strip("`")
            if "\n" in candidate:
                candidate = candidate.split("\n", 1)[1]
        if candidate.endswith("```"):
            candidate = candidate[:-3].strip()

        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise ValueError("No JSON object found in enrichment response")

        parsed = json.loads(candidate[start : end + 1])
        return DocumentEnrichment.model_validate(parsed)

    def _fallback(self, text: str) -> DocumentEnrichment:
        summary = self._fallback_summary(text)
        key_points = [summary] if summary else []
        return DocumentEnrichment(
            document_type=None,
            summary=summary,
            topics=[],
            entities=EnrichmentEntities(),
            important_dates=[],
            key_points=key_points,
            language="unknown",
            confidence=0.0,
        )

    def _fallback_summary(self, text: str) -> str:
        normalized = " ".join(text.split())
        if not normalized:
            return ""
        return normalized[:280]


SYSTEM_PROMPT = (
    "You extract structured metadata from documents. "
    "Return valid JSON only, with no markdown fences and no extra commentary."
)
