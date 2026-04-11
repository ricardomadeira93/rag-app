from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path

from app.core.config import EnvironmentSettings
from app.schemas.storage import DiskUsageResponse, StorageDocumentItem, StorageUsageResponse
from app.services.document_service import DocumentService
from app.services.vectorstore.chroma_store import ChromaVectorStore


logger = logging.getLogger(__name__)


class StorageService:
    def __init__(
        self,
        env: EnvironmentSettings,
        document_service: DocumentService,
        vector_store: ChromaVectorStore,
    ) -> None:
        self.env = env
        self.document_service = document_service
        self.vector_store = vector_store

    def get_usage(self) -> StorageUsageResponse:
        try:
            documents = self.document_service.list_documents()
        except Exception:
            logger.exception("Failed to load documents for storage usage.")
            documents = []

        try:
            chroma_bytes = self._dir_size(self.env.chroma_dir)
        except Exception:
            logger.exception("Failed to measure Chroma directory size.")
            chroma_bytes = 0

        files_bytes = sum(doc.file_size_bytes for doc in documents)

        try:
            chunk_count = self.vector_store.count()
        except Exception:
            logger.exception("Failed to count Chroma collection.")
            chunk_count = 0

        doc_items = [
            StorageDocumentItem(
                id=doc.id,
                name=doc.filename,
                file_size_bytes=doc.file_size_bytes,
                chunk_count=doc.chunk_count,
                indexed_at=doc.indexed_at,
            )
            for doc in documents
        ]

        return StorageUsageResponse(
            total_bytes=chroma_bytes + files_bytes,
            chroma_bytes=chroma_bytes,
            files_bytes=files_bytes,
            document_count=len(documents),
            chunk_count=chunk_count,
            documents=doc_items,
        )

    @staticmethod
    def disk_usage(env: EnvironmentSettings) -> DiskUsageResponse:
        usage = shutil.disk_usage(env.data_root)
        return DiskUsageResponse(total_bytes=usage.total, free_bytes=usage.free)

    @staticmethod
    def _dir_size(path: Path) -> int:
        """Recursively sum file sizes under path. Returns 0 if path does not exist."""
        if not path.exists():
            return 0
        total = 0
        for dirpath, _, filenames in os.walk(path):
            for filename in filenames:
                try:
                    total += os.path.getsize(os.path.join(dirpath, filename))
                except OSError:
                    pass
        return total
