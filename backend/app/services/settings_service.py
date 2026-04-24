from __future__ import annotations

import json
from datetime import datetime, timezone

from app.core.config import EnvironmentSettings
from app.schemas.settings import PersistedSettings, SettingsResponse, SettingsUpdate
from app.services.workspace_service import WorkspaceService


class SettingsService:
    def __init__(self, env: EnvironmentSettings, workspace_service: WorkspaceService) -> None:
        self.env = env
        self.workspace_service = workspace_service

    def get_settings(self, workspace_id: str | None = None) -> PersistedSettings:
        workspace_id = workspace_id or self._get_active_workspace_id()
        settings_file = self.env.workspace_settings_file(workspace_id)
        settings_file.parent.mkdir(parents=True, exist_ok=True)
        if not settings_file.exists():
            settings = PersistedSettings()
            settings.current_workspace_id = workspace_id
            self.save_settings(settings)
            return settings

        payload = json.loads(settings_file.read_text(encoding="utf-8"))
        payload.setdefault("current_workspace_id", workspace_id)
        return PersistedSettings.model_validate(payload)

    def save_settings(self, settings: PersistedSettings) -> PersistedSettings:
        settings.updated_at = datetime.now(timezone.utc).isoformat()
        workspace_id = settings.current_workspace_id or self._get_active_workspace_id()
        settings.current_workspace_id = workspace_id
        settings_file = self.env.workspace_settings_file(workspace_id)
        settings_file.parent.mkdir(parents=True, exist_ok=True)
        settings_file.write_text(
            settings.model_dump_json(indent=2),
            encoding="utf-8",
        )
        return settings

    def update_settings(self, update: SettingsUpdate, indexed_documents: int) -> PersistedSettings:
        current = self.get_settings()
        previous_signature = current.embedding_signature.value
        merged = PersistedSettings.model_validate(
            {
                **current.model_dump(),
                **update.model_dump(exclude_unset=True),
            }
        )
        merged.updated_at = datetime.now(timezone.utc).isoformat()

        if merged.embedding_signature.value != previous_signature and indexed_documents > 0:
            merged.reindex_required = True
        elif indexed_documents == 0:
            merged.reindex_required = False

        return self.save_settings(merged)

    def mark_reindexed(self) -> PersistedSettings:
        settings = self.get_settings()
        settings.reindex_required = False
        return self.save_settings(settings)

    def to_response(self, indexed_documents: int) -> SettingsResponse:
        settings = self.get_settings()
        return SettingsResponse(
            **settings.model_dump(),
            indexed_documents=indexed_documents,
            current_embedding_signature=settings.embedding_signature,
            supported_llm_providers=["ollama", "openai", "anthropic"],
            supported_embedding_providers=["ollama", "openai"],
        )

    def _get_active_workspace_id(self) -> str:
        return self.workspace_service.get_active_workspace_id_sync()
