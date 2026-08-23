from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .coach_provider import CoachGenerationError, CoachUnavailableError
from .coach_service import CoachService
from .maia_provider import Maia3Provider, MaiaInferenceError, MaiaProvider, MaiaUnavailableError
from .schemas import (
    CoachExplainRequest,
    CoachExplanationResponse,
    CoachGameSummaryRequest,
    CoachGameSummaryResponse,
    CoachHealth,
    HealthResponse,
    MaiaMovesRequest,
    MaiaMovesResponse,
)

app = FastAPI(title="Open Chess Review Local AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(?:localhost|127\.0\.0\.1)(?::\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@lru_cache(maxsize=1)
def get_maia_provider() -> MaiaProvider:
    return Maia3Provider()


@lru_cache(maxsize=1)
def get_coach_service() -> CoachService:
    return CoachService()


@app.get("/health", response_model=HealthResponse)
def health(
    provider: MaiaProvider = Depends(get_maia_provider),
    coach_service: CoachService = Depends(get_coach_service),
) -> HealthResponse:
    return HealthResponse(maia=provider.status, coach=CoachHealth(**coach_service.registry.statuses()))


@app.post("/maia/moves", response_model=MaiaMovesResponse)
def maia_moves(
    request: MaiaMovesRequest,
    provider: MaiaProvider = Depends(get_maia_provider),
) -> MaiaMovesResponse:
    try:
        return provider.analyze(request)
    except MaiaUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "maia-unavailable", "message": str(exc)},
        ) from exc
    except MaiaInferenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "maia-inference-failed", "message": str(exc)},
        ) from exc


@app.post("/maia/analyze", response_model=MaiaMovesResponse)
def maia_analyze(
    request: MaiaMovesRequest,
    provider: MaiaProvider = Depends(get_maia_provider),
) -> MaiaMovesResponse:
    return maia_moves(request, provider)


@app.post("/coach/explain", response_model=CoachExplanationResponse)
def coach_explain(
    request: CoachExplainRequest,
    coach_service: CoachService = Depends(get_coach_service),
) -> CoachExplanationResponse:
    try:
        return coach_service.explain(request)
    except CoachUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "coach-unavailable", "message": str(exc)},
        ) from exc
    except CoachGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "coach-invalid-output", "message": str(exc)},
        ) from exc


@app.post("/coach/game-summary", response_model=CoachGameSummaryResponse)
def coach_game_summary(
    request: CoachGameSummaryRequest,
    coach_service: CoachService = Depends(get_coach_service),
) -> CoachGameSummaryResponse:
    try:
        return coach_service.game_summary(request)
    except CoachUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "coach-unavailable", "message": str(exc)},
        ) from exc
    except CoachGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "coach-invalid-output", "message": str(exc)},
        ) from exc
