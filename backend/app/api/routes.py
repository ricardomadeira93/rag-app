from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.schemas.chat import ChatRequest
from app.schemas.conversations import (
    AppendMessageRequest,
    ConversationSummary,
    CreateConversationRequest,
    PersistedMessage,
    RateMessageRequest,
    RenameConversationRequest,
)
from app.schemas.documents import (
    DeleteDocumentResponse,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentRecord,
    ReindexResponse,
    StatusUpdateRequest,
    UploadResponse,
    AddEdgeRequest,
    EdgeListResponse,
)
from app.schemas.settings import PersistedSettings, SettingsUpdate
from app.schemas.workspaces import CreateWorkspaceRequest, WorkspaceSummary
import logging

from app.schemas.storage import DiskUsageResponse, StorageUsageResponse
from app.services.conversation_service import ConversationService
from app.services.document_service import DocumentService
from app.services.ingestion.pipeline import IngestionPipeline
from app.services.llm.chat_service import ChatService, sse_event
from app.services.llm.ollama_client import build_ollama_client
from app.services.settings_service import SettingsService
from app.services.storage_service import StorageService
from app.services.vectorstore.base import VectorStore

router = APIRouter()
logger = logging.getLogger(__name__)


from app.services.vectorstore.bm25_store import BM25Store
from app.services.vectorstore.cross_encoder import CrossEncoderService
from app.services.workspace_service import WorkspaceService

from app.services.graph_db import GraphDBService

@dataclass
class ServiceContainer:
    workspaces: WorkspaceService
    settings: SettingsService
    documents: DocumentService
    ingestion: IngestionPipeline
    chat: ChatService
    conversations: ConversationService
    vector_store: VectorStore
    memory: "MemoryService"
    bm25_store: BM25Store
    cross_encoder: CrossEncoderService
    graph_service: GraphDBService


def get_container(request: Request) -> ServiceContainer:
    return request.app.state.container


def ensure_index_compatible(settings: PersistedSettings) -> None:
    if settings.reindex_required:
        raise HTTPException(
            status_code=409,
            detail="Embedding settings changed. Re-index documents before uploading or chatting.",
        )


@router.get("/workspaces", response_model=list[WorkspaceSummary])
async def list_workspaces(request: Request) -> list[WorkspaceSummary]:
    container = get_container(request)
    return await container.workspaces.list_workspaces()


@router.post("/workspaces", response_model=WorkspaceSummary)
async def create_workspace(request: Request, payload: CreateWorkspaceRequest) -> WorkspaceSummary:
    container = get_container(request)
    return await container.workspaces.create_workspace(payload.name, payload.description)


@router.post("/workspaces/{workspace_id}/select", response_model=WorkspaceSummary)
async def select_workspace(request: Request, workspace_id: str) -> WorkspaceSummary:
    container = get_container(request)
    workspace = await container.workspaces.select_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.post("/upload", response_model=UploadResponse)
