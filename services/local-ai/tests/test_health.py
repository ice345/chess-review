from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from chess_review_local_ai.maia_provider import MaiaUnavailableError
from chess_review_local_ai.main import app, get_coach_service, get_maia_provider
from chess_review_local_ai.schemas import (
    HumanWdl,
    MaiaCandidate,
    MaiaMoveReviewRequest,
    MaiaMoveReviewResponse,
    MaiaMovesRequest,
    MaiaMovesResponse,
    MaiaPositionAnalysisRequest,
    MaiaPositionAnalysisResponse,
)


class AvailableMaia:
    status = "available"
    model_statuses = {
        "maia3-5m": "active",
        "maia3-23m": "cached",
        "maia3-79m": "not-cached",
    }

    def prepare_model(self, _model: str) -> str:
        return "cached"

    def review_move(self, request: MaiaMoveReviewRequest) -> MaiaMoveReviewResponse:
        return MaiaMoveReviewResponse(
            fen_before=request.fen_before,
            played_move=request.played_move,
            model=request.model,
            target_elo=request.target_elo,
            self_elo=request.self_elo,
            opponent_elo=request.opponent_elo,
            candidates=[
                MaiaCandidate(uci="a2a3", san="Ka3", probability=0.62, policy_rank=1),
                MaiaCandidate(uci="a2b3", san="Kb3", probability=0.23, policy_rank=2),
            ],
            candidate_probability_mass=0.85,
            played_move_probability=0.23,
            played_move_rank=2,
            expected_human_move="a2a3",
            played_move_wdl=HumanWdl(win=0.2, draw=0.7, loss=0.1),
        )

    def analyze_position(self, request: MaiaPositionAnalysisRequest) -> MaiaPositionAnalysisResponse:
        candidates = [
            MaiaCandidate(
                uci="a2a3",
                san="Ka3",
                probability=0.62,
                policy_rank=1,
                wdl=HumanWdl(win=0.3, draw=0.6, loss=0.1),
            ),
            MaiaCandidate(uci="a2b3", san="Kb3", probability=0.23, policy_rank=2),
        ]
        return MaiaPositionAnalysisResponse(
            fen=request.fen,
            side_to_move="white",
            model=request.model,
            target_elo=request.target_elo,
            self_elo=request.self_elo,
            opponent_elo=request.opponent_elo,
            candidates=candidates,
            evaluated_candidates=candidates,
            candidate_probability_mass=0.85,
            expected_human_move="a2a3",
            root_wdl=HumanWdl(win=0.4, draw=0.35, loss=0.25),
        )

    def analyze(self, request: MaiaMovesRequest) -> MaiaMovesResponse:
        return MaiaMovesResponse(
            model=request.model,
            target_elo=request.target_elo,
            self_elo=request.self_elo,
            opponent_elo=request.opponent_elo,
            candidates=[
                MaiaCandidate(uci="a2a3", san="Ka3", probability=0.62, policy_rank=1),
                MaiaCandidate(uci="a2b3", san="Kb3", probability=0.23, policy_rank=2),
            ],
            candidate_probability_mass=0.85,
            played_move_probability=0.23,
            expected_human_move="a2a3",
            human_wdl=HumanWdl(win=0.2, draw=0.7, loss=0.1),
        )


class UnavailableMaia:
    status = "not-installed"
    model_statuses = {
        "maia3-5m": "unavailable",
        "maia3-23m": "unavailable",
        "maia3-79m": "unavailable",
    }

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
        "maiaModels": {
            "maia3-5m": "active",
            "maia3-23m": "cached",
            "maia3-79m": "not-cached",
        },
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


def test_explicit_model_download_requires_trusted_origin_and_json_confirmation() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    response = TestClient(app).post(
        "/maia/models/maia3-23m/download",
        headers={"Origin": "http://localhost:3000"},
        json={"confirm": True},
    )
    assert response.status_code == 200
    assert response.json() == {"model": "maia3-23m", "status": "cached"}


@pytest.mark.parametrize("origin", [None, "https://attacker.example", "null"])
def test_model_download_rejects_untrusted_browser_origins(origin: str | None) -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    headers = {} if origin is None else {"Origin": origin}
    response = TestClient(app).post(
        "/maia/models/maia3-79m/download",
        headers=headers,
        json={"confirm": True},
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "trusted-local-origin-required"


def test_model_download_rejects_simple_form_and_missing_confirmation() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    response = TestClient(app).post(
        "/maia/models/maia3-79m/download",
        headers={"Origin": "http://127.0.0.1:3000"},
        data={"confirm": "true"},
    )
    assert response.status_code == 422

    response = TestClient(app).post(
        "/maia/models/maia3-79m/download",
        headers={"Origin": "http://127.0.0.1:3000"},
        json={},
    )
    assert response.status_code == 422


def test_move_review_response_preserves_policy_rank_probability_and_played_wdl() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    response = TestClient(app).post(
        "/maia/move-review",
        json={
            "fen_before": "8/8/8/8/8/8/K6k/8 w - - 0 1",
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
    assert body["candidates"][0] == {"uci": "a2a3", "san": "Ka3", "probability": 0.62, "policy_rank": 1, "wdl": None}
    assert body["candidate_probability_mass"] == 0.85
    assert body["played_move_probability"] == 0.23
    assert body["played_move_rank"] == 2
    assert body["played_move_wdl"] == {"win": 0.2, "draw": 0.7, "loss": 0.1}


def test_position_response_keeps_root_wdl_explicit() -> None:
    app.dependency_overrides[get_maia_provider] = lambda: AvailableMaia()
    response = TestClient(app).post(
        "/maia/position-analysis",
        json={
            "fen": "8/8/8/8/8/8/K6k/8 w - - 0 1",
            "target_elo": 1400,
            "self_elo": 1400,
            "opponent_elo": 1600,
            "multi_pv": 2,
        },
    )
    assert response.status_code == 200
    assert response.json()["root_wdl"] == {"win": 0.4, "draw": 0.35, "loss": 0.25}
    assert response.json()["side_to_move"] == "white"


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
