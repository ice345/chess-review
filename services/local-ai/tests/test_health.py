from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from chess_review_local_ai.maia_provider import MaiaUnavailableError
from chess_review_local_ai.main import app, get_coach_service, get_maia_provider
from chess_review_local_ai.schemas import HumanWdl, MaiaCandidate, MaiaMovesRequest, MaiaMovesResponse


class AvailableMaia:
    status = "available"

    def analyze(self, request: MaiaMovesRequest) -> MaiaMovesResponse:
        return MaiaMovesResponse(
            model=request.model,
            target_elo=request.target_elo,
            self_elo=request.self_elo,
            opponent_elo=request.opponent_elo,
            candidates=[
                MaiaCandidate(uci="a2a3", san="Ka3", probability=0.62),
                MaiaCandidate(uci="a2b3", san="Kb3", probability=0.23),
            ],
            candidate_probability_mass=0.85,
            played_move_probability=0.23,
            expected_human_move="a2a3",
            human_wdl=HumanWdl(win=0.2, draw=0.7, loss=0.1),
        )


class UnavailableMaia:
    status = "not-installed"

    def analyze(self, _: MaiaMovesRequest) -> MaiaMovesResponse:
        raise MaiaUnavailableError("Install the pinned Maia-3 optional dependency.")


class CoachRegistryStatus:
    def statuses(self) -> dict[str, object]:
        return {
            "ollama": "available",
            "ollama_model": "available",
            "configured_model": "gemma4:12b-it-qat",
            "ollama_models": ["gemma4:12b-it-qat", "qwen3:8b"],
            "openai_compatible": "not-configured",
        }


class CoachStatusService:
    registry = CoachRegistryStatus()


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.clear()


def test_health_preserves_optional_capability_status() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    app.dependency_overrides[get_coach_service] = lambda: CoachStatusService()
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "maia": "available",
        "coach": {
            "ollama": "available",
            "ollamaModel": "available",
            "configuredModel": "gemma4:12b-it-qat",
            "ollamaModels": ["gemma4:12b-it-qat", "qwen3:8b"],
            "openaiCompatible": "not-configured",
        },
    }


def test_local_development_port_is_allowed_by_cors() -> None:
    response = TestClient(app).options(
        "/health",
        headers={
            "Origin": "http://localhost:4317",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4317"


def test_maia_response_preserves_policy_probability_and_human_wdl() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    response = TestClient(app).post(
        "/maia/moves",
        json={
            "fen": "8/8/8/8/8/8/K6k/8 w - - 0 1",
            "target_elo": 1400,
            "self_elo": 1400,
            "opponent_elo": 1600,
            "multi_pv": 2,
            "played_move": "a2b3",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "maia3-5m"
    assert body["model_prediction"] is True
    assert body["candidates"][0] == {"uci": "a2a3", "san": "Ka3", "probability": 0.62}
    assert body["candidate_probability_mass"] == 0.85
    assert body["played_move_probability"] == 0.23
    assert body["human_wdl"] == {"win": 0.2, "draw": 0.7, "loss": 0.1}


def test_unavailable_maia_is_a_structured_optional_capability_error() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: UnavailableMaia()
    response = TestClient(app).post(
        "/maia/moves",
        json={
            "fen": "8/8/8/8/8/8/K6k/8 w - - 0 1",
            "target_elo": 1400,
            "self_elo": 1400,
            "opponent_elo": 1400,
            "multi_pv": 5,
        },
    )
    assert response.status_code == 503
    assert response.json()["detail"] == {
        "code": "maia-unavailable",
        "message": "Install the pinned Maia-3 optional dependency.",
    }


def test_invalid_fen_is_rejected_before_inference() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    response = TestClient(app).post(
        "/maia/moves",
        json={
            "fen": "not-a-fen",
            "target_elo": 1400,
            "self_elo": 1400,
            "opponent_elo": 1400,
        },
    )
    assert response.status_code == 422
