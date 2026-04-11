from pathlib import Path

SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}
SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
SUPPORTED_TEXT_EXTENSIONS = {".md", ".txt"}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}
SUPPORTED_EXTENSIONS = (
    SUPPORTED_IMAGE_EXTENSIONS
    | SUPPORTED_AUDIO_EXTENSIONS
    | SUPPORTED_TEXT_EXTENSIONS
    | SUPPORTED_PDF_EXTENSIONS
)

DATA_DIR_NAME = "data"
UPLOADS_DIR_NAME = "uploads"
PROCESSED_DIR_NAME = "processed"
SETTINGS_FILE_NAME = "settings.json"
DOCUMENTS_FILE_NAME = "documents.json"
CHROMA_DIR_NAME = "chroma"
COLLECTION_NAME = "documents"


def ensure_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return suffix or ".bin"
