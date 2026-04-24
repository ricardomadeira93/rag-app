from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.constants import (
    CHROMA_DIR_NAME,
    DATA_DIR_NAME,
    DOCUMENTS_FILE_NAME,
    PROCESSED_DIR_NAME,
    SETTINGS_FILE_NAME,
    UPLOADS_DIR_NAME,
)


class EnvironmentSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Local-First RAG MVP"
    app_env: str = "development"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    data_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[2] / DATA_DIR_NAME)
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_keep_alive: str = "5m"
    default_whisper_model: str = "base"

    @property
    def uploads_dir(self) -> Path:
        return self.data_root / UPLOADS_DIR_NAME

    @property
    def processed_dir(self) -> Path:
        return self.data_root / PROCESSED_DIR_NAME

    @property
    def chroma_dir(self) -> Path:
        return self.data_root / CHROMA_DIR_NAME

    @property
    def workspaces_dir(self) -> Path:
        return self.data_root / "workspaces"

    @property
    def settings_file(self) -> Path:
        return self.data_root / SETTINGS_FILE_NAME

    @property
    def documents_file(self) -> Path:
        return self.data_root / DOCUMENTS_FILE_NAME

    def workspace_dir(self, workspace_id: str) -> Path:
        return self.workspaces_dir / workspace_id

    def workspace_settings_file(self, workspace_id: str) -> Path:
        return self.workspace_dir(workspace_id) / SETTINGS_FILE_NAME

    def workspace_documents_file(self, workspace_id: str) -> Path:
        return self.workspace_dir(workspace_id) / DOCUMENTS_FILE_NAME

    @property
    def active_workspace_file(self) -> Path:
        return self.data_root / "active_workspace.txt"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_environment_settings() -> EnvironmentSettings:
    return EnvironmentSettings()
