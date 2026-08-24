from __future__ import annotations

import gc
import importlib.util
import sys
from dataclasses import dataclass
from threading import RLock
from typing import Any, Callable, Literal, Protocol

import chess

from .schemas import (
    HumanWdl,
    MaiaCandidate,
    MaiaModelName,
    MaiaModelState,
    MaiaMoveReviewRequest,
    MaiaMoveReviewResponse,
    MaiaMovesRequest,
    MaiaMovesResponse,
    MaiaPositionAnalysisRequest,
    MaiaPositionAnalysisResponse,
)

MAIA_MODELS: tuple[MaiaModelName, ...] = ("maia3-5m", "maia3-23m", "maia3-79m")


class MaiaUnavailableError(RuntimeError):
    """Raised when the optional Maia runtime cannot be used."""


class MaiaModelSetupRequiredError(MaiaUnavailableError):
    """Raised when a request targets a checkpoint the user has not downloaded."""


class MaiaInferenceError(RuntimeError):
    """Raised when Maia inference fails after the provider is available."""


class MaiaProvider(Protocol):
    @property
    def status(self) -> Literal["available", "not-installed", "error"]: ...

    @property
    def model_statuses(self) -> dict[str, MaiaModelState]: ...

    def prepare_model(self, model: MaiaModelName) -> MaiaModelState: ...

    def review_move(self, request: MaiaMoveReviewRequest) -> MaiaMoveReviewResponse: ...

    def analyze_position(self, request: MaiaPositionAnalysisRequest) -> MaiaPositionAnalysisResponse: ...

    def analyze(self, request: MaiaMovesRequest) -> MaiaMovesResponse: ...


@dataclass(frozen=True)
class _PolicyCandidate:
    move: chess.Move
    probability: float
    rank: int


@dataclass(frozen=True)
class _Inference:
    root_wdl: tuple[int, int, int]
    policy: list[_PolicyCandidate]
    candidate_wdls: dict[str, tuple[int, int, int]]


def _human_wdl(wdl: tuple[int, int, int]) -> HumanWdl:
    return HumanWdl(win=wdl[0] / 1000, draw=wdl[1] / 1000, loss=wdl[2] / 1000)


