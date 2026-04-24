from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import aiosqlite


async def init_chunking_db(db_path: Path) -> None:
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS parent_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                content TEXT NOT NULL
            )
            """
        )
        await db.commit()


@asynccontextmanager
async def get_chunking_db(db_path: Path) -> AsyncIterator[aiosqlite.Connection]:
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db
