from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Protocol

from litellm import acompletion

from app.core.config import EnvironmentSettings
from app.schemas.chat import ChatMessage
from app.schemas.settings import PersistedSettings
from app.services.llm.ollama_client import build_ollama_client


class LLMProvider(Protocol):
    async def stream_chat(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        ...

    async def generate_json(self, messages: list[ChatMessage]) -> str:
        ...


@dataclass
class LiteLLMChatProvider:
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None

    async def stream_chat(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        response = await acompletion(
            model=_resolve_model_name(self.provider, self.model),
            messages=[message.model_dump() for message in messages],
            api_key=self.api_key,
            api_base=self.base_url,
            stream=True,
        )

        async for chunk in response:
            choices = _read(chunk, "choices") or []
            if not choices:
                continue
            delta = _read(choices[0], "delta") or {}
            content = _read(delta, "content")
            if content:
                yield content

    async def generate_json(self, messages: list[ChatMessage]) -> str:
        response = await acompletion(
            model=_resolve_model_name(self.provider, self.model),
            messages=[message.model_dump() for message in messages],
            api_key=self.api_key,
            api_base=self.base_url,
            response_format={"type": "json_object"},
            stream=False,
        )

        choices = _read(response, "choices") or []
        if not choices:
            return ""
            
        message = _read(choices[0], "message") or {}
        return _read(message, "content") or ""


@dataclass
class OllamaChatProvider:
    model: str
    base_url: str
    keep_alive: str | None = None

    async def stream_chat(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        payload_messages = [{"role": msg.role, "content": msg.content} for msg in messages]
        client = build_ollama_client(self.base_url, keep_alive=self.keep_alive)
        async for token in client.stream_chat(messages=payload_messages, model=self.model):
            yield token

    async def generate_json(self, messages: list[ChatMessage]) -> str:
        payload_messages = [{"role": msg.role, "content": msg.content} for msg in messages]
        client = build_ollama_client(self.base_url, keep_alive=self.keep_alive)
        return await client.chat(messages=payload_messages, model=self.model, format="json")


def build_llm_provider(settings: PersistedSettings, env: EnvironmentSettings, use_enrichment_model: bool = False) -> LLMProvider:
    if settings.llm_provider in {"openai", "anthropic"} and not settings.llm_api_key:
        raise ValueError(f"{settings.llm_provider} requires an API key")

    base_url = settings.llm_base_url
    if settings.llm_provider == "ollama" and not base_url:
        base_url = env.ollama_base_url

    model_to_use = settings.enrichment_model if use_enrichment_model else settings.llm_model

    if settings.llm_provider == "ollama":
        return OllamaChatProvider(
            model=model_to_use,
            base_url=base_url or env.ollama_base_url,
            keep_alive=env.ollama_keep_alive,
        )

    return LiteLLMChatProvider(
        provider=settings.llm_provider,
        model=model_to_use,
        api_key=settings.llm_api_key,
        base_url=base_url,
    )


def _resolve_model_name(provider: str, model: str) -> str:
    if "/" in model:
        return model
    return f"{provider}/{model}"


def _read(value: object, key: str) -> object | None:
    if isinstance(value, dict):
        return value.get(key)
    return getattr(value, key, None)


# Function removed as native chat templates are now strictly leveraged.
