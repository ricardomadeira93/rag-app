from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from app.core.config import EnvironmentSettings
from app.core.constants import SUPPORTED_EXTENSIONS, ensure_suffix
from app.schemas.documents import DocumentRecord
from app.schemas.settings import PersistedSettings
from app.services.document_service import DocumentService
from app.services.embeddings.service import EmbeddingService
from app.services.enrichment_service import EnrichmentService
from app.services.ingestion.chunking import ChunkWithMeta, split_text_with_meta
from app.services.ingestion.extractors import TextExtractionService
from app.services.vectorstore.chroma_store import ChromaVectorStore


class IngestionPipeline:
    def __init__(
        self,
        env: EnvironmentSettings,
        document_service: DocumentService,
        extractor: TextExtractionService,
        embeddings: EmbeddingService,
        enrichment_service: EnrichmentService,
        vector_store: ChromaVectorStore,
    ) -> None:
        self.env = env
        self.document_service = document_service
        self.extractor = extractor
        self.embeddings = embeddings
        self.enrichment_service = enrichment_service
        self.vector_store = vector_store

    async def ingest_uploads(
        self,
        files: list[UploadFile],
        settings: PersistedSettings,
    ) -> list[DocumentRecord]:
        queued_documents: list[DocumentRecord] = []
        for upload in files:
            placeholder, destination, mime_type = await self._prepare_upload(upload, settings)
            queued_documents.append(placeholder)
            asyncio.create_task(
                self._index_saved_file_task(
                    source_path=destination,
                    original_filename=placeholder.filename,
                    mime_type=mime_type,
                    settings=settings,
                    document_id=placeholder.id,
                )
            )
        return queued_documents

    async def reindex_all(self, settings: PersistedSettings) -> list[DocumentRecord]:
        existing_documents = self.document_service.list_documents()
        self.vector_store.reset()

        # Mark all docs as needing reprocessing before we start
        for doc in existing_documents:
            self.document_service.update_status(doc.id, "needs_reprocessing")

        updated_documents: list[DocumentRecord] = []
        semaphore = asyncio.Semaphore(3)

        async def _reindex_doc(document: DocumentRecord) -> DocumentRecord | None:
            async with semaphore:
                try:
                    return await self._index_saved_file(
                        Path(document.source_path), document.filename, document.mime_type, settings
                    )
                except Exception as exc:
                    self.document_service.update_status(
                        document.id, "failed", error_message=str(exc)
                    )
                    # Preserve the existing record with failed status
                    return self.document_service.get_document(document.id)

        tasks = [_reindex_doc(doc) for doc in existing_documents]
        results = await asyncio.gather(*tasks)
        updated_documents = [res for res in results if res is not None]

        return updated_documents

    def delete_document(self, document_id: str) -> DocumentRecord | None:
        existing = self.document_service.get_document(document_id)
        if existing is None:
            return None

        self.vector_store.delete_document(document_id)
        self.document_service.delete_document(document_id)
        return existing

    async def _prepare_upload(
        self,
        upload: UploadFile,
        settings: PersistedSettings,
    ) -> tuple[DocumentRecord, Path, str]:
        if not upload.filename:
            raise ValueError("Upload must include a filename")

        suffix = ensure_suffix(upload.filename)
        if suffix not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {suffix}")

        file_bytes = await upload.read()
        checksum = hashlib.sha256(file_bytes).hexdigest()
        destination = self.env.uploads_dir / f"{checksum}{suffix}"
        if not destination.exists():
            destination.write_bytes(file_bytes)

        # Create a placeholder record with "processing" status before heavy work begins
        document_id = checksum
        existing = self.document_service.get_document(document_id)
        if existing is None:
            placeholder = DocumentRecord(
                id=document_id,
                filename=upload.filename,
                mime_type=upload.content_type or "application/octet-stream",
                file_type=suffix.lstrip("."),
                extension=suffix,
                checksum=checksum,
                source_path=str(destination),
                embedding_provider=settings.embedding_provider,
                embedding_model=settings.embedding_model,
                embedding_version=settings.embedding_version,
                status="processing",
            )
            self.document_service.upsert_document(placeholder)
        else:
            placeholder = self.document_service.update_status(document_id, "processing")
            if placeholder is None:
                raise ValueError(f"Failed to prepare document {upload.filename}")

        return placeholder, destination, upload.content_type or "application/octet-stream"

    async def _index_saved_file_task(
        self,
        *,
        source_path: Path,
        original_filename: str,
        mime_type: str,
        settings: PersistedSettings,
        document_id: str,
    ) -> None:
        try:
            await self._index_saved_file(source_path, original_filename, mime_type, settings)
        except Exception as exc:
            self.document_service.update_status(document_id, "failed", error_message=str(exc))

    async def _index_saved_file(
        self,
        source_path: Path,
        original_filename: str,
        mime_type: str,
        settings: PersistedSettings,
    ) -> DocumentRecord:
        extracted = self.extractor.extract_text(source_path)
        if not extracted.text.strip():
            raise ValueError(f"No text could be extracted from {original_filename}")

        enrichment = await self.enrichment_service.enrich(extracted.text)

        chunk_metas: list[ChunkWithMeta] = split_text_with_meta(
            extracted.text,
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
            page_offsets=extracted.page_offsets,
        )
        if not chunk_metas:
            raise ValueError(f"No chunks were produced for {original_filename}")

        # Anthropic's Contextual Retrieval
        # We loop through the orphaned chunks and ask the Enrichment AI to sew them 
        # back to the global summary before we embed them mathematically.
        semaphore = asyncio.Semaphore(10)

        async def _process_chunk(cm: ChunkWithMeta) -> None:
            async with semaphore:
                header = await self.enrichment_service.contextualize_chunk(
                    enrichment.summary, cm.text, settings
                )
                
                # Inject the filename to boost semantic matching for title keywords
                file_meta = f"Filename: {original_filename}\n"
                if header:
                    cm.text = f"{file_meta}[Context: {header}]\n\n{cm.text}"
                else:
                    cm.text = f"{file_meta}\n{cm.text}"

        await asyncio.gather(*(_process_chunk(cm) for cm in chunk_metas))

        chunks = [cm.text for cm in chunk_metas]

        checksum = hashlib.sha256(source_path.read_bytes()).hexdigest()
        document_id = checksum
        extracted_text_path = self.env.processed_dir / f"{document_id}.txt"
        extracted_text_path.write_text(extracted.text, encoding="utf-8")
        enrichment_path = self.env.processed_dir / f"{document_id}.enrichment.json"
        enrichment_path.write_text(
            json.dumps(enrichment.model_dump(), indent=2),
            encoding="utf-8",
        )

        timestamp = datetime.now(timezone.utc).isoformat()

        embeddings = await self.embeddings.embed_texts(settings, chunks)
        document = DocumentRecord(
            id=document_id,
            filename=original_filename,
            mime_type=mime_type,
            file_type=extracted.file_type,
            extension=source_path.suffix.lower(),
            checksum=checksum,
            source_path=str(source_path),
            extracted_text_path=str(extracted_text_path),
            chunk_count=len(chunk_metas),
            file_size_bytes=source_path.stat().st_size,
            embedding_provider=settings.embedding_provider,
            embedding_model=settings.embedding_model,
            embedding_version=settings.embedding_version,
            summary=enrichment.summary or None,
            document_type=enrichment.document_type,
            topics=enrichment.topics,
            status="indexed",
            indexed_at=timestamp,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self.vector_store.upsert_document(document, chunks, embeddings, settings.embedding_signature, chunk_metas=chunk_metas)
        self.document_service.upsert_document(document)
        return document
