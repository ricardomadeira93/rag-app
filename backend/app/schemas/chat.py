from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class MetaPayload(BaseModel):
    confidence: Literal["high", "medium", "low", "none"]
    answer_type: str

class SourceCitation(BaseModel):
    id: str
    document_id: str
    filename: str
    snippet: str
    chunk_text: str = Field(default="", exclude=True)
    score: float
    similarity_score: float = 0.0
    similarity_percent: str = ""
    chunk_index: int
    page: int | None = None    # 1-based page number for PDFs; null for other file types
    offset: int = 0            # character offset of the chunk start in the source text
    created_at: str | None = None
    source_type: str = "upload"
    doc_type: str = "file"


class ChatFilters(BaseModel):
    # Existing filters
    recent_only: bool = False
    document_type: str | None = None
    created_after: str | None = None
    # Scoped retrieval filters
    document_ids: list[str] = Field(default_factory=list)
    file_type: Literal["pdf", "audio", "image", "markdown"] | None = None
    days: int | None = None  # recency shorthand: chunks ingested within the last N days


class ChatScopingInfo(BaseModel):
    """Describes which retrieval filters were actually applied for a given chat turn."""
    document_ids: list[str]  # empty = full collection
    file_type: str | None
    days: int | None


class RetrievalDebugChunk(BaseModel):
    id: str
    document_id: str
    filename: str
    snippet: str
    score: float
    similarity_score: float
    created_at: str | None = None


class RetrievalDebugInfo(BaseModel):
    query: str
    filters: dict[str, Any] = Field(default_factory=dict)
    embedding_model: str
    chunks: list[RetrievalDebugChunk] = Field(default_factory=list)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    filters: ChatFilters | None = None
    debug: bool = False
    conversation_id: str | None = None  # when set, messages are persisted to this conversation

    @property
    def latest_user_message(self) -> Optional[str]:
        for message in reversed(self.messages):
            if message.role == "user":
                return message.content
        return None
