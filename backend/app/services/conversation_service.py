from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.conversations import ConversationSummary, PersistedMessage
from app.services.conversation_db import get_db


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex


class ConversationService:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    async def list_conversations(self) -> list[ConversationSummary]:
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, title, pinned, created_at, updated_at "
                "FROM conversations ORDER BY pinned DESC, updated_at DESC"
            )
            rows = await cursor.fetchall()
            return [
                ConversationSummary(
                    id=row["id"],
                    title=row["title"],
                    pinned=bool(row["pinned"]),
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
                for row in rows
            ]

    async def get_conversation(self, conversation_id: str) -> ConversationSummary | None:
        async with get_db(self.db_path) as db:
            row = await (await db.execute(
                "SELECT id, title, pinned, created_at, updated_at FROM conversations WHERE id = ?",
                (conversation_id,),
            )).fetchone()
            if not row:
                return None
            return ConversationSummary(
                id=row["id"],
                title=row["title"],
                pinned=bool(row["pinned"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    async def create_conversation(self, title: str | None = None) -> ConversationSummary:
        now = _utc_now()
        record = ConversationSummary(
            id=_new_id(),
            title=title or "New conversation",
            pinned=False,
            created_at=now,
            updated_at=now,
        )
        async with get_db(self.db_path) as db:
            await db.execute(
                "INSERT INTO conversations (id, title, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (record.id, record.title, 0, record.created_at, record.updated_at),
            )
            await db.commit()
        return record

    async def get_messages(self, conversation_id: str) -> list[PersistedMessage]:
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, conversation_id, role, content, sources, rating, created_at "
                "FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,),
            )
            rows = await cursor.fetchall()
            return [
                PersistedMessage(
                    id=row["id"],
                    conversation_id=row["conversation_id"],
                    role=row["role"],
                    content=row["content"],
                    sources=json.loads(row["sources"]),
                    rating=row["rating"],
                    created_at=row["created_at"],
                )
                for row in rows
            ]

    async def append_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        sources: list[dict] | None = None,
    ) -> PersistedMessage:
        now = _utc_now()
        record = PersistedMessage(
            id=_new_id(),
            conversation_id=conversation_id,
            role=role,  # type: ignore[arg-type]
            content=content,
            sources=sources or [],
            created_at=now,
        )
        async with get_db(self.db_path) as db:
            await db.execute(
                "INSERT INTO messages (id, conversation_id, role, content, sources, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (record.id, conversation_id, role, content, json.dumps(record.sources), now),
            )
            await db.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
            await db.commit()
        return record

    async def rename_conversation(self, conversation_id: str, title: str) -> ConversationSummary | None:
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (title, _utc_now(), conversation_id),
            )
            await db.commit()
            if cursor.rowcount == 0:
                return None
            row = await (await db.execute(
                "SELECT id, title, pinned, created_at, updated_at FROM conversations WHERE id = ?",
                (conversation_id,),
            )).fetchone()
            if not row:
                return None
            return ConversationSummary(
                id=row["id"],
                title=row["title"],
                pinned=bool(row["pinned"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    async def toggle_pin(self, conversation_id: str) -> ConversationSummary | None:
        async with get_db(self.db_path) as db:
            row = await (await db.execute(
                "SELECT pinned FROM conversations WHERE id = ?", (conversation_id,)
            )).fetchone()
            if not row:
                return None
            new_pinned = 0 if row["pinned"] else 1
            await db.execute(
                "UPDATE conversations SET pinned = ? WHERE id = ?",
                (new_pinned, conversation_id),
            )
            await db.commit()
            updated = await (await db.execute(
                "SELECT id, title, pinned, created_at, updated_at FROM conversations WHERE id = ?",
                (conversation_id,),
            )).fetchone()
            if not updated:
                return None
            return ConversationSummary(
                id=updated["id"],
                title=updated["title"],
                pinned=bool(updated["pinned"]),
                created_at=updated["created_at"],
                updated_at=updated["updated_at"],
            )

    async def search_messages(self, conversation_id: str, query: str) -> list[PersistedMessage]:
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, conversation_id, role, content, sources, rating, created_at "
                "FROM messages WHERE conversation_id = ? AND content LIKE ? "
                "ORDER BY created_at ASC",
                (conversation_id, f"%{query}%"),
            )
            rows = await cursor.fetchall()
            return [
                PersistedMessage(
                    id=row["id"],
                    conversation_id=row["conversation_id"],
                    role=row["role"],
                    content=row["content"],
                    sources=json.loads(row["sources"]),
                    rating=row["rating"],
                    created_at=row["created_at"],
                )
                for row in rows
            ]

    async def rate_message(self, message_id: str, rating: int) -> bool:
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "UPDATE messages SET rating = ? WHERE id = ?",
                (rating, message_id),
            )
            await db.commit()
            return cursor.rowcount > 0

    async def update_title(self, conversation_id: str, title: str) -> None:
        async with get_db(self.db_path) as db:
            await db.execute(
                "UPDATE conversations SET title = ? WHERE id = ?",
                (title, conversation_id),
            )
            await db.commit()

    async def delete_conversation(self, conversation_id: str) -> bool:
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM conversations WHERE id = ?", (conversation_id,)
            )
            await db.commit()
            return cursor.rowcount > 0

    @staticmethod
    def auto_title(text: str) -> str:
        """Generate a title from the first 6 words of a message."""
        words = text.strip().split()[:6]
        title = " ".join(words)
        return title.capitalize() if title else "New conversation"
