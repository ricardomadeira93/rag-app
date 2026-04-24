from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.settings import EmbeddingSignature

DocumentStatus = Literal["processing", "indexed", "failed", "needs_reprocessing"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DocumentRecord(BaseModel):
    id: str
    filename: str
    mime_type: str
    file_type: str
    extension: str
    checksum: str
    source_path: str
    extracted_text_path: Optional[str] = None
    chunk_count: int = 0
    source_type: str = "upload" # generic file upload default
    source_connector: str = "manual" # manual or live
    doc_type: str = "file" # generic classification
    embedding_provider: str
    embedding_model: str
    embedding_version: str
    summary: str | None = None
    document_type: str | None = None
    topics: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)  # user-defined tags for organization
    related_docs: list[dict] = Field(default_factory=list)
    conflicting_docs: list[dict] = Field(default_factory=list)
    # Status tracking — defaults to "indexed" so pre-existing records need no migration
    status: DocumentStatus = "indexed"
    indexed_at: str | None = None
    error_message: str | None = None
    # Storage tracking — defaults to 0 for pre-existing records
    file_size_bytes: int = 0
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)

    @property
    def embedding_signature(self) -> EmbeddingSignature:
        return EmbeddingSignature(
            provider=self.embedding_provider,  # type: ignore[arg-type]
            model=self.embedding_model,
            version=self.embedding_version,
        )


class StatusUpdateRequest(BaseModel):
    status: DocumentStatus


class DocumentListResponse(BaseModel):
    items: list[DocumentRecord]
    total: int


class UploadResponse(BaseModel):
    items: list[DocumentRecord]
    total: int


class ReindexResponse(BaseModel):
    indexed_documents: int
    embedding_signature: EmbeddingSignature

class AddEdgeRequest(BaseModel):
    target_doc_id: str
    relationship_type: str
    description: str | None = None

class EdgeListResponse(BaseModel):
    items: list[dict] # We can just dump EdgeDicts or import DocumentEdge inside routes


class DeleteDocumentResponse(BaseModel):
    id: str
    deleted: bool


class DocumentDetailResponse(BaseModel):
    item: DocumentRecord
    content: str | None = None
    file_size_bytes: int | None = None
