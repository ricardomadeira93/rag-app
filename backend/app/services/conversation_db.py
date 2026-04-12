from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import aiosqlite


async def init_db(db_path: Path) -> None:
    """Create tables if they do not exist. Called once at startup."""
    async with aiosqlite.connect(db_path) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id       TEXT PRIMARY KEY,
                title    TEXT NOT NULL,
                pinned   INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id              TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role            TEXT NOT NULL,
                content         TEXT NOT NULL,
                sources         TEXT NOT NULL DEFAULT '[]',
                rating          INTEGER DEFAULT NULL,
                created_at      TEXT NOT NULL
            )
        """)
        # --- Safe column migrations for existing databases ---
        # SQLite ignores ALTER TABLE ADD COLUMN if it already exists (wrapped in try/except)
        for migration in [
            "ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE messages ADD COLUMN rating INTEGER DEFAULT NULL",
        ]:
            try:
                await db.execute(migration)
            except Exception:
                pass  # Column already exists
        # Index for full-text search within conversations
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_conversation
            ON messages(conversation_id, created_at)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_content
            ON messages(content)
        """)
        await db.commit()


@asynccontextmanager
async def get_db(db_path: Path) -> AsyncIterator[aiosqlite.Connection]:
    """Async context manager that yields a connected, WAL-mode aiosqlite connection."""
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys=ON")
        yield db
