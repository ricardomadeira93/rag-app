from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import uuid

from app.core.config import EnvironmentSettings
from app.schemas.workspaces import WorkspaceSummary
from app.services.conversation_db import get_db


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorkspaceService:
    def __init__(self, db_path: Path, env: EnvironmentSettings) -> None:
        self.db_path = db_path
        self.env = env

    async def ensure_default_workspace(self) -> WorkspaceSummary:
        async with get_db(self.db_path) as db:
            row = await (
                await db.execute(
                    "SELECT id, name, description, is_default, created_at, updated_at FROM workspaces WHERE is_default = 1 LIMIT 1"
                )
            ).fetchone()
            if row:
                workspace = WorkspaceSummary(
                    id=row["id"],
                    name=row["name"],
                    description=row["description"],
                    is_default=bool(row["is_default"]),
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
                self._set_active_workspace_file(workspace.id)
                return workspace

            now = _utc_now()
            workspace = WorkspaceSummary(
                id="default",
                name="Default workspace",
                description="",
                is_default=True,
                created_at=now,
                updated_at=now,
            )
            await db.execute(
                "INSERT INTO workspaces (id, name, description, is_default, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (workspace.id, workspace.name, workspace.description, 1, 1, now, now),
            )
            await db.commit()
            self._set_active_workspace_file(workspace.id)
            return workspace

    async def list_workspaces(self) -> list[WorkspaceSummary]:
        await self.ensure_default_workspace()
        async with get_db(self.db_path) as db:
            rows = await (
                await db.execute(
                    "SELECT id, name, description, is_default, created_at, updated_at FROM workspaces ORDER BY is_default DESC, created_at ASC"
                )
            ).fetchall()
        return [
            WorkspaceSummary(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                is_default=bool(row["is_default"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )
            for row in rows
        ]

    async def create_workspace(self, name: str, description: str = "") -> WorkspaceSummary:
        now = _utc_now()
        workspace = WorkspaceSummary(
            id=uuid.uuid4().hex,
            name=name.strip(),
            description=description.strip(),
            is_default=False,
            created_at=now,
            updated_at=now,
        )
        async with get_db(self.db_path) as db:
            await db.execute(
                "INSERT INTO workspaces (id, name, description, is_default, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (workspace.id, workspace.name, workspace.description, 0, 0, now, now),
            )
            await db.commit()
        self.env.workspace_dir(workspace.id).mkdir(parents=True, exist_ok=True)
        return workspace

    async def select_workspace(self, workspace_id: str) -> WorkspaceSummary | None:
        async with get_db(self.db_path) as db:
            row = await (
                await db.execute(
                    "SELECT id, name, description, is_default, created_at, updated_at FROM workspaces WHERE id = ?",
                    (workspace_id,),
                )
            ).fetchone()
        if not row:
            return None
        self._set_active_workspace_file(workspace_id)
        return WorkspaceSummary(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            is_default=bool(row["is_default"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def get_active_workspace(self) -> WorkspaceSummary:
        workspace_id = self.get_active_workspace_id_sync()
        selected = await self.select_workspace(workspace_id)
        if selected is not None:
            return selected
        return await self.ensure_default_workspace()

    def get_active_workspace_id_sync(self) -> str:
        if self.env.active_workspace_file.exists():
            value = self.env.active_workspace_file.read_text(encoding="utf-8").strip()
            if value:
                return value
        return "default"

    def _set_active_workspace_file(self, workspace_id: str) -> None:
        self.env.active_workspace_file.parent.mkdir(parents=True, exist_ok=True)
        self.env.active_workspace_file.write_text(workspace_id, encoding="utf-8")