async def upload_documents(request: Request, files: list[UploadFile] = File(...)) -> UploadResponse:
    container = get_container(request)
    settings = container.settings.get_settings()
    ensure_index_compatible(settings)

    try:
        documents = await container.ingestion.ingest_uploads(files, settings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return UploadResponse(items=documents, total=len(documents))


@router.post("/chat")
async def chat(request: Request, payload: ChatRequest) -> StreamingResponse:
    container = get_container(request)
    settings = container.settings.get_settings()
    ensure_index_compatible(settings)

    # Buffers for persistence — populated as the stream passes through
    assistant_tokens: list[str] = []
    final_sources: list[dict] = []
    final_meta: dict[str, object] = {}

    async def stream() -> object:
        try:
            async for event in container.chat.stream_response(payload, settings):
                # Tap into the stream to collect tokens and sources for persistence
                if event.startswith("event: token"):
                    try:
                        data = json.loads(event.split("data: ", 1)[1])
                        assistant_tokens.append(data.get("content", ""))
                    except Exception:
                        pass
                elif event.startswith("event: sources"):
                    try:
                        data = json.loads(event.split("data: ", 1)[1])
                        final_sources.extend(data.get("items", []))
                    except Exception:
                        pass
                elif event.startswith("event: meta"):
                    try:
                        final_meta.update(json.loads(event.split("data: ", 1)[1]))
                    except Exception:
                        pass
                yield event
        except ValueError as exc:
            yield sse_event("error", {"message": str(exc)})
            yield sse_event("done", {"ok": False})
        except Exception as exc:
            yield sse_event("error", {"message": f"Chat failed: {exc}"})
            yield sse_event("done", {"ok": False})

        # Persist after stream completes, if conversation_id is set
        if payload.conversation_id and payload.latest_user_message:
            conv_id = payload.conversation_id
            try:
                if not payload.rerun:
                    await container.conversations.append_message(
                        conv_id, "user", payload.latest_user_message, []
                    )
                await container.conversations.append_message(
                    conv_id,
                    "assistant",
                    "".join(assistant_tokens),
                    final_sources,
                    mode_used=str(final_meta.get("mode_used")) if final_meta.get("mode_used") else None,
                    mode_auto_detected=(
                        bool(final_meta["mode_auto_detected"])
                        if "mode_auto_detected" in final_meta
                        else None
                    ),
                )
            except Exception:
                pass  # persistence failure must never break the chat response

            # Extract memories asynchronously (non-blocking, best-effort)
            msgs = [{"role": m.role, "content": m.content} for m in payload.messages[-4:]]
            msgs.append({"role": "assistant", "content": "".join(assistant_tokens)})
            asyncio.create_task(container.memory.extract_and_store(msgs, conv_id, settings))

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/documents", response_model=DocumentListResponse)
async def get_documents(request: Request) -> DocumentListResponse:
    container = get_container(request)
    documents = container.documents.list_documents()
    return DocumentListResponse(items=documents, total=len(documents))


@router.get("/documents/tags")
async def list_document_tags(request: Request) -> list[str]:
    container = get_container(request)
    return container.documents.list_all_tags()


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document_detail(request: Request, document_id: str) -> DocumentDetailResponse:
    container = get_container(request)
    document = container.documents.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    content: str | None = None
    if document.extracted_text_path:
        extracted_path = Path(document.extracted_text_path)
        if extracted_path.exists():
            content = extracted_path.read_text(encoding="utf-8")

    file_size_bytes: int | None = None
    source_path = Path(document.source_path)
    if source_path.exists():
        file_size_bytes = source_path.stat().st_size

    return DocumentDetailResponse(item=document, content=content, file_size_bytes=file_size_bytes)


@router.get("/documents/{document_id}/file")
async def download_document_file(request: Request, document_id: str) -> FileResponse:
    container = get_container(request)
    document = container.documents.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    source_path = Path(document.source_path)
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")

    return FileResponse(path=source_path, media_type=document.mime_type, filename=document.filename)


@router.patch("/documents/{document_id}/status", response_model=DocumentRecord)
async def update_document_status(request: Request, document_id: str, payload: StatusUpdateRequest) -> DocumentRecord:
    container = get_container(request)
    updated = container.documents.update_status(document_id, payload.status)
    if updated is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return updated


@router.delete("/documents/{document_id}", response_model=DeleteDocumentResponse)
async def delete_document(request: Request, document_id: str) -> DeleteDocumentResponse:
    container = get_container(request)
    deleted = container.ingestion.delete_document(document_id)
    if deleted is None:
        raise HTTPException(status_code=404, detail="Document not found")

    return DeleteDocumentResponse(id=document_id, deleted=True)


@router.post("/documents/{document_id}/relationships", response_model=dict)
async def add_document_relationship(request: Request, document_id: str, payload: AddEdgeRequest) -> dict:
    container = get_container(request)
    edge = await container.graph_service.add_edge(
        source=document_id,
        target=payload.target_doc_id,
        rel_type=payload.relationship_type,
        desc=payload.description
    )
    return edge.model_dump()


@router.get("/documents/{document_id}/relationships", response_model=EdgeListResponse)
async def get_document_relationships(request: Request, document_id: str) -> EdgeListResponse:
    container = get_container(request)
    edges = await container.graph_service.get_edges(document_id)
    return EdgeListResponse(items=[e.model_dump() for e in edges])


@router.delete("/documents/relationships/{edge_id}")
async def delete_document_relationship(request: Request, edge_id: str) -> dict:
    container = get_container(request)
    success = await container.graph_service.delete_edge(edge_id)
    if not success:
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"id": edge_id, "deleted": True}


@router.patch("/documents/{document_id}/tags", response_model=DocumentRecord)
async def update_document_tags(
    request: Request, document_id: str, payload: dict
) -> DocumentRecord:
    container = get_container(request)
    tags = payload.get("tags", [])
    if not isinstance(tags, list):
        raise HTTPException(status_code=400, detail="tags must be an array")
    updated = container.documents.update_tags(document_id, tags)
    if updated is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return updated


