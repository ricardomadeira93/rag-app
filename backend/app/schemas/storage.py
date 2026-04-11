from __future__ import annotations

from pydantic import BaseModel


class StorageDocumentItem(BaseModel):
    id: str
    name: str
    file_size_bytes: int
    chunk_count: int
    indexed_at: str | None


class StorageUsageResponse(BaseModel):
    total_bytes: int
    chroma_bytes: int
    files_bytes: int
    document_count: int
    chunk_count: int
    documents: list[StorageDocumentItem]


class DiskUsageResponse(BaseModel):
    total_bytes: int
    free_bytes: int
