from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

LLMProviderLiteral = Literal["ollama", "openai", "anthropic"]
EmbeddingProviderLiteral = Literal["ollama", "openai"]
UiThemeLiteral = Literal["system", "light", "dark"]
ToneLiteral = Literal["professional", "balanced", "casual"]
ResponseLengthLiteral = Literal["concise", "detailed"]

DEFAULT_UI_FONT_SIZE = 15
DEFAULT_UI_ACCENT = "#2563eb"
HEX_COLOR_PATTERN = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EmbeddingSignature(BaseModel):
    provider: EmbeddingProviderLiteral
    model: str
    version: str

    @property
    def value(self) -> str:
        return f"{self.provider}:{self.model}:{self.version}"


class PersistedSettings(BaseModel):
    current_workspace_id: str = "default"
    developer_mode: bool = False
    llm_provider: LLMProviderLiteral = "ollama"
    llm_model: str = "llama3.1:8b"
    llm_api_key: Optional[str] = None
    llm_base_url: Optional[str] = None

    embedding_provider: EmbeddingProviderLiteral = "ollama"
    embedding_model: str = "nomic-embed-text"
    embedding_api_key: Optional[str] = None
    embedding_base_url: Optional[str] = None
    embedding_version: str = "1"

    enrichment_model: str = "llama3.2:3b"

    chunk_size: int = Field(default=1200, ge=300, le=4000)
    chunk_overlap: int = Field(default=200, ge=0, le=1500)
    top_k: int = Field(default=10, ge=1, le=20)

    ui_font_size: int = Field(default=DEFAULT_UI_FONT_SIZE, ge=14, le=18)
    ui_accent_color: str = Field(default=DEFAULT_UI_ACCENT)
    ui_theme: UiThemeLiteral = "system"

    onboarding_complete: bool = False
    workspace_name: str = ""
    workspace_description: str = ""
    user_name: str = ""
    user_role: str = ""
    language: str = "English"
    tone: ToneLiteral = "balanced"
    response_length: ResponseLengthLiteral = "detailed"
    standing_context: str = ""
    semantic_routing_enabled: bool = False

    reindex_required: bool = False
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)

    @model_validator(mode="after")
    def validate_chunking(self) -> "PersistedSettings":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self

    @field_validator("ui_accent_color")
    @classmethod
    def validate_ui_accent_color(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized.startswith("#"):
            normalized = f"#{normalized}"
        if len(normalized) == 4:
            normalized = f"#{normalized[1] * 2}{normalized[2] * 2}{normalized[3] * 2}"
        if not HEX_COLOR_PATTERN.match(normalized):
            raise ValueError("ui_accent_color must be a hex color like #2563eb")
        return normalized.lower()

    @property
    def embedding_signature(self) -> EmbeddingSignature:
        return EmbeddingSignature(
            provider=self.embedding_provider,
            model=self.embedding_model,
            version=self.embedding_version,
        )


class SettingsUpdate(BaseModel):
    developer_mode: Optional[bool] = None
    llm_provider: Optional[LLMProviderLiteral] = None
    llm_model: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_base_url: Optional[str] = None

    embedding_provider: Optional[EmbeddingProviderLiteral] = None
    embedding_model: Optional[str] = None
    embedding_api_key: Optional[str] = None
    embedding_base_url: Optional[str] = None
    embedding_version: Optional[str] = None

    enrichment_model: Optional[str] = None

    chunk_size: Optional[int] = Field(default=None, ge=300, le=4000)
    chunk_overlap: Optional[int] = Field(default=None, ge=0, le=1500)
    top_k: Optional[int] = Field(default=None, ge=1, le=20)

    ui_font_size: Optional[int] = Field(default=None, ge=14, le=18)
    ui_accent_color: Optional[str] = None
    ui_theme: Optional[UiThemeLiteral] = None

    onboarding_complete: Optional[bool] = None
    workspace_name: Optional[str] = None
    workspace_description: Optional[str] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    language: Optional[str] = None
    tone: Optional[ToneLiteral] = None
    response_length: Optional[ResponseLengthLiteral] = None
    standing_context: Optional[str] = None
    semantic_routing_enabled: Optional[bool] = None


class SettingsResponse(PersistedSettings):
    indexed_documents: int = 0
    current_embedding_signature: EmbeddingSignature
    supported_llm_providers: list[LLMProviderLiteral]
    supported_embedding_providers: list[EmbeddingProviderLiteral]
    recommended_chat_models: list[str] = Field(default_factory=lambda: ["llama3.1:8b", "qwen2.5:7b", "mistral-nemo"])
    recommended_enrichment_models: list[str] = Field(default_factory=lambda: ["llama3.2:3b", "llama3.2:1b", "qwen2.5:1.5b"])
    recommended_embedding_models: list[str] = Field(default_factory=lambda: ["nomic-embed-text"])
