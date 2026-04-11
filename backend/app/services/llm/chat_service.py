from __future__ import annotations

import json
from typing import AsyncIterator

from app.core.config import EnvironmentSettings
from app.providers.llm_provider import build_llm_provider
from app.schemas.chat import ChatMessage, ChatRequest, SourceCitation
from app.schemas.settings import PersistedSettings
from app.services.retrieval_service import RetrievalService


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
        provider = build_llm_provider(settings, self.env)

        async for token in provider.stream_chat(llm_messages):
            yield sse_event("token", {"content": token})

        yield sse_event("sources", {"items": [source.model_dump() for source in sources]})
        yield sse_event("done", {"ok": True})

    def _build_messages(self, messages: list[ChatMessage], context: str) -> list[ChatMessage]:
        system_prompt = ChatMessage(
            role="system",
            content=(
                "You are a document-grounded assistant. Use only the provided context when it is relevant. "
                "If the answer is not supported by the context, say that clearly and do not guess. "
                "When you reference material, cite it inline using [1], [2], and so on."
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
