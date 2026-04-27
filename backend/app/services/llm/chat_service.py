from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

from app.core.config import EnvironmentSettings
from app.providers.llm_provider import build_llm_provider
from app.schemas.chat import ChatMessage, ChatRequest, MetaPayload, SourceCitation
from app.schemas.settings import PersistedSettings
from app.services.query_classifier import (
    ResponseMode,
    classify_question,
    detect_response_mode,
    get_explicit_doc_names,
    is_comparison_query,
    is_contradiction_query,
)
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger(__name__)

COMPARISON_INSTRUCTIONS = """
## Comparison mode — you are analyzing ALL provided documents

Rules for comparison responses:
1. Reference EVERY document provided — do not skip any
2. Use document names as headers or inline references: WORKFLOW.md, Design.md etc.
3. Structure your response:
   - Start with: what all documents have in common (if anything)
   - Then: what makes each document unique
   - Then: your overall synthesis across all documents
4. If documents are unrelated: say so clearly and explain what each covers
5. If one document is clearly more relevant to the question: lead with it,
   but still mention the others
6. End with: "Analyzed X documents" so the user knows the full scope

Do NOT say "based on the provided context [1][2]"
Do say "Across your 8 documents..." or "WORKFLOW.md covers X while Design.md covers Y"
"""

CONTRADICTION_PROMPT = """
Analyze these document excerpts and identify any contradictions,
inconsistencies, or conflicting information.

Look for:
- Different facts stated about the same thing
- Conflicting decisions or approaches
- Version conflicts (old info vs new info)
- Unclear ownership or responsibility

Return JSON only in this shape:
{
  "summary": "short conclusion",
  "conflicts": [
    {
      "conflict": "what the conflict is",
      "document_a": "filename",
      "document_b": "filename",
      "document_a_excerpt": "quote or paraphrase",
      "document_b_excerpt": "quote or paraphrase",
      "impact": "why this matters / which is likely correct"
    }
  ]
}

If no contradictions exist, return:
{
  "summary": "No conflicts found",
  "conflicts": []
}

Documents to analyze:
{context}
"""

DRAFT_SYSTEM_ADDITION = """
You are writing a draft based on the user's knowledge base.
Rules for drafting:
1. Base ALL facts, decisions, and context on the retrieved documents
2. Do not invent information not present in the sources
3. Match the requested format exactly (email, spec, brief, etc.)
4. After the draft, add a separator line and note:
   "Sources used: [list of filenames]"
   "Note: Review the following sections which needed assumptions: [list or 'None']"
5. Keep the draft and the notes clearly separated
""".strip()

