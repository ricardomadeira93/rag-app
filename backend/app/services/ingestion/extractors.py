from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader

from app.core.constants import (
    SUPPORTED_AUDIO_EXTENSIONS,
    SUPPORTED_IMAGE_EXTENSIONS,
    SUPPORTED_PDF_EXTENSIONS,
    SUPPORTED_TEXT_EXTENSIONS,
)
from app.services.audio.transcription_service import AudioTranscriptionService
from app.services.ocr.tesseract_service import TesseractOCRService


@dataclass
class ExtractionResult:
    text: str
    file_type: str
    # Character offset where each page begins in `text` (PDF only; empty for other types)
    page_offsets: list[int] = field(default_factory=list)


class TextExtractionService:
    def __init__(
        self,
        ocr_service: TesseractOCRService,
        audio_service: AudioTranscriptionService,
    ) -> None:
        self.ocr_service = ocr_service
        self.audio_service = audio_service

    def extract_text(self, file_path: Path) -> ExtractionResult:
        extension = file_path.suffix.lower()

        print("🔥 EXTRACTOR CALLED:", file_path)
        print("EXTENSION:", file_path.suffix.lower())
        print("SUPPORTED AUDIO:", SUPPORTED_AUDIO_EXTENSIONS)

        if extension in SUPPORTED_PDF_EXTENSIONS:
            text, page_offsets = self._extract_pdf_text(file_path)
            return ExtractionResult(text=text, file_type="pdf", page_offsets=page_offsets)
        if extension in SUPPORTED_TEXT_EXTENSIONS:
            return ExtractionResult(text=file_path.read_text(encoding="utf-8"), file_type="markdown")
        if extension in SUPPORTED_IMAGE_EXTENSIONS:
            return ExtractionResult(text=self.ocr_service.extract_text(file_path), file_type="image")
        if extension in SUPPORTED_AUDIO_EXTENSIONS:
            text = self.audio_service.transcribe(file_path)
            print("AUDIO DETECTED:", file_path)
            print("TRANSCRIPT LEN:", len(text))
            print("TRANSCRIPT PREVIEW:", text[:200])
            return ExtractionResult(text=text, file_type="audio")

        raise ValueError(f"Unsupported file type: {extension}")

    def _extract_pdf_text(self, file_path: Path) -> tuple[str, list[int]]:
        """Return concatenated page text and a list of character offsets per page (1-indexed pages)."""
        reader = PdfReader(str(file_path))
        parts: list[str] = []
        page_offsets: list[int] = []
        cursor = 0
        for page in reader.pages:
            page_text = (page.extract_text() or "").strip()
            if not page_text:
                # Page has no text — still record the offset so page numbers stay aligned
                page_offsets.append(cursor)
                continue
            page_offsets.append(cursor)
            parts.append(page_text)
            cursor += len(page_text) + 2  # +2 for the "\n\n" separator
        return "\n\n".join(parts), page_offsets
