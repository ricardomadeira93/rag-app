from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Literal

from app.core.config import EnvironmentSettings
from app.schemas.documents import DocumentRecord, DocumentStatus
from app.services.workspace_service import WorkspaceService


class DocumentService:
    def __init__(self, env: EnvironmentSettings, workspace_service: WorkspaceService) -> None:
        self.env = env
        self.workspace_service = workspace_service

    def list_documents(self) -> list[DocumentRecord]:
        documents_file = self.env.workspace_documents_file(self.workspace_service.get_active_workspace_id_sync())
        documents_file.parent.mkdir(parents=True, exist_ok=True)
        if not documents_file.exists():
            self._write([])
            return []
        payload = json.loads(documents_file.read_text(encoding="utf-8"))
        return [DocumentRecord.model_validate(item) for item in payload]

    def get_document(self, document_id: str) -> DocumentRecord | None:
        for document in self.list_documents():
            if document.id == document_id:
                return document
        return None

    def upsert_document(self, document: DocumentRecord) -> DocumentRecord:
        items = self.list_documents()
        now = datetime.now(timezone.utc).isoformat()
        document.updated_at = now

        replaced = False
        updated_items: list[DocumentRecord] = []
        for existing in items:
            if existing.id == document.id:
                document.created_at = existing.created_at
                updated_items.append(document)
                replaced = True
            else:
                updated_items.append(existing)

        if not replaced:
            document.created_at = document.created_at or now
            document.updated_at = document.updated_at or now
            updated_items.append(document)

        self._write(updated_items)
        return document

    def delete_document(self, document_id: str) -> DocumentRecord | None:
        items = self.list_documents()
        remaining: list[DocumentRecord] = []
        deleted: DocumentRecord | None = None

        for document in items:
            if document.id == document_id:
                deleted = document
            else:
                remaining.append(document)

        if deleted is None:
            return None

        self._write(remaining)
        return deleted

    def replace_all(self, documents: list[DocumentRecord]) -> None:
        self._write(documents)

    def count(self) -> int:
        return len(self.list_documents())

    def update_status(
        self,
        document_id: str,
        status: DocumentStatus,
        *,
        indexed_at: str | None = None,
        chunk_count: int | None = None,
        error_message: str | None = None,
    ) -> DocumentRecord | None:
        document = self.get_document(document_id)
        if document is None:
            return None
        document.status = status
        if indexed_at is not None:
            document.indexed_at = indexed_at
        if chunk_count is not None:
            document.chunk_count = chunk_count
        if error_message is not None:
            document.error_message = error_message
        return self.upsert_document(document)

    def update_tags(self, document_id: str, tags: list[str]) -> DocumentRecord | None:
        document = self.get_document(document_id)
        if document is None:
            return None
        document.tags = [t.strip().lower() for t in tags if t.strip()]
        return self.upsert_document(document)

    def update_related_docs(self, document_id: str, related_docs: list[dict]) -> DocumentRecord | None:
        document = self.get_document(document_id)
        if document is None:
            return None
        document.related_docs = related_docs
        return self.upsert_document(document)

    def update_conflicting_docs(self, document_id: str, conflicting_docs: list[dict]) -> DocumentRecord | None:
        document = self.get_document(document_id)
        if document is None:
            return None
        document.conflicting_docs = conflicting_docs
        return self.upsert_document(document)

    def list_all_tags(self) -> list[str]:
        all_tags: set[str] = set()
        for doc in self.list_documents():
            all_tags.update(doc.tags)
        return sorted(all_tags)

    def _write(self, documents: list[DocumentRecord]) -> None:
        payload = [document.model_dump() for document in documents]
        documents_file = self.env.workspace_documents_file(self.workspace_service.get_active_workspace_id_sync())
        documents_file.parent.mkdir(parents=True, exist_ok=True)
        documents_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
