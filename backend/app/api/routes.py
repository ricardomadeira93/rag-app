from __future__ import annotations

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
)
from app.schemas.documents import (
    DeleteDocumentResponse,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentRecord,
    ReindexResponse,
    StatusUpdateRequest,
    UploadResponse,
)
from app.schemas.settings import PersistedSettings, SettingsUpdate
import logging

from app.schemas.storage import DiskUsageResponse, StorageUsageResponse
from app.services.conversation_service import ConversationService
from app.services.document_service import DocumentService
from app.services.ingestion.pipeline import IngestionPipeline
from app.services.llm.chat_service import ChatService, sse_event
from app.services.llm.ollama_client import build_ollama_client
from app.services.settings_service import SettingsService
from app.services.storage_service import StorageService
from app.services.vectorstore.chroma_store import ChromaVectorStore

router = APIRouter()
logger = logging.getLogger(__name__)


@dataclass
class ServiceContainer:
    settings: SettingsService
    documents: DocumentService
    ingestion: IngestionPipeline
    chat: ChatService
    conversations: ConversationService
    vector_store: ChromaVectorStore


def get_container(request: Request) -> ServiceContainer:
    return request.app.state.container


def ensure_index_compatible(settings: PersistedSettings) -> None:
    if settings.reindex_required:
        raise HTTPException(
            status_code=409,
            detail="Embedding settings changed. Re-index documents before uploading or chatting.",
        )


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
                await container.conversations.append_message(
                    conv_id, "user", payload.latest_user_message, []
                )
                await container.conversations.append_message(
                    conv_id, "assistant", "".join(assistant_tokens), final_sources
                )
            except Exception:
                pass  # persistence failure must never break the chat response

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/documents", response_model=DocumentListResponse)
async def get_documents(request: Request) -> DocumentListResponse:
    container = get_container(request)
    documents = container.documents.list_documents()
    return DocumentListResponse(items=documents, total=len(documents))


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
    client = build_ollama_client(base_url)
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


@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    request: Request, payload: CreateConversationRequest
) -> ConversationSummary:
    container = get_container(request)
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
