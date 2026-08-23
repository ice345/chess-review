from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx


CoachProviderName = Literal["ollama", "openai-compatible"]


class CoachUnavailableError(RuntimeError):
    """Raised when an optional coach provider cannot be reached or configured."""


class CoachGenerationError(RuntimeError):
    """Raised when a configured provider returns an unusable response."""


@dataclass(frozen=True)
class CoachProviderResult:
    content: dict[str, object]
    model: str


class CoachProvider(Protocol):
    name: CoachProviderName

    @property
    def status(self) -> str: ...

    def generate_json(
        self,
        *,
        instructions: str,
        facts_json: str,
        schema: dict[str, object],
        schema_name: str,
        model: str | None,
    ) -> CoachProviderResult: ...


def _json_object(content: object) -> dict[str, object]:
    if isinstance(content, dict):
        return content
    if not isinstance(content, str):
        raise CoachGenerationError("Coach provider did not return JSON text.")
    value = content.strip()
    if value.startswith("```"):
        lines = value.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        value = "\n".join(lines).strip()
    object_start = value.find("{")
    object_end = value.rfind("}")
    if object_start >= 0 and object_end > object_start:
        value = value[object_start:object_end + 1]
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise CoachGenerationError("Coach provider returned invalid JSON.") from exc
    if not isinstance(parsed, dict):
        raise CoachGenerationError("Coach provider JSON must be an object.")
    return parsed


class OllamaProvider:
    name: CoachProviderName = "ollama"

    def __init__(self, client: httpx.Client | None = None) -> None:
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        self.default_model = os.getenv("OLLAMA_MODEL", "gemma4:12b-it-qat")
        self.context_size = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
        self.max_output_tokens = int(os.getenv("OLLAMA_NUM_PREDICT", "900"))
        self.client = client or httpx.Client(timeout=httpx.Timeout(180, connect=3))

    @property
    def status(self) -> Literal["available", "offline", "error"]:
        try:
            response = self.client.get(f"{self.base_url}/api/tags", timeout=2)
            return "available" if response.is_success else "error"
        except httpx.HTTPError:
            return "offline"

    @property
    def model_status(self) -> Literal["available", "missing", "offline", "error"]:
        try:
            response = self.client.get(f"{self.base_url}/api/tags", timeout=2)
            if not response.is_success:
                return "error"
            body = response.json()
            models = body.get("models", []) if isinstance(body, dict) else []
            names = {
                str(model.get("name"))
                for model in models
                if isinstance(model, dict) and model.get("name")
            }
            return "available" if self.default_model in names else "missing"
        except ValueError:
            return "error"
        except httpx.HTTPError:
            return "offline"

    def generate_json(
        self,
        *,
        instructions: str,
        facts_json: str,
        schema: dict[str, object],
        schema_name: str,
        model: str | None,
    ) -> CoachProviderResult:
        del schema_name
        selected_model = model or self.default_model
        try:
            response = self.client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": selected_model,
                    "think": False,
                    "messages": [
                        {"role": "system", "content": instructions},
                        {"role": "user", "content": facts_json},
                    ],
                    "stream": False,
                    "format": schema,
                    "options": {
                        "temperature": 0.2,
                        "num_ctx": self.context_size,
                        "num_predict": self.max_output_tokens,
                    },
                },
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                detail = str(exc.response.json().get("error", "request rejected"))[:240]
            except (ValueError, AttributeError):
                detail = "request rejected"
            raise CoachUnavailableError(f"Ollama rejected model {selected_model}: {detail}") from exc
        except httpx.TimeoutException as exc:
            raise CoachUnavailableError(f"Ollama timed out while running model {selected_model}.") from exc
        except httpx.HTTPError as exc:
            raise CoachUnavailableError(f"Ollama request failed for model {selected_model}.") from exc
        try:
            body = response.json()
        except ValueError as exc:
            raise CoachGenerationError("Ollama returned a non-JSON response envelope.") from exc
        message = body.get("message") if isinstance(body, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if body.get("done_reason") == "length" and not content:
            raise CoachGenerationError(
                "Ollama exhausted the output budget before producing structured JSON."
            )
        return CoachProviderResult(content=_json_object(content), model=str(body.get("model") or selected_model))


class OpenAIResponsesProvider:
    name: CoachProviderName = "openai-compatible"

    def __init__(self, client: httpx.Client | None = None) -> None:
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.default_model = os.getenv("OPENAI_MODEL")
        self.client = client or httpx.Client(timeout=httpx.Timeout(180, connect=5))

    @property
    def status(self) -> Literal["configured", "not-configured"]:
        return "configured" if self.api_key else "not-configured"

    def generate_json(
        self,
        *,
        instructions: str,
        facts_json: str,
        schema: dict[str, object],
        schema_name: str,
        model: str | None,
    ) -> CoachProviderResult:
        selected_model = model or self.default_model
        if not self.api_key:
            raise CoachUnavailableError("OPENAI_API_KEY is not configured for the local service.")
        if not selected_model:
            raise CoachUnavailableError("Choose a model or configure OPENAI_MODEL for the local service.")
        try:
            response = self.client.post(
                f"{self.base_url}/responses",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": selected_model,
                    "instructions": instructions,
                    "input": facts_json,
                    "store": False,
                    "max_output_tokens": 1800,
                    "text": {
                        "format": {
                            "type": "json_schema",
                            "name": schema_name,
                            "strict": True,
                            "schema": schema,
                        },
                    },
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise CoachUnavailableError(f"OpenAI-compatible Responses request failed for model {selected_model}.") from exc
        try:
            body = response.json()
        except ValueError as exc:
            raise CoachGenerationError("OpenAI-compatible provider returned a non-JSON response envelope.") from exc
        content = body.get("output_text") if isinstance(body, dict) else None
        if not isinstance(content, str) and isinstance(body, dict):
            for item in body.get("output", []):
                if not isinstance(item, dict):
                    continue
                for block in item.get("content", []):
                    if isinstance(block, dict) and block.get("type") == "output_text" and isinstance(block.get("text"), str):
                        content = block["text"]
                        break
                if isinstance(content, str):
                    break
        return CoachProviderResult(content=_json_object(content), model=str(body.get("model") or selected_model))


class CoachProviderRegistry:
    def __init__(
        self,
        ollama: CoachProvider | None = None,
        openai_compatible: CoachProvider | None = None,
    ) -> None:
        self.ollama = ollama or OllamaProvider()
        self.openai_compatible = openai_compatible or OpenAIResponsesProvider()

    def get(self, provider: CoachProviderName) -> CoachProvider:
        return self.ollama if provider == "ollama" else self.openai_compatible

    def statuses(self) -> dict[str, str]:
        return {
            "ollama": self.ollama.status,
            "ollama_model": getattr(self.ollama, "model_status", "error"),
            "configured_model": getattr(self.ollama, "default_model", "unknown"),
            "openai_compatible": self.openai_compatible.status,
        }
