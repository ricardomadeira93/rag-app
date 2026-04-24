import gc
from pathlib import Path

from faster_whisper import WhisperModel


class AudioTranscriptionService:
    def __init__(self, model_name: str = "base") -> None:
        self.model_name = model_name

    def transcribe(self, file_path: Path) -> str:
        # Load per request so development sessions do not keep Whisper models
        # pinned in RAM between transcriptions.
        model = WhisperModel(self.model_name, device="cpu", compute_type="int8")
        try:
            segments, _ = model.transcribe(str(file_path), vad_filter=True)
            transcript = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
            return transcript.strip()
        finally:
            del model
            gc.collect()
