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
                created_at      TEXT NOT NULL
            )
        """)
        await db.commit()


@asynccontextmanager
async def get_db(db_path: Path) -> AsyncIterator[aiosqlite.Connection]:
    """Async context manager that yields a connected, WAL-mode aiosqlite connection."""
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys=ON")
        yield db
