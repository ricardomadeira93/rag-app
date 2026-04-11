from pathlib import Path

import pytesseract
from PIL import Image


class TesseractOCRService:
    def extract_text(self, file_path: Path) -> str:
        with Image.open(file_path) as image:
            return pytesseract.image_to_string(image).strip()
