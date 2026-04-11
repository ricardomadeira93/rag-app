from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel


class AudioTranscriptionService:
    def __init__(self, model_name: str = "base") -> None:
        self.model_name = model_name

    def transcribe(self, file_path: Path) -> str:
        model = get_whisper_model(self.model_name)
        segments, _ = model.transcribe(str(file_path), vad_filter=True)
        transcript = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
        return transcript.strip()


@lru_cache(maxsize=2)
def get_whisper_model(model_name: str) -> WhisperModel:
    return WhisperModel(model_name, device="cpu", compute_type="int8")
