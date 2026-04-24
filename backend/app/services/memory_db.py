from __future__ import annotations

from pathlib import Path

import aiosqlite


async def init_memory_db(db_path: Path) -> None:
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                fact TEXT NOT NULL,
                source_conversation_id TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS memory_summaries (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                summary TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS memory_preferences (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.commit()
