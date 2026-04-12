from __future__ import annotations

import json
import logging
import re
from typing import AsyncIterator

from app.core.config import EnvironmentSettings
from app.providers.llm_provider import build_llm_provider
from app.schemas.chat import ChatMessage, ChatRequest, SourceCitation
from app.schemas.settings import PersistedSettings
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger(__name__)

WORKSPACE_PATTERNS = [
    r"what (do|does|is|are) (we|our|this|the company|the business)",
    r"who (am|are) (i|we)",
    r"what('s| is) (our|my|this workspace)",
    r"about (us|our company|our business|this workspace)",
    r"what (can|do) you know about",
    r"our (company|business|team|product|service)",
]

AMBIGUOUS_PATTERNS = [
    r"^(what|who|when|where|why|how)\?*$",
    r"tell me (more|about it|about this)$",
    r"^(this|that|it|they)\?*$",
]

GENERAL_PATTERNS = [
    r"what (is|are) [a-z]+ \(?(definition|meaning|concept)",
    r"how does .+ work in general",
    r"explain .+ concept",
]

class ChatService:
    def __init__(
        self,
        env: EnvironmentSettings,
        retrieval_service: RetrievalService,
        memory_service: "MemoryService | None" = None,
    ) -> None:
        self.env = env
        self.retrieval_service = retrieval_service
        self.memory_service = memory_service

    async def stream_response(
        self,
        request: ChatRequest,
        settings: PersistedSettings,
    ) -> AsyncIterator[str]:
        prompt = request.latest_user_message
        if not prompt:
            raise ValueError("At least one user message is required")

        answer_type = self._classify_question(prompt)
        
        # Pronoun Resolution hint for Ambiguous questions
        if answer_type == "ambiguous" and len(request.messages) > 1:
            try:
                prev_q = request.messages[-3].content if len(request.messages) > 2 else ""
                prev_a = request.messages[-2].content[:200]
                prompt_hint = (
                    f"Previous context: user asked about [{prev_q}] and received answer [{prev_a}]. "
                    f"Current question likely refers to that."
                )
                search_query = f"{prompt_hint} {prompt}"
            except Exception:
                search_query = prompt
        else:
            search_query = prompt
        if settings.semantic_routing_enabled and settings.enrichment_model and answer_type != "ambiguous":
            search_query = await self._optimize_query(search_query, settings)
            if search_query != prompt:
                yield sse_event("debug", {"step": "optimizer", "original": prompt, "optimized": search_query})

        retrieval = await self.retrieval_service.retrieve(
            query=search_query,
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
            yield sse_event("meta", {"confidence": "none", "answer_type": answer_type})
            yield sse_event("token", {"content": empty_message})
            yield sse_event("sources", {"items": []})
            yield sse_event("done", {"ok": True})
            return

        yield sse_event("meta", {"confidence": retrieval.confidence, "answer_type": answer_type})

        if retrieval.debug is not None:
            yield sse_event("debug", retrieval.debug.model_dump())

        # Memory constraint (sub-setting history)
        context = self._build_context(sources)
        recent_messages = request.messages[-6:]  # Keep only last 6 messages

        # Fetch persistent memories if service is available
        memory_context = ""
        if self.memory_service:
            try:
                memory_context = await self.memory_service.get_memory_context()
            except Exception:
                pass

        llm_messages = self._build_messages(recent_messages, context, settings, memory_context=memory_context)
        
        # SMART ROUTING
        use_enrichment_model = False
        if settings.semantic_routing_enabled and settings.enrichment_model:
            use_enrichment_model = answer_type in ("fast", "factual", "ambiguous")
            if use_enrichment_model:
                yield sse_event("debug", {"step": "router", "route": "fast_enrichment_model"})
            else:
                yield sse_event("debug", {"step": "router", "route": "heavy_llm_model"})

        provider = build_llm_provider(settings, self.env, use_enrichment_model=use_enrichment_model)

        async for token in provider.stream_chat(llm_messages):
            yield sse_event("token", {"content": token})

        yield sse_event("sources", {"items": [source.model_dump() for source in sources]})
        yield sse_event("done", {"ok": True})

    async def _optimize_query(self, prompt: str, settings: PersistedSettings) -> str:
        if not settings.semantic_routing_enabled or not settings.enrichment_model:
            return prompt

        optimizer_prompt = (
            "You are a search query optimizer. The user provides a query that may contain typos or "
            "poor formatting which breaks mathematical vector embeddings. "
            "Fix any typographical errors (e.g., 'pyhton' -> 'python', 'docment' -> 'document'). "
            "Do NOT add new information or completely rewrite the intent. "
            "Return JSON only in this format: {\"optimized_query\": \"the corrected query\"}.\n\n"
            f"User Query:\n{prompt}"
        )
        try:
            provider = build_llm_provider(settings, self.env, use_enrichment_model=True)
            response_text = await provider.generate_json(
                [ChatMessage(role="user", content=optimizer_prompt)]
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
                return parsed.get("optimized_query", prompt).strip()
        except Exception as exc:
            logger.warning("Query optimization failed: %s", exc)
            
        return prompt

    def _classify_question(self, message: str) -> str:
        lower = message.lower().strip()
        
        for pattern in WORKSPACE_PATTERNS:
            if re.search(pattern, lower):
                return "workspace"
        
        for pattern in AMBIGUOUS_PATTERNS:
            if re.search(pattern, lower):
                return "ambiguous"
        
        for pattern in GENERAL_PATTERNS:
            if re.search(pattern, lower):
                return "general"
        
        if any(word in lower for word in ["compare", "difference", "versus", "vs"]):
            return "analytical"
        
        if any(word in lower for word in ["how to", "steps", "process", "procedure"]):
            return "procedural"
        
        return "factual"

    def _build_messages(self, messages: list[ChatMessage], context: str, settings: PersistedSettings | None = None, memory_context: str = "") -> list[ChatMessage]:
        workspace_name = ""
        user_name = ""
        if settings:
            workspace_name = getattr(settings, "workspace_name", "") or ""
            user_name = getattr(settings, "user_name", "") or ""
        
        # Derive user_name from workspace_name only if it looks like a first name
        if not user_name and workspace_name:
            parts = workspace_name.strip().split()
            if len(parts) == 1 and parts[0][0].isupper() and parts[0].isalpha():
                user_name = parts[0]
        
        identity_block = ""
        if workspace_name:
            identity_block += f"You are the AI assistant for the workspace called '{workspace_name}'.\n"
        if user_name:
            identity_block += f"The user's name is {user_name}. Address the user as {user_name}, not as the workspace.\n"
        if workspace_name and user_name:
            identity_block += "Do not confuse the workspace name with the user's name.\n"

        # Memory block (persistent facts across conversations)
        memory_block = ""
        if memory_context:
            memory_block = f"\n{memory_context}\n"

        system_prompt = ChatMessage(
            role="system",
            content=(
                f"{identity_block}"
                f"{memory_block}"
                "You are a highly capable document-grounded assistant. Your goal is to answer the user's question using the provided Context. "
                "Be intelligent and draw reasonable deductions (for example, if the user asks about 'the future' or 'predictions', look for sections on 'trends' or 'upcoming changes'). "
                "If the context contains the answer in a tangential way, piece it together for the user. "
                "However, if the answer simply does not exist in the context whatsoever, state that clearly and do not make up facts.\n\n"
                "CITATION FORMAT: Always cite as [filename.ext, p.X] or [filename.ext]. "
                "NEVER use [1], [2], [3] or any numeric citation format. "
                "Citations appear inline at the end of the sentence that uses that source. "
                "Example: 'The deadline was set for March [WORKFLOW.md, p.2]'\n\n"
                f"Context:\n{context}"
            ),
        )

        # Pass the full conversation history. Stripping assistant messages causes 
        # consecutive user prompts which deeply confuses the LLM's conversational timeline.
        return [system_prompt, *messages]

    def _build_context(self, sources: list[SourceCitation]) -> str:
        blocks = []
        for source in sources:
            created_at = f"\nCreated: {source.created_at}" if source.created_at else ""
            page_info = f", page {source.page}" if source.page else ""
            similarity = f", similarity: {source.similarity_percent}" if source.similarity_percent else ""
            context_text = source.chunk_text or source.snippet
            blocks.append(f"Source: {source.filename}{page_info}{similarity}{created_at}\n{context_text}")
        return "\n\n".join(blocks)


def sse_event(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
