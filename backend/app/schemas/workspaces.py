from __future__ import annotations

from pydantic import BaseModel, Field


class WorkspaceSummary(BaseModel):
    id: str
    name: str
    description: str = ""
    is_default: bool = False
    created_at: str
    updated_at: str


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
