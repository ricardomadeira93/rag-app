from __future__ import annotations

import json
from datetime import datetime, timezone

from app.core.config import EnvironmentSettings
from app.schemas.settings import PersistedSettings, SettingsResponse, SettingsUpdate


class SettingsService:
    def __init__(self, env: EnvironmentSettings) -> None:
        self.env = env

    def get_settings(self) -> PersistedSettings:
        if not self.env.settings_file.exists():
            settings = PersistedSettings()
            self.save_settings(settings)
            return settings

        payload = json.loads(self.env.settings_file.read_text(encoding="utf-8"))
        return PersistedSettings.model_validate(payload)

    def save_settings(self, settings: PersistedSettings) -> PersistedSettings:
        settings.updated_at = datetime.now(timezone.utc).isoformat()
        self.env.settings_file.write_text(
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
