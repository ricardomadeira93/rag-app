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

        active_settings = settings or self._resolve_settings()
        excerpt = self._build_representative_excerpt(clean_text)
        prompt = self._build_prompt(excerpt)

        try:
            provider = build_llm_provider(active_settings, self.env, use_enrichment_model=True)
            response_text = await provider.generate_json(
                [
                    ChatMessage(role="system", content=SYSTEM_PROMPT),
                    ChatMessage(role="user", content=prompt),
                ]
            )
            enrichment = self._parse_response(response_text)
            logger.info("enrichment completed using structured json")
            return enrichment
        except Exception as exc:
            logger.warning("fallback used: enrichment failed with %s", exc)
            return self._fallback(clean_text)

    def _resolve_settings(self) -> PersistedSettings:
        if self.settings_service is not None:
            return self.settings_service.get_settings()
        return PersistedSettings()

    async def contextualize_chunk(self, document_summary: str, chunk_text: str, settings: PersistedSettings | None = None) -> str:
        prompt = (
            "You are generating a context header for a text chunk to improve search retrieval.\n"
            "Return JSON only.\n"
            "Use this exact shape:\n"
            "{\n"
            '  "context_header": "Write a 1-sentence explanation of what this chunk is discussing, using the global summary."\n'
            "}\n\n"
            f"Global Document Summary:\n{document_summary}\n\n"
            f"Chunk Text:\n{chunk_text}"
        )
        active_settings = settings or self._resolve_settings()
        
        try:
            provider = build_llm_provider(active_settings, self.env, use_enrichment_model=True)
            response_text = await provider.generate_json(
                [
                    ChatMessage(role="system", content=SYSTEM_PROMPT),
                    ChatMessage(role="user", content=prompt),
                ]
            )
            candidate = response_text.strip()
            if candidate.startswith("```"):
                candidate = candidate.strip("`")
                if candidate.lower().startswith("json"):
                    candidate = candidate[4:].strip()

            start = candidate.find("{")
            end = candidate.rfind("}")
            if start != -1 and end != -1 and start <= end:
                parsed = json.loads(candidate[start : end + 1])
                return parsed.get("context_header", "").strip()
        except Exception as exc:
            logger.warning("chunk contextualization failed: %s", exc)
            
        return ""

    def _build_representative_excerpt(self, text: str) -> str:
        # Representative Sampling: Grabs 4k from start, 4k from middle, 4k from end
        max_chars = 12000
        if len(text) <= max_chars:
            return text
            
        chunk_size = max_chars // 3
        start_chunk = text[:chunk_size]
        end_chunk = text[-chunk_size:]
        
        middle_index = len(text) // 2
        half_chunk = chunk_size // 2
        middle_chunk = text[middle_index - half_chunk : middle_index + half_chunk]
        
        return f"{start_chunk}\n\n...[content skipped]...\n\n{middle_chunk}\n\n...[content skipped]...\n\n{end_chunk}"

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
        
        # Strip potential markdown fences if model ignored formatting
        if candidate.startswith("```"):
            candidate = candidate.strip("`")
            if candidate.lower().startswith("json"):
                candidate = candidate[4:].strip()

        # Find the outermost JSON object braces
        start = candidate.find("{")
        end = candidate.rfind("}")
        
        if start == -1 or end == -1 or end < start:
            raise ValueError(f"No JSON object found in response payload: {payload[:100]}")

        try:
            parsed = json.loads(candidate[start : end + 1])
            return DocumentEnrichment.model_validate(self._normalize_payload(parsed))
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON produced by model: {e}")

    def _normalize_payload(self, parsed: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(parsed)

        if normalized.get("summary") is None:
            normalized["summary"] = ""
        if normalized.get("topics") is None:
            normalized["topics"] = []
        if normalized.get("important_dates") is None:
            normalized["important_dates"] = []
        if normalized.get("key_points") is None:
            normalized["key_points"] = []
        if normalized.get("language") is None:
            normalized["language"] = "unknown"
        if normalized.get("confidence") is None:
            normalized["confidence"] = 0.0

        entities = normalized.get("entities")
        if not isinstance(entities, dict):
            entities = {}
        normalized["entities"] = {
            "people": entities.get("people") or [],
            "organizations": entities.get("organizations") or [],
            "locations": entities.get("locations") or [],
        }

        return normalized

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
