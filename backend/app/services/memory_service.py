from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import uuid

from app.schemas.settings import PersistedSettings
from app.services.conversation_db import get_db


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class MemoryItem:
    id: str
    fact: str
    source_conversation_id: str | None
    active: bool
    created_at: str


@dataclass
class MemorySummary:
    id: str
    conversation_id: str | None
    summary: str
    created_at: str


@dataclass
class MemoryPreference:
    id: str
    key: str
    value: str
    created_at: str


class MemoryService:
    def __init__(self, db_path: Path, conversation_db_path: Path, env: object) -> None:
        self.db_path = db_path
        self.conversation_db_path = conversation_db_path
        self.env = env

    async def extract_and_store(self, messages: list[dict[str, str]], conversation_id: str, settings: PersistedSettings) -> None:
        facts = [m["content"].strip() for m in messages if m.get("role") == "user" and m.get("content", "").strip()]
        if not facts:
            return
        fact = facts[-1][:500]
        async with get_db(self.db_path) as db:
            await db.execute(
                "INSERT INTO memories (id, fact, source_conversation_id, active, created_at) VALUES (?, ?, ?, ?, ?)",
                (uuid.uuid4().hex, fact, conversation_id, 1, _utc_now()),
            )
            await db.commit()

    async def summarize_latest_conversation_before_new(self, settings: PersistedSettings) -> None:
        return None

    async def list_memories(self) -> list[MemoryItem]:
        async with get_db(self.db_path) as db:
            rows = await (await db.execute("SELECT id, fact, source_conversation_id, active, created_at FROM memories ORDER BY created_at DESC")).fetchall()
        return [
            MemoryItem(
                id=row["id"],
                fact=row["fact"],
                source_conversation_id=row["source_conversation_id"],
                active=bool(row["active"]),
                created_at=row["created_at"],
            )
            for row in rows
        ]

    async def list_summaries(self) -> list[MemorySummary]:
        async with get_db(self.db_path) as db:
            rows = await (await db.execute("SELECT id, conversation_id, summary, created_at FROM memory_summaries ORDER BY created_at DESC")).fetchall()
        return [
            MemorySummary(
                id=row["id"],
                conversation_id=row["conversation_id"],
                summary=row["summary"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    async def list_preferences(self) -> list[MemoryPreference]:
        async with get_db(self.db_path) as db:
            rows = await (await db.execute("SELECT id, key, value, created_at FROM memory_preferences ORDER BY created_at DESC")).fetchall()
        return [
            MemoryPreference(
                id=row["id"],
                key=row["key"],
                value=row["value"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    async def deactivate_memory(self, memory_id: str) -> bool:
        async with get_db(self.db_path) as db:
            cursor = await db.execute("UPDATE memories SET active = 0 WHERE id = ?", (memory_id,))
            await db.commit()
            return cursor.rowcount > 0
