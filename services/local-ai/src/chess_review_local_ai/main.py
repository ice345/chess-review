import os
import re
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from .coach_provider import CoachGenerationError, CoachUnavailableError
from .coach_service import CoachService
from .maia_provider import (
    Maia3Provider,
    MaiaInferenceError,
    MaiaModelSetupRequiredError,
    MaiaProvider,
    MaiaUnavailableError,
)
from .schemas import (
    CoachExplainRequest,
    CoachExplanationResponse,
    CoachGameSummaryRequest,
    CoachGameSummaryResponse,
    CoachHealth,
    HealthResponse,
    MaiaModelName,
    MaiaModelSetupRequest,
    MaiaModelSetupResponse,
    MaiaMoveReviewRequest,
    MaiaMoveReviewResponse,
    MaiaMovesRequest,
    MaiaMovesResponse,
    MaiaPositionAnalysisRequest,
    MaiaPositionAnalysisResponse,
)

app = FastAPI(title="Open Chess Review Local AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(?:localhost|127\.0\.0\.1)(?::\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_TRUSTED_BROWSER_ORIGIN = re.compile(r"^http://(?:localhost|127\.0\.0\.1)(?::\d+)?$")
_SERVICE_TOKEN = os.environ.get("LOCAL_AI_TOKEN", "")


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
    return HealthResponse(
        maia=provider.status,
        maia_models=provider.model_statuses,
        coach=CoachHealth(**coach_service.registry.statuses()),
    )


def _run_maia(operation):
    try:
        return operation()
    except MaiaModelSetupRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "maia-model-not-cached", "message": str(exc)},
        ) from exc
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


def require_service_token(request: Request) -> None:
    if not _SERVICE_TOKEN:
        return
    if request.headers.get("x-open-chess-review-token") != _SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "local-service-token-required",
                "message": "This local-ai instance requires the launcher capability token.",
            },
        )


def require_trusted_browser_origin(request: Request) -> None:
    """Protect explicit local mutations from cross-site browser requests.

    CORS prevents an untrusted page from reading a response; it is not CSRF
    protection by itself. Model setup additionally requires an allowed Origin
    and a JSON confirmation body, so a simple cross-origin form cannot trigger
    a checkpoint download.
    """
    origin = request.headers.get("origin")
    if origin is None or _TRUSTED_BROWSER_ORIGIN.fullmatch(origin) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "trusted-local-origin-required",
                "message": "Model download requires confirmation from the local Open Chess Review UI.",
            },
        )


@app.post("/maia/move-review", response_model=MaiaMoveReviewResponse)
def maia_move_review(
    request: MaiaMoveReviewRequest,
    _token: None = Depends(require_service_token),
    provider: MaiaProvider = Depends(get_maia_provider),
) -> MaiaMoveReviewResponse:
    return _run_maia(lambda: provider.review_move(request))


@app.post("/maia/position-analysis", response_model=MaiaPositionAnalysisResponse)
def maia_position_analysis(
    request: MaiaPositionAnalysisRequest,
    _token: None = Depends(require_service_token),
    provider: MaiaProvider = Depends(get_maia_provider),
) -> MaiaPositionAnalysisResponse:
    return _run_maia(lambda: provider.analyze_position(request))


@app.post("/maia/models/{model}/download", response_model=MaiaModelSetupResponse)
def maia_model_download(
    model: MaiaModelName,
    _confirmation: MaiaModelSetupRequest,
    _trusted_origin: None = Depends(require_trusted_browser_origin),
    _token: None = Depends(require_service_token),
    provider: MaiaProvider = Depends(get_maia_provider),
) -> MaiaModelSetupResponse:
    model_status = _run_maia(lambda: provider.prepare_model(model))
    return MaiaModelSetupResponse(model=model, status=model_status)


@app.post("/maia/moves", response_model=MaiaMovesResponse)
def maia_moves(
    request: MaiaMovesRequest,
    _token: None = Depends(require_service_token),
    provider: MaiaProvider = Depends(get_maia_provider),
) -> MaiaMovesResponse:
    return _run_maia(lambda: provider.analyze(request))


@app.post("/maia/analyze", response_model=MaiaMovesResponse)
def maia_analyze(
    request: MaiaMovesRequest,
    provider: MaiaProvider = Depends(get_maia_provider),
) -> MaiaMovesResponse:
    return maia_moves(request, provider)


@app.post("/coach/explain", response_model=CoachExplanationResponse)
def coach_explain(
    request: CoachExplainRequest,
    _token: None = Depends(require_service_token),
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
    _token: None = Depends(require_service_token),
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
