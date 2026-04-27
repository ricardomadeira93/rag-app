from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.conversations import ConversationSummary, PersistedMessage
from app.services.conversation_db import get_db
from app.services.workspace_service import WorkspaceService


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex


class ConversationService:
    def __init__(self, db_path: Path, workspace_service: WorkspaceService) -> None:
        self.db_path = db_path
        self.workspace_service = workspace_service

    async def list_conversations(self) -> list[ConversationSummary]:
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, workspace_id, title, pinned, created_at, updated_at "
                "FROM conversations WHERE workspace_id = ? ORDER BY pinned DESC, updated_at DESC",
                (workspace.id,),
            )
            rows = await cursor.fetchall()
            return [
                ConversationSummary(
                    id=row["id"],
                    workspace_id=row["workspace_id"],
                    title=row["title"],
                    pinned=bool(row["pinned"]),
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
                for row in rows
            ]

    async def get_conversation(self, conversation_id: str) -> ConversationSummary | None:
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            row = await (await db.execute(
                "SELECT id, workspace_id, title, pinned, created_at, updated_at FROM conversations WHERE id = ? AND workspace_id = ?",
                (conversation_id, workspace.id),
            )).fetchone()
            if not row:
                return None
            return ConversationSummary(
                id=row["id"],
                workspace_id=row["workspace_id"],
                title=row["title"],
                pinned=bool(row["pinned"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    async def create_conversation(self, title: str | None = None) -> ConversationSummary:
        workspace = await self.workspace_service.get_active_workspace()
        now = _utc_now()
        record = ConversationSummary(
            id=_new_id(),
            workspace_id=workspace.id,
            title=title or "New conversation",
            pinned=False,
            created_at=now,
            updated_at=now,
        )
        async with get_db(self.db_path) as db:
            await db.execute(
                "INSERT INTO conversations (id, workspace_id, title, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (record.id, workspace.id, record.title, 0, record.created_at, record.updated_at),
            )
            await db.commit()
        return record

    async def get_messages(self, conversation_id: str) -> list[PersistedMessage]:
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, conversation_id, role, content, sources, mode_used, mode_auto_detected, rating, created_at "
                "FROM messages WHERE conversation_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE workspace_id = ?) ORDER BY created_at ASC",
                (conversation_id, workspace.id),
            )
            rows = await cursor.fetchall()
            return [
                PersistedMessage(
                    id=row["id"],
                    conversation_id=row["conversation_id"],
                    role=row["role"],
                    content=row["content"],
                    sources=json.loads(row["sources"]),
                    mode_used=row["mode_used"],
                    mode_auto_detected=bool(row["mode_auto_detected"]) if row["mode_auto_detected"] is not None else None,
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
        mode_used: str | None = None,
        mode_auto_detected: bool | None = None,
    ) -> PersistedMessage:
        now = _utc_now()
        record = PersistedMessage(
            id=_new_id(),
            conversation_id=conversation_id,
            role=role,  # type: ignore[arg-type]
            content=content,
            sources=sources or [],
            mode_used=mode_used,  # type: ignore[arg-type]
            mode_auto_detected=mode_auto_detected,
            created_at=now,
        )
        async with get_db(self.db_path) as db:
            await db.execute(
                "INSERT INTO messages (id, conversation_id, role, content, sources, mode_used, mode_auto_detected, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record.id,
                    conversation_id,
                    role,
                    content,
                    json.dumps(record.sources),
                    mode_used,
                    int(mode_auto_detected) if mode_auto_detected is not None else None,
                    now,
                ),
            )
            await db.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
            await db.commit()
        return record

    async def rename_conversation(self, conversation_id: str, title: str) -> ConversationSummary | None:
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
                (title, _utc_now(), conversation_id, workspace.id),
            )
            await db.commit()
            if cursor.rowcount == 0:
                return None
            row = await (await db.execute(
                "SELECT id, workspace_id, title, pinned, created_at, updated_at FROM conversations WHERE id = ? AND workspace_id = ?",
                (conversation_id, workspace.id),
            )).fetchone()
            if not row:
                return None
            return ConversationSummary(
                id=row["id"],
                workspace_id=row["workspace_id"],
                title=row["title"],
                pinned=bool(row["pinned"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    async def toggle_pin(self, conversation_id: str) -> ConversationSummary | None:
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            row = await (await db.execute(
                "SELECT pinned FROM conversations WHERE id = ? AND workspace_id = ?", (conversation_id, workspace.id)
            )).fetchone()
            if not row:
                return None
            new_pinned = 0 if row["pinned"] else 1
            await db.execute(
                "UPDATE conversations SET pinned = ? WHERE id = ? AND workspace_id = ?",
                (new_pinned, conversation_id, workspace.id),
            )
            await db.commit()
            updated = await (await db.execute(
                "SELECT id, workspace_id, title, pinned, created_at, updated_at FROM conversations WHERE id = ? AND workspace_id = ?",
                (conversation_id, workspace.id),
            )).fetchone()
            if not updated:
                return None
            return ConversationSummary(
                id=updated["id"],
                workspace_id=updated["workspace_id"],
                title=updated["title"],
                pinned=bool(updated["pinned"]),
                created_at=updated["created_at"],
                updated_at=updated["updated_at"],
            )

    async def search_messages(self, conversation_id: str, query: str) -> list[PersistedMessage]:
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, conversation_id, role, content, sources, mode_used, mode_auto_detected, rating, created_at "
                "FROM messages WHERE conversation_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE workspace_id = ?) AND content LIKE ? "
                "ORDER BY created_at ASC",
                (conversation_id, workspace.id, f"%{query}%"),
            )
            rows = await cursor.fetchall()
            return [
                PersistedMessage(
                    id=row["id"],
                    conversation_id=row["conversation_id"],
                    role=row["role"],
                    content=row["content"],
                    sources=json.loads(row["sources"]),
                    mode_used=row["mode_used"],
                    mode_auto_detected=bool(row["mode_auto_detected"]) if row["mode_auto_detected"] is not None else None,
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
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM conversations WHERE id = ? AND workspace_id = ?", (conversation_id, workspace.id)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def delete_all_conversations(self) -> int:
        workspace = await self.workspace_service.get_active_workspace()
        async with get_db(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM conversations WHERE workspace_id = ?",
                (workspace.id,),
            )
            await db.commit()
            return cursor.rowcount

    @staticmethod
    def auto_title(text: str) -> str:
        """Generate a title from the first 6 words of a message."""
        words = text.strip().split()[:6]
        title = " ".join(words)
        return title.capitalize() if title else "New conversation"