RESPONSE_MODE_INSTRUCTIONS: dict[ResponseMode, str] = {
    "answer": """
Respond with a direct, well-structured answer.
Cite sources inline as [filename, p.X].
Length follows user preference setting.
""".strip(),
    "summary": """
Produce a structured summary with these sections:
**Overview** (2-3 sentences)
**Key points** (bullet list, 5-8 points)
**Conclusion** (1-2 sentences)
Be specific — use names, numbers, dates from the documents.
Do not pad or repeat. Every bullet must add new information.
""".strip(),
    "extract": """
Extract and list the requested items clearly.
Use a numbered or bulleted list.
Each item: one line, specific, no padding.
At the end: "Found X items across Y documents"
If nothing found: say so directly and suggest what to upload.
""".strip(),
    "action_items": """
Extract all action items, tasks, todos, and next steps from the documents.
Format as a checklist:
[ ] [owner if mentioned] Task description — [source, p.X]

Group by: Immediate / Short-term / Long-term if applicable.
If no explicit tasks found: infer implied actions from the content.
End with: "X action items found across Y documents"
""".strip(),
    "timeline": """
Extract all dates, deadlines, events, and milestones from the documents.
Format chronologically:

[DATE/PERIOD] — Event or milestone — [source]

If exact dates are missing, use relative terms: "Before launch", "Q1", "After approval"
Group by: Past / Current / Upcoming if helpful.
End with a one-sentence summary of the overall timeline.
""".strip(),
    "draft": """
Write the requested document, email, or content based on the knowledge base.
Use the documents as source material — facts, decisions, context.
Match the tone requested or infer from the workspace context.
After the draft: add a brief note on what sources you drew from.
Keep the draft clearly separated from the note.
""".strip(),
    "gaps": """
Analyze the documents and identify:
**Missing information**: What should be here but isn't?
**Unclear sections**: What is ambiguous or contradictory?
**Open questions**: What decisions haven't been made yet?
**Recommendations**: What should be added or clarified?

Be specific — reference exact sections or document names.
This is a critical analysis, not a summary.
""".strip(),
}

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

        answer_type = classify_question(prompt)
        response_mode = request.mode or detect_response_mode(prompt)
        mode_auto_detected = request.mode is None
        comparison_mode = is_comparison_query(prompt)
        contradiction_mode = is_contradiction_query(prompt)
        if contradiction_mode:
            answer_type = "contradiction"
        
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
        if request.tags:
            search_query = f"{search_query}\n\nTopic focus: {', '.join(request.tags)}"
        if settings.semantic_routing_enabled and settings.enrichment_model and answer_type != "ambiguous" and not comparison_mode:
            search_query = await self._optimize_query(search_query, settings)
            if search_query != prompt:
                yield sse_event("debug", {"step": "optimizer", "original": prompt, "optimized": search_query})

        effective_filters = self._merge_request_filters(request)

        if contradiction_mode or comparison_mode:
            all_docs = self.retrieval_service.get_all_document_names(effective_filters)
            explicit_docs = get_explicit_doc_names(prompt, all_docs)
            retrieval = await self.retrieval_service.comparison_retrieve(
                query=prompt,
                settings=settings,
                filters=effective_filters,
                explicit_doc_names=explicit_docs if explicit_docs else None,
                max_docs=10,
                chars_per_doc=800,
                debug=request.debug,
                workspace_id=request.workspace_id,
            )
        elif response_mode == "action_items":
            retrieval = await self.retrieval_service.action_item_retrieve(
                query=search_query,
                settings=settings,
                filters=effective_filters,
                debug=request.debug,
                workspace_id=request.workspace_id,
            )
        else:
            retrieval = await self.retrieval_service.retrieve(
                query=search_query,
                settings=settings,
                filters=effective_filters,
                debug=request.debug,
                workspace_id=request.workspace_id,
            )
        retrieval.sources = await self._prepend_mentioned_sources(
            prompt=prompt,
            settings=settings,
            sources=retrieval.sources,
            mentioned_doc_ids=request.mentioned_doc_ids,
            limit=max(settings.top_k, 8),
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
            yield sse_event(
                "meta",
                MetaPayload(
                    confidence="none",
                    answer_type=answer_type,
                    mode_used=response_mode,
                    mode_auto_detected=mode_auto_detected,
                ).model_dump(),
            )
            yield sse_event("token", {"content": empty_message})
            yield sse_event("sources", {"items": []})
            yield sse_event("done", {"ok": True})
            return

        meta_payload = MetaPayload(
            confidence=retrieval.confidence,  # type: ignore[arg-type]
            answer_type=answer_type,
            mode_used=response_mode,
            mode_auto_detected=mode_auto_detected,
            analyzed_documents=len(retrieval.comparison["documents"]) if retrieval.comparison else None,
            total_documents=retrieval.comparison["total_docs"] if retrieval.comparison else None,
            truncated=bool(retrieval.comparison["truncated"]) if retrieval.comparison else False,
            message=retrieval.comparison["message"] if retrieval.comparison else None,
        )
        yield sse_event("meta", meta_payload.model_dump())

        if retrieval.debug is not None:
            yield sse_event("debug", retrieval.debug.model_dump())

        if contradiction_mode and retrieval.comparison:
            provider = build_llm_provider(settings, self.env, use_enrichment_model=False)
            analysis = await self._analyze_contradictions(provider, retrieval.comparison)
            self._persist_conflicts(analysis)
            yield sse_event("token", {"content": self._format_contradiction_analysis(analysis)})
            yield sse_event("sources", {"items": [source.model_dump() for source in sources]})
            yield sse_event("done", {"ok": True})
            return

        # Memory constraint (sub-setting history)
        context = (
            self.retrieval_service.format_comparison_context(retrieval.comparison)
            if retrieval.comparison
            else self._build_context(sources)
        )
        recent_messages = request.messages[-6:]  # Keep only last 6 messages

        # Fetch persistent memories if service is available
        memory_context = ""
        if self.memory_service:
            try:
                memory_context = await self.memory_service.get_memory_context(prompt)
            except Exception:
                pass

        llm_messages = self._build_messages(
            recent_messages,
            context,
            settings,
            answer_type=answer_type,
            response_mode=response_mode,
            memory_context=memory_context,
        )
        
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

    def _merge_request_filters(self, request: ChatRequest):
        base_filters = request.filters.model_copy(deep=True) if request.filters else None
        document_service = self.retrieval_service.document_service

        scoped_ids = [doc_id for doc_id in request.scoped_doc_ids if doc_id]
        tag_doc_ids: list[str] = []
        if request.tags and document_service:
            normalized_tags = {tag.strip().lower() for tag in request.tags if tag.strip()}
            for document in document_service.list_documents():
                doc_tags = {tag.strip().lower() for tag in document.tags}
                if normalized_tags.intersection(doc_tags):
                    tag_doc_ids.append(document.id)

        doc_ids = list(base_filters.document_ids) if base_filters else []
        if scoped_ids:
            doc_ids = [doc_id for doc_id in doc_ids if doc_id in scoped_ids] if doc_ids else scoped_ids
        if tag_doc_ids:
            doc_ids = [doc_id for doc_id in doc_ids if doc_id in tag_doc_ids] if doc_ids else tag_doc_ids

        if not base_filters and (doc_ids or scoped_ids):
            from app.schemas.chat import ChatFilters

            base_filters = ChatFilters(document_ids=doc_ids)
        elif base_filters:
            base_filters.document_ids = doc_ids

        return base_filters

    async def _prepend_mentioned_sources(
        self,
        prompt: str,
        settings: PersistedSettings,
        sources: list[SourceCitation],
        mentioned_doc_ids: list[str],
        limit: int,
    ) -> list[SourceCitation]:
        if not mentioned_doc_ids:
            return sources

        mentioned_hits: list[SourceCitation] = []
        seen_ids = {source.id for source in sources}
        try:
            query_vector = await self.retrieval_service.embedding_service.embed_query(settings, prompt)
        except Exception:
            query_vector = None

        for doc_id in mentioned_doc_ids:
            try:
                if query_vector is None:
                    continue
                matches = self.retrieval_service.vector_store.query(
                    query_embedding=query_vector,
                    top_k=2,
                    filters={"document_id": {"$eq": doc_id}},
                )
                mentioned_hits.extend(matches)
            except Exception:
                continue

        if not mentioned_hits:
            ordered = [source for source in sources if source.document_id in mentioned_doc_ids]
            ordered.extend(source for source in sources if source.document_id not in mentioned_doc_ids)
            return ordered[:limit]

        ordered: list[SourceCitation] = []
        for source in mentioned_hits + sources:
            if source.id in seen_ids and source not in mentioned_hits:
                continue
            seen_ids.add(source.id)
            ordered.append(source)
        return ordered[:limit]

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

    def _build_messages(
        self,
        messages: list[ChatMessage],
        context: str,
        settings: PersistedSettings | None = None,
        answer_type: str = "factual",
        response_mode: ResponseMode = "answer",
        memory_context: str = "",
    ) -> list[ChatMessage]:
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

        comparison_block = f"\n{COMPARISON_INSTRUCTIONS}\n" if answer_type == "comparison" else ""
        response_mode_block = f"\n{RESPONSE_MODE_INSTRUCTIONS[response_mode]}\n"
        draft_block = f"\n{DRAFT_SYSTEM_ADDITION}\n" if response_mode == "draft" else ""

        system_prompt = ChatMessage(
            role="system",
            content=(
                f"{identity_block}"
                f"{memory_block}"
                f"{comparison_block}"
                f"{response_mode_block}"
                f"{draft_block}"
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

    async def _analyze_contradictions(self, provider: Any, comparison: dict[str, Any]) -> dict[str, Any]:
        context = self.retrieval_service.format_comparison_context(comparison)
        raw = await provider.generate_json([ChatMessage(role="user", content=CONTRADICTION_PROMPT.format(context=context))])
        try:
            data = json.loads(raw)
        except Exception:
            return {"summary": "No conflicts found", "conflicts": []}

        documents_by_name = {
            str(document["source"]): str(document["document_id"])
            for document in comparison.get("documents", [])
            if document.get("source") and document.get("document_id")
        }
        for conflict in data.get("conflicts", []):
            conflict["document_a_id"] = documents_by_name.get(str(conflict.get("document_a", "")))
            conflict["document_b_id"] = documents_by_name.get(str(conflict.get("document_b", "")))
        return data

    def _format_contradiction_analysis(self, analysis: dict[str, Any]) -> str:
        conflicts = analysis.get("conflicts", [])
        if not conflicts:
            return f"{analysis.get('summary', 'No conflicts found')}\n\nNo conflicts found."

        lines = [analysis.get("summary", "Conflicts found"), ""]
        for index, conflict in enumerate(conflicts, start=1):
            lines.append(f"## Conflict {index}")
            lines.append(f"Conflict: {conflict.get('conflict', 'Unspecified conflict')}")
            lines.append(
                f"Document A: {conflict.get('document_a', 'Unknown')} says: {conflict.get('document_a_excerpt', 'No excerpt')}"
            )
            lines.append(
                f"Document B: {conflict.get('document_b', 'Unknown')} says: {conflict.get('document_b_excerpt', 'No excerpt')}"
            )
            lines.append(f"Impact: {conflict.get('impact', 'No impact provided')}")
            lines.append("")
        return "\n".join(lines).strip()

    def _persist_conflicts(self, analysis: dict[str, Any]) -> None:
        document_service = self.retrieval_service.document_service
        if not document_service:
            return

        conflicts = analysis.get("conflicts", [])
        if not conflicts:
            return

        updates: dict[str, list[dict[str, Any]]] = {}
        for conflict in conflicts:
            doc_a_id = conflict.get("document_a_id")
            doc_b_id = conflict.get("document_b_id")
            if not doc_a_id or not doc_b_id:
                continue
            updates.setdefault(doc_a_id, []).append(
                {
                    "doc_id": doc_b_id,
                    "filename": conflict.get("document_b"),
                    "reason": conflict.get("conflict"),
                }
            )
            updates.setdefault(doc_b_id, []).append(
                {
                    "doc_id": doc_a_id,
                    "filename": conflict.get("document_a"),
                    "reason": conflict.get("conflict"),
                }
            )

        for document_id, items in updates.items():
            deduped: list[dict[str, Any]] = []
            seen: set[str] = set()
            for item in items:
                key = f"{item.get('doc_id')}::{item.get('reason')}"
                if key in seen:
                    continue
                seen.add(key)
                deduped.append(item)
            document_service.update_conflicting_docs(document_id, deduped[:5])

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
