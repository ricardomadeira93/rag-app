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


@dataclass
class OllamaChatProvider:
    model: str
    base_url: str

    async def stream_chat(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        prompt = _build_prompt(messages)
        client = build_ollama_client(self.base_url)
        async for token in client.stream_generate(prompt=prompt, model=self.model):
            yield token


def build_llm_provider(settings: PersistedSettings, env: EnvironmentSettings) -> LLMProvider:
    if settings.llm_provider in {"openai", "anthropic"} and not settings.llm_api_key:
        raise ValueError(f"{settings.llm_provider} requires an API key")

    base_url = settings.llm_base_url
    if settings.llm_provider == "ollama" and not base_url:
        base_url = env.ollama_base_url

    if settings.llm_provider == "ollama":
        return OllamaChatProvider(model=settings.llm_model, base_url=base_url or env.ollama_base_url)

    return LiteLLMChatProvider(
        provider=settings.llm_provider,
        model=settings.llm_model,
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


def _build_prompt(messages: list[ChatMessage]) -> str:
    lines: list[str] = []
    for message in messages:
        label = message.role.capitalize()
        lines.append(f"{label}: {message.content}")
    lines.append("Assistant:")
    return "\n\n".join(lines)
