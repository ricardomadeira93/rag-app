from __future__ import annotations

import json
import logging
from typing import AsyncIterator

from app.core.config import EnvironmentSettings
from app.providers.llm_provider import build_llm_provider
from app.schemas.chat import ChatMessage, ChatRequest, SourceCitation
from app.schemas.settings import PersistedSettings
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self,
        env: EnvironmentSettings,
        retrieval_service: RetrievalService,
    ) -> None:
        self.env = env
        self.retrieval_service = retrieval_service

    async def stream_response(
        self,
        request: ChatRequest,
        settings: PersistedSettings,
    ) -> AsyncIterator[str]:
        prompt = request.latest_user_message
        if not prompt:
            raise ValueError("At least one user message is required")

        retrieval = await self.retrieval_service.retrieve(
            query=prompt,
            settings=settings,
            filters=request.filters,
            debug=request.debug,
        )
        sources = retrieval.sources

        # Always emit scoping so the frontend knows which filters were applied
        if retrieval.scoping is not None:
            yield sse_event("scoping", retrieval.scoping.model_dump())

        if not sources:
            empty_message = (
                "I could not find matching indexed material for that question. "
                "Try naming the file or asking in a more specific way."
            )
            yield sse_event("token", {"content": empty_message})
            yield sse_event("sources", {"items": []})
            yield sse_event("done", {"ok": True})
            return

        if retrieval.debug is not None:
            yield sse_event("debug", retrieval.debug.model_dump())

        context = self._build_context(sources)
        llm_messages = self._build_messages(request.messages, context)
        
        # SMART ROUTING
        use_enrichment_model = False
        if settings.semantic_routing_enabled and settings.enrichment_model:
            use_enrichment_model = await self._route_intent(prompt, settings)
            if use_enrichment_model:
                yield sse_event("debug", {"step": "router", "route": "fast_enrichment_model"})
            else:
                yield sse_event("debug", {"step": "router", "route": "heavy_llm_model"})

        provider = build_llm_provider(settings, self.env, use_enrichment_model=use_enrichment_model)

        async for token in provider.stream_chat(llm_messages):
            yield sse_event("token", {"content": token})

        yield sse_event("sources", {"items": [source.model_dump() for source in sources]})
        yield sse_event("done", {"ok": True})

    async def _route_intent(self, prompt: str, settings: PersistedSettings) -> bool:
        # Returns True if it is a simple task that can use the fast enrichment model
        if not settings.semantic_routing_enabled or not settings.enrichment_model:
            return False

        router_prompt = (
            "Analyze this user query.\n"
            "If the query requires deep analytical reasoning, logic, cross-referencing multiple complex ideas, or heavy deductive capability, output 'heavy'.\n"
            "If the query is a simple factual question, a request to summarize, or a generic conversation, output 'fast'.\n"
            "Return JSON only in this format: {\"complexity\": \"heavy\"} or {\"complexity\": \"fast\"}.\n\n"
            f"User Query:\n{prompt}"
        )
        try:
            provider = build_llm_provider(settings, self.env, use_enrichment_model=True)
            response_text = await provider.generate_json(
                [ChatMessage(role="user", content=router_prompt)]
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
                return parsed.get("complexity", "heavy") == "fast"
        except Exception as exc:
            logger.warning("Agentic routing failed: %s", exc)
            
        return False

    def _build_messages(self, messages: list[ChatMessage], context: str) -> list[ChatMessage]:
        system_prompt = ChatMessage(
            role="system",
            content=(
                "You are a highly capable document-grounded assistant. Your goal is to answer the user's question using the provided Context. "
                "Be intelligent and draw reasonable deductions (for example, if the user asks about 'the future' or 'predictions', look for sections on 'trends' or 'upcoming changes'). "
                "If the context contains the answer in a tangential way, piece it together for the user. "
                "However, if the answer simply does not exist in the context whatsoever, state that clearly and do not make up facts. "
                "When referencing material, cite it inline using [1], [2], and so on."
                "\n\n"
                f"Context:\n{context}"
            ),
        )

        # Keep only prior user turns. Replaying previous assistant answers can
        # reinforce earlier hallucinations even when retrieval changes.
        filtered_messages = [message for message in messages if message.role == "user"]
        return [system_prompt, *filtered_messages]

    def _build_context(self, sources: list[SourceCitation]) -> str:
        blocks = []
        for index, source in enumerate(sources, start=1):
            created_at = f"\nCreated: {source.created_at}" if source.created_at else ""
            context_text = source.chunk_text or source.snippet
            blocks.append(f"[{index}] {source.filename}{created_at}\n{context_text}")
        return "\n\n".join(blocks)


def sse_event(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
