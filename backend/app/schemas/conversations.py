from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ConversationSummary(BaseModel):
    id: str
    title: str
    pinned: bool = False
    created_at: str
    updated_at: str


class PersistedMessage(BaseModel):
    id: str
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    sources: list[dict] = Field(default_factory=list)
    rating: int | None = None
    created_at: str


class CreateConversationRequest(BaseModel):
    title: str | None = None  # auto-generated from first user message when omitted


class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class AppendMessageRequest(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    sources: list[dict] = Field(default_factory=list)


class RateMessageRequest(BaseModel):
    rating: Literal[1, -1]


class SearchMessagesRequest(BaseModel):
    q: str = Field(min_length=1)
