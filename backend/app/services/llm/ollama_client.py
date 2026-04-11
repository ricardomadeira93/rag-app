from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx


class OllamaClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def check_status(self) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                payload = response.json()
        except Exception:
            return {"status": "not_running"}

        models = self._read_model_names(payload)
        return {"status": "running", "models": models}

    async def list_models(self) -> list[str]:
        status = await self.check_status()
        if status["status"] != "running":
            return []
        return status["models"]

    async def generate(self, prompt: str, model: str) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
            )
            response.raise_for_status()
            payload = response.json()
        return str(payload.get("response", ""))

    async def stream_generate(self, prompt: str, model: str) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": True},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    token = chunk.get("response")
                    if token:
                        yield str(token)

    async def embed(self, text: str, model: str) -> list[float]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": model, "prompt": text},
            )
            response.raise_for_status()
            payload = response.json()
        embedding = payload.get("embedding", [])
        return [float(value) for value in embedding]

    def _read_model_names(self, payload: dict[str, Any]) -> list[str]:
        models = payload.get("models", [])
        names: list[str] = []
        for model in models:
            if isinstance(model, dict) and model.get("name"):
                names.append(str(model["name"]))
        return names


def build_ollama_client(base_url: str) -> OllamaClient:
    return OllamaClient(base_url=base_url)
