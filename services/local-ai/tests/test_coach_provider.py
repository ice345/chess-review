import json

import httpx
import pytest

from chess_review_local_ai.coach_provider import (
    CoachGenerationError,
    CoachUnavailableError,
    OllamaProvider,
    OpenAIResponsesProvider,
)


def test_ollama_provider_sends_native_structured_output_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama.test")
    monkeypatch.setenv("OLLAMA_MODEL", "gemma4:12b-it-qat")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/chat"
        body = json.loads(request.content)
        assert body["model"] == "gemma4:12b-it-qat"
        assert body["think"] is False
        assert body["stream"] is False
        assert body["format"] == {"type": "object"}
        assert body["messages"][0]["role"] == "system"
        return httpx.Response(200, json={"model": "gemma4:12b-it-qat", "message": {"content": '{"headline":"Grounded"}'}})

    provider = OllamaProvider(httpx.Client(transport=httpx.MockTransport(handler)))
    result = provider.generate_json(
        instructions="facts only",
        facts_json="{}",
        schema={"type": "object"},
        schema_name="ignored_by_ollama",
        model=None,
    )

    assert result.model == "gemma4:12b-it-qat"
    assert result.content == {"headline": "Grounded"}


def test_ollama_provider_reports_output_budget_exhaustion(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama.test")
    provider = OllamaProvider(httpx.Client(transport=httpx.MockTransport(
        lambda _: httpx.Response(200, json={
            "model": "gemma4:12b-it-qat",
            "done_reason": "length",
            "message": {"content": ""},
        })
    )))

    with pytest.raises(CoachGenerationError, match="output budget"):
        provider.generate_json(
            instructions="facts only",
            facts_json="{}",
            schema={"type": "object"},
            schema_name="ignored_by_ollama",
            model=None,
        )


def test_ollama_provider_reports_missing_configured_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama.test")
    monkeypatch.setenv("OLLAMA_MODEL", "gemma4:12b-it-qat")
    provider = OllamaProvider(httpx.Client(transport=httpx.MockTransport(
        lambda _: httpx.Response(200, json={"models": [{"name": "another-model:latest"}]})
    )))

    assert provider.status == "available"
    assert provider.model_status == "missing"


def test_openai_provider_uses_responses_json_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_BASE_URL", "https://compatible.test/v1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/responses"
        assert request.headers["authorization"] == "Bearer test-key"
        body = json.loads(request.content)
        assert body["store"] is False
        assert body["instructions"] == "facts only"
        assert body["text"]["format"] == {
            "type": "json_schema",
            "name": "coach_schema",
            "strict": True,
            "schema": {"type": "object"},
        }
        return httpx.Response(200, json={
            "model": "test-model-2026-08-01",
            "output": [{"content": [{"type": "output_text", "text": '{"summary":"Validated"}'}]}],
        })

    provider = OpenAIResponsesProvider(httpx.Client(transport=httpx.MockTransport(handler)))
    result = provider.generate_json(
        instructions="facts only",
        facts_json='{"factsVersion":1}',
        schema={"type": "object"},
        schema_name="coach_schema",
        model=None,
    )

    assert result.model == "test-model-2026-08-01"
    assert result.content == {"summary": "Validated"}


def test_openai_provider_requires_server_side_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    provider = OpenAIResponsesProvider(httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(500))))

    with pytest.raises(CoachUnavailableError, match="OPENAI_API_KEY"):
        provider.generate_json(
            instructions="facts only",
            facts_json="{}",
            schema={"type": "object"},
            schema_name="coach_schema",
            model="test-model",
        )
