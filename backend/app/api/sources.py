from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/sources")
async def list_sources() -> list[dict[str, object]]:
    return [
        {
            "id": "manual-upload",
            "name": "Manual uploads",
            "status": "manual",
            "description": "Files uploaded directly into the workspace",
            "last_synced": None,
            "items_indexed": 0,
        }
    ]


@router.post("/sources/{source_id}/connect")
async def connect_source(source_id: str) -> dict[str, str]:
    return {"auth_url": ""}
