from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import uuid

import aiosqlite

from app.services.conversation_db import get_db


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class GraphEdge:
    id: str
    source: str
    target: str
    relationship_type: str
    description: str | None
    created_at: str

    def model_dump(self) -> dict[str, str | None]:
        return {
            "id": self.id,
            "source": self.source,
            "target": self.target,
            "relationship_type": self.relationship_type,
            "description": self.description,
            "created_at": self.created_at,
        }


async def init_graph_db(db_path: Path) -> None:
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS graph_edges (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.commit()


class GraphDBService:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    async def add_edge(self, source: str, target: str, rel_type: str, desc: str | None = None) -> GraphEdge:
        edge = GraphEdge(
            id=uuid.uuid4().hex,
            source=source,
            target=target,
            relationship_type=rel_type,
            description=desc,
            created_at=_utc_now(),
        )
        async with get_db(self.db_path) as db:
            await db.execute(
                "INSERT INTO graph_edges (id, source, target, relationship_type, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (edge.id, edge.source, edge.target, edge.relationship_type, edge.description, edge.created_at),
            )
            await db.commit()
        return edge

    async def get_edges(self, document_id: str) -> list[GraphEdge]:
        async with get_db(self.db_path) as db:
            rows = await (
                await db.execute(
                    "SELECT id, source, target, relationship_type, description, created_at FROM graph_edges WHERE source = ? OR target = ? ORDER BY created_at DESC",
                    (document_id, document_id),
                )
            ).fetchall()
        return [
            GraphEdge(
                id=row["id"],
                source=row["source"],
                target=row["target"],
                relationship_type=row["relationship_type"],
                description=row["description"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    async def delete_edge(self, edge_id: str) -> bool:
        async with get_db(self.db_path) as db:
            cursor = await db.execute("DELETE FROM graph_edges WHERE id = ?", (edge_id,))
            await db.commit()
            return cursor.rowcount > 0