class Maia3Provider:
    """Bounded adapter over the pinned Maia-3 implementation.

    One root forward pass yields both the complete legal-move policy and root
    human-game WDL. Value inference after a move is limited to the deduplicated
    union of Maia top-K, explicitly supplied comparison moves and the played
    move. Only one checkpoint stays resident at a time.
    """

    def __init__(self) -> None:
        self._active_model: MaiaModelName | None = None
        self._active_engine: Any | None = None
        self._model_lock = RLock()
        self._model_errors: dict[str, str] = {}

    @property
    def status(self) -> Literal["available", "not-installed", "error"]:
        return "available" if importlib.util.find_spec("maia3") is not None else "not-installed"

    def _cached_checkpoint(self, model: MaiaModelName, *, allow_download: bool) -> str:
        if self.status != "available":
            raise MaiaUnavailableError("Maia-3 is not installed. Run `uv sync --extra maia` in services/local-ai.")
        from maia3.model_registry import resolve_checkpoint_path, resolve_model_spec

        spec = resolve_model_spec(model)
        return resolve_checkpoint_path(spec, local_files_only=not allow_download)

    def _model_status_locked(self, model: MaiaModelName) -> MaiaModelState:
        if self.status != "available":
            return "unavailable"
        if self._active_model == model and self._active_engine is not None:
            return "active"
        if model in self._model_errors:
            return "error"
        try:
            self._cached_checkpoint(model, allow_download=False)
            return "cached"
        except Exception:
            return "not-cached"

    @property
    def model_statuses(self) -> dict[str, MaiaModelState]:
        with self._model_lock:
            return {model: self._model_status_locked(model) for model in MAIA_MODELS}

    def prepare_model(self, model: MaiaModelName) -> MaiaModelState:
        """Download a checkpoint only after the explicit setup endpoint is called."""
        with self._model_lock:
            try:
                self._cached_checkpoint(model, allow_download=True)
                self._model_errors.pop(model, None)
                return "active" if self._active_model == model else "cached"
            except MaiaUnavailableError:
                raise
            except Exception as exc:
                self._model_errors[model] = str(exc)
                raise MaiaUnavailableError(f"Unable to download {model}: {exc}") from exc

    def _release_active_locked(self) -> None:
        engine = self._active_engine
        self._active_engine = None
        self._active_model = None
        if engine is not None and getattr(engine, "model", None) is not None:
            engine.model = None
        del engine
        gc.collect()
        torch = sys.modules.get("torch")
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _load_active_locked(self, model: MaiaModelName, factory: Callable[[], Any]) -> Any:
        """Replace the resident network without overlapping model allocations."""
        self._release_active_locked()
        engine = factory()
        try:
            engine.ensure_model_loaded()
        except Exception:
            if getattr(engine, "model", None) is not None:
                engine.model = None
            gc.collect()
            torch = sys.modules.get("torch")
            if torch is not None and torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise
        self._active_model = model
        self._active_engine = engine
        return engine

    def _engine_locked(self, model: MaiaModelName) -> Any:
        if self._active_model == model and self._active_engine is not None:
            return self._active_engine
        model_status = self._model_status_locked(model)
        if model_status == "not-cached":
            raise MaiaModelSetupRequiredError(
                f"{model} is not cached. Download it explicitly before running Maia analysis."
            )
        if model_status == "unavailable":
            raise MaiaUnavailableError("Maia-3 is not installed. Run `uv sync --extra maia` in services/local-ai.")
        if model_status == "error":
            raise MaiaUnavailableError(f"{model} previously failed to initialize: {self._model_errors[model]}")

        try:
            from maia3.uci import Maia3UCIEngine, parse_args

            checkpoint = self._cached_checkpoint(model, allow_download=False)
            config = parse_args([
                "--model", model,
                "--checkpoint-path", checkpoint,
                "--local-files-only",
                "--device", "cpu",
                "--no-use-amp",
                "--temperature", "0",
                "--top-p", "1",
                "--multipv", "5",
            ])
            engine = self._load_active_locked(model, lambda: Maia3UCIEngine(config))
            self._model_errors.pop(model, None)
            return engine
        except MaiaUnavailableError:
            raise
        except Exception as exc:
            self._model_errors[model] = str(exc)
            raise MaiaUnavailableError(f"Unable to initialize {model}: {exc}") from exc

    @staticmethod
    def _validate_moves(board: chess.Board, moves: list[str]) -> list[chess.Move]:
        validated: list[chess.Move] = []
        for uci in moves:
            try:
                move = chess.Move.from_uci(uci)
            except ValueError as exc:
                raise MaiaInferenceError(f"Invalid UCI move: {uci}") from exc
            if move not in board.legal_moves:
                raise MaiaInferenceError(f"The requested move {uci} is not legal in the supplied FEN.")
            if move not in validated:
                validated.append(move)
        return validated

    def _infer(
        self,
        engine: Any,
        board: chess.Board,
        *,
        self_elo: int,
        opponent_elo: int,
        multi_pv: int,
        value_moves: list[chess.Move],
    ) -> _Inference:
        # Compatibility boundary for the pinned official Maia-3 revision. Its
        # UCI wrapper does not expose policy/value logits publicly, so all
        # private-engine access is isolated in this adapter and regression-tested.
        if board.is_game_over(claim_draw=True):
            if board.is_checkmate():
                return _Inference(root_wdl=(0, 0, 1000), policy=[], candidate_wdls={})
            return _Inference(root_wdl=(0, 1000, 0), policy=[], candidate_wdls={})

        import torch
        from torch.amp import autocast
        from maia3.dataset import get_legal_moves_mask
        from maia3.uci import invert_wdl, wdl_from_value_logits

        engine.cmd_position(f"position fen {board.fen()}")
        engine.self_elo = self_elo
        engine.oppo_elo = opponent_elo
        legal_mask = get_legal_moves_mask(engine.board, engine.all_moves_dict)
        tokens = engine._tokens_from_history(engine.history).unsqueeze(0).to(engine.cfg.device)
        self_elos = torch.tensor([self_elo], dtype=torch.long, device=engine.cfg.device)
        opponent_elos = torch.tensor([opponent_elo], dtype=torch.long, device=engine.cfg.device)

        with autocast("cuda", enabled=engine.cfg.use_amp and engine.cfg.device.startswith("cuda")):
            move_logits, root_value_logits, _ = engine.model(tokens, self_elos, opponent_elos)

        logits = move_logits[0].float()
        mask = legal_mask.to(engine.cfg.device)
        probabilities = torch.softmax(logits.masked_fill(~mask, float("-inf")), dim=-1)
        policy: list[_PolicyCandidate] = []
        for index in torch.nonzero(mask, as_tuple=False).flatten().tolist():
            move = engine._move_from_index(index)
            if move is not None:
                policy.append(_PolicyCandidate(move=move, probability=float(probabilities[index].item()), rank=0))
        policy.sort(key=lambda candidate: candidate.probability, reverse=True)
        policy = [
            _PolicyCandidate(move=candidate.move, probability=candidate.probability, rank=index + 1)
            for index, candidate in enumerate(policy)
        ]

        bounded_moves = self._bounded_value_moves(policy, multi_pv, value_moves)

        candidate_wdls: dict[str, tuple[int, int, int]] = {}
        if bounded_moves:
            candidate_tokens = torch.stack([
                engine._tokens_from_history(engine._history_after_move(move))
                for move in bounded_moves
            ]).to(engine.cfg.device)
            candidate_self_elos = torch.full(
                (len(bounded_moves),), opponent_elo, dtype=torch.long, device=engine.cfg.device
            )
            candidate_opponent_elos = torch.full(
                (len(bounded_moves),), self_elo, dtype=torch.long, device=engine.cfg.device
            )
            with autocast("cuda", enabled=engine.cfg.use_amp and engine.cfg.device.startswith("cuda")):
                _, candidate_value_logits, _ = engine.model(
                    candidate_tokens, candidate_self_elos, candidate_opponent_elos
                )
            candidate_wdls = {
                move.uci(): invert_wdl(wdl_from_value_logits(value_logits))
                for move, value_logits in zip(bounded_moves, candidate_value_logits)
            }

        return _Inference(
            root_wdl=wdl_from_value_logits(root_value_logits[0]),
            policy=policy,
            candidate_wdls=candidate_wdls,
        )

    @staticmethod
    def _bounded_value_moves(
        policy: list[_PolicyCandidate],
        multi_pv: int,
        value_moves: list[chess.Move],
    ) -> list[chess.Move]:
        bounded_moves: list[chess.Move] = []
        for move in [*(candidate.move for candidate in policy[:multi_pv]), *value_moves]:
            if move not in bounded_moves:
                bounded_moves.append(move)
        return bounded_moves

    @staticmethod
    def _candidate(board: chess.Board, candidate: _PolicyCandidate, inference: _Inference) -> MaiaCandidate:
        wdl = inference.candidate_wdls.get(candidate.move.uci())
        return MaiaCandidate(
            uci=candidate.move.uci(),
            san=board.san(candidate.move),
            probability=candidate.probability,
            policy_rank=candidate.rank,
            wdl=None if wdl is None else _human_wdl(wdl),
        )

    def _run(
        self,
        request: MaiaPositionAnalysisRequest | MaiaMoveReviewRequest,
        board: chess.Board,
        value_moves: list[chess.Move],
    ) -> _Inference:
        with self._model_lock:
            engine = self._engine_locked(request.model)
            try:
                return self._infer(
                    engine,
                    board,
                    self_elo=request.self_elo,
                    opponent_elo=request.opponent_elo,
                    multi_pv=request.multi_pv,
                    value_moves=value_moves,
                )
            except (MaiaUnavailableError, MaiaInferenceError):
                raise
            except Exception as exc:
                raise MaiaInferenceError(f"Maia-3 inference failed: {exc}") from exc

    def analyze_position(self, request: MaiaPositionAnalysisRequest) -> MaiaPositionAnalysisResponse:
        board = chess.Board(request.fen)
        requested = self._validate_moves(board, request.candidate_moves)
        inference = self._run(request, board, requested)
        candidates = [self._candidate(board, item, inference) for item in inference.policy[:request.multi_pv]]
        evaluated_uci = {
            *(candidate.uci for candidate in candidates),
            *(move.uci() for move in requested),
        }
        evaluated = [
            self._candidate(board, item, inference)
            for item in inference.policy
            if item.move.uci() in evaluated_uci
        ]
        return MaiaPositionAnalysisResponse(
            fen=request.fen,
            side_to_move="white" if board.turn == chess.WHITE else "black",
            model=request.model,
            target_elo=request.target_elo,
            self_elo=request.self_elo,
            opponent_elo=request.opponent_elo,
            candidates=candidates,
            evaluated_candidates=evaluated,
            candidate_probability_mass=sum(candidate.probability for candidate in candidates),
            expected_human_move=candidates[0].uci if candidates else None,
            root_wdl=_human_wdl(inference.root_wdl),
        )

    def review_move(self, request: MaiaMoveReviewRequest) -> MaiaMoveReviewResponse:
        board = chess.Board(request.fen_before)
        validated = self._validate_moves(board, [request.played_move, *request.candidate_moves])
        played_move = validated[0]
        inference = self._run(request, board, validated)
        candidates = [self._candidate(board, item, inference) for item in inference.policy[:request.multi_pv]]
        played = next((item for item in inference.policy if item.move == played_move), None)
        if played is None:
            raise MaiaInferenceError("Maia-3 policy did not contain the legal played move.")
        played_wdl = inference.candidate_wdls.get(played_move.uci())
        return MaiaMoveReviewResponse(
            fen_before=request.fen_before,
            played_move=request.played_move,
            model=request.model,
            target_elo=request.target_elo,
            self_elo=request.self_elo,
            opponent_elo=request.opponent_elo,
            candidates=candidates,
            candidate_probability_mass=sum(candidate.probability for candidate in candidates),
            played_move_probability=played.probability,
            played_move_rank=played.rank,
            expected_human_move=candidates[0].uci if candidates else None,
            played_move_wdl=None if played_wdl is None else _human_wdl(played_wdl),
        )

    def analyze(self, request: MaiaMovesRequest) -> MaiaMovesResponse:
        """Deprecated compatibility adapter; new product code never consumes it."""
        if request.played_move is not None:
            review = self.review_move(MaiaMoveReviewRequest(
                fen_before=request.fen,
                played_move=request.played_move,
                **request.model_dump(exclude={"fen", "played_move"}),
            ))
            return MaiaMovesResponse(
                model=review.model,
                target_elo=review.target_elo,
                self_elo=review.self_elo,
                opponent_elo=review.opponent_elo,
                candidates=review.candidates,
                candidate_probability_mass=review.candidate_probability_mass,
                played_move_probability=review.played_move_probability,
                expected_human_move=review.expected_human_move,
                human_wdl=review.played_move_wdl,
            )
        position = self.analyze_position(MaiaPositionAnalysisRequest(**request.model_dump(exclude={"played_move"})))
        return MaiaMovesResponse(
            model=position.model,
            target_elo=position.target_elo,
            self_elo=position.self_elo,
            opponent_elo=position.opponent_elo,
            candidates=position.candidates,
            candidate_probability_mass=position.candidate_probability_mass,
            played_move_probability=0,
            expected_human_move=position.expected_human_move,
            human_wdl=position.root_wdl,
        )