@router.post("/reindex", response_model=ReindexResponse)
async def reindex_documents(request: Request) -> ReindexResponse:
    container = get_container(request)
    settings = container.settings.get_settings()

    try:
        documents = await container.ingestion.reindex_all(settings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    container.settings.mark_reindexed()
    refreshed = container.settings.get_settings()
    return ReindexResponse(
        indexed_documents=len(documents),
        embedding_signature=refreshed.embedding_signature,
    )


@router.get("/settings")
async def get_settings(request: Request) -> object:
    container = get_container(request)
    return container.settings.to_response(indexed_documents=container.documents.count())


@router.post("/settings")
async def update_settings(request: Request, payload: SettingsUpdate) -> object:
    container = get_container(request)
    settings = container.settings.update_settings(payload, indexed_documents=container.documents.count())
    return container.settings.to_response(indexed_documents=container.documents.count())


@router.get("/ollama/status")
async def get_ollama_status(request: Request) -> object:
    container = get_container(request)
    settings = container.settings.get_settings()
    base_url = settings.llm_base_url if settings.llm_provider == "ollama" and settings.llm_base_url else request.app.state.env.ollama_base_url
    client = build_ollama_client(base_url, keep_alive=request.app.state.env.ollama_keep_alive)
    return await client.check_status()


@router.get("/storage/usage", response_model=StorageUsageResponse)
async def get_storage_usage(request: Request) -> StorageUsageResponse:
    container = get_container(request)
    service = StorageService(
        env=request.app.state.env,
        document_service=container.documents,
        vector_store=container.vector_store,
    )
    try:
        return service.get_usage()
    except Exception:
        logger.exception("Failed to compute storage usage.")
        return StorageUsageResponse(
            total_bytes=0,
            chroma_bytes=0,
            files_bytes=0,
            document_count=0,
            chunk_count=0,
            documents=[],
        )


@router.get("/storage/disk", response_model=DiskUsageResponse)
async def get_disk_usage(request: Request) -> DiskUsageResponse:
    return StorageService.disk_usage(request.app.state.env)


# ── Conversations ──────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(request: Request) -> list[ConversationSummary]:
    container = get_container(request)
    return await container.conversations.list_conversations()

@router.get("/conversations/{conversation_id}", response_model=ConversationSummary)
async def get_conversation(request: Request, conversation_id: str) -> ConversationSummary:
    container = get_container(request)
    summary = await container.conversations.get_conversation(conversation_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return summary


@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    request: Request, payload: CreateConversationRequest
) -> ConversationSummary:
    container = get_container(request)
    settings = container.settings.get_settings()
    try:
        await container.memory.summarize_latest_conversation_before_new(settings)
    except Exception:
        pass
    return await container.conversations.create_conversation(payload.title)


@router.get("/conversations/{conversation_id}/messages", response_model=list[PersistedMessage])
async def get_conversation_messages(
    request: Request, conversation_id: str
) -> list[PersistedMessage]:
    container = get_container(request)
    return await container.conversations.get_messages(conversation_id)


@router.post("/conversations/{conversation_id}/messages", response_model=PersistedMessage)
async def append_conversation_message(
    request: Request, conversation_id: str, payload: AppendMessageRequest
) -> PersistedMessage:
    container = get_container(request)
    return await container.conversations.append_message(
        conversation_id, payload.role, payload.content, payload.sources
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(request: Request, conversation_id: str) -> dict[str, bool]:
    container = get_container(request)
    deleted = await container.conversations.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True}


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
async def rename_conversation(
    request: Request, conversation_id: str, payload: RenameConversationRequest
) -> ConversationSummary:
    container = get_container(request)
    result = await container.conversations.rename_conversation(conversation_id, payload.title)
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


@router.post("/conversations/{conversation_id}/pin", response_model=ConversationSummary)
async def toggle_pin_conversation(request: Request, conversation_id: str) -> ConversationSummary:
    container = get_container(request)
    result = await container.conversations.toggle_pin(conversation_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


@router.get("/conversations/{conversation_id}/search", response_model=list[PersistedMessage])
async def search_conversation_messages(
    request: Request, conversation_id: str, q: str = ""
) -> list[PersistedMessage]:
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    container = get_container(request)
    return await container.conversations.search_messages(conversation_id, q.strip())


@router.post("/messages/{message_id}/rate")
async def rate_message(request: Request, message_id: str, payload: RateMessageRequest) -> dict[str, bool]:
    container = get_container(request)
    success = await container.conversations.rate_message(message_id, payload.rating)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True}


# ── Memories ───────────────────────────────────────────────────────────────────

@router.get("/memories")
async def list_memories(request: Request) -> list[dict]:
    container = get_container(request)
    memories = await container.memory.list_memories()
    return [memory.__dict__ for memory in memories]


@router.get("/memory/summaries")
async def list_memory_summaries(request: Request) -> list[dict]:
    container = get_container(request)
    summaries = await container.memory.list_summaries()
    return [summary.__dict__ for summary in summaries]


@router.get("/memory/preferences")
async def list_memory_preferences(request: Request) -> list[dict]:
    container = get_container(request)
    preferences = await container.memory.list_preferences()
    return [preference.__dict__ for preference in preferences]


@router.delete("/memories/{memory_id}")
async def deactivate_memory(request: Request, memory_id: str) -> dict[str, bool]:
    container = get_container(request)
    success = await container.memory.deactivate_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}
