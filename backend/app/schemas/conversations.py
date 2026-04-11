from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


class PersistedMessage(BaseModel):
    id: str
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    sources: list[dict] = Field(default_factory=list)
    created_at: str


class CreateConversationRequest(BaseModel):
    title: str | None = None  # auto-generated from first user message when omitted


class AppendMessageRequest(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    sources: list[dict] = Field(default_factory=list)
