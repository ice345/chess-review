from __future__ import annotations

import importlib.util
from threading import Lock
from typing import Any, Literal, Protocol

import chess

from .schemas import HumanWdl, MaiaCandidate, MaiaMovesRequest, MaiaMovesResponse


class MaiaUnavailableError(RuntimeError):
    """Raised when the optional Maia runtime or model cannot be used."""


class MaiaInferenceError(RuntimeError):
    """Raised when Maia inference fails after the provider is available."""


class MaiaProvider(Protocol):
    @property
    def status(self) -> Literal["available", "not-installed", "error"]: ...

    def analyze(self, request: MaiaMovesRequest) -> MaiaMovesResponse: ...


class Maia3Provider:
    """Lazy adapter over the pinned Maia-3 UCI implementation.

    The provider deliberately calls Maia's policy model directly through the
    UCI engine object so candidate probabilities remain policy probabilities;
    Maia's GUI-compatible centipawn value is never exposed as objective truth.
    """

    def __init__(self) -> None:
        self._engines: dict[str, Any] = {}
        self._locks: dict[str, Lock] = {}
        self._engine_creation_lock = Lock()
        self._failed = False

    @property
    def status(self) -> Literal["available", "not-installed", "error"]:
        if self._failed:
            return "error"
        return "available" if importlib.util.find_spec("maia3") is not None else "not-installed"

    def _engine(self, model: str) -> Any:
        if model in self._engines:
            return self._engines[model]
        provider_status = self.status
        if provider_status == "not-installed":
            raise MaiaUnavailableError("Maia-3 is not installed. Run `uv sync --extra maia` in services/local-ai.")
        if provider_status == "error":
            raise MaiaUnavailableError("Maia-3 initialization previously failed; restart the local service to retry.")
        with self._engine_creation_lock:
            if model in self._engines:
                return self._engines[model]
            if self._failed:
                raise MaiaUnavailableError("Maia-3 initialization previously failed; restart the local service to retry.")
            try:
                from maia3.uci import Maia3UCIEngine, parse_args

                config = parse_args([
                    "--model", model,
                    "--device", "cpu",
                    "--no-use-amp",
                    "--temperature", "0",
                    "--top-p", "1",
                    "--multipv", "5",
                ])
                engine = Maia3UCIEngine(config)
                # The upstream UCI loop loads weights on `isready`; direct adapter
                # use must invoke the equivalent lifecycle hook explicitly.
                engine.ensure_model_loaded()
                self._engines[model] = engine
                self._locks[model] = Lock()
                return engine
            except Exception as exc:  # model resolution/import has provider-specific failure modes
                self._failed = True
                raise MaiaUnavailableError(f"Unable to initialize {model}: {exc}") from exc

    def analyze(self, request: MaiaMovesRequest) -> MaiaMovesResponse:
        engine = self._engine(request.model)
        board = chess.Board(request.fen)
        try:
            played_move = chess.Move.from_uci(request.played_move) if request.played_move else None
        except ValueError as exc:
            raise MaiaInferenceError("The played move is not valid UCI notation.") from exc
        if played_move is not None and played_move not in board.legal_moves:
            raise MaiaInferenceError("The played move is not legal in the supplied FEN.")

        lock = self._locks[request.model]
        try:
            with lock:
                engine.cmd_position(f"position fen {request.fen}")
                engine.self_elo = request.self_elo
                engine.oppo_elo = request.opponent_elo
                engine.temperature = request.temperature
                engine.top_p = request.top_p
                # Retrieve every legal policy probability so played-move
                # probability remains exact even when it is outside displayed top-k.
                engine.multipv = board.legal_moves.count()
                _chosen, all_moves = engine.score_moves()
        except MaiaUnavailableError:
            raise
        except Exception as exc:
            raise MaiaInferenceError(f"Maia-3 inference failed: {exc}") from exc

        try:
            normalized: list[tuple[MaiaCandidate, tuple[int, int, int]]] = []
            for item in all_moves:
                move = item["move"]
                win, draw, loss = item["wdl"]
                normalized.append((
                    MaiaCandidate(
                        uci=move.uci(),
                        san=board.san(move),
                        probability=float(item["policy"]),
                    ),
                    (int(win), int(draw), int(loss)),
                ))
        except Exception as exc:
            raise MaiaInferenceError(f"Maia-3 returned an invalid candidate payload: {exc}") from exc

        candidates = [candidate for candidate, _wdl in normalized[: request.multi_pv]]
        played_uci = played_move.uci() if played_move else None
        played_probability = next(
            (candidate.probability for candidate, _wdl in normalized if candidate.uci == played_uci),
            0.0,
        )
        selected_wdl = next(
            (wdl for candidate, wdl in normalized if candidate.uci == played_uci),
            normalized[0][1] if normalized else None,
        )
        human_wdl = None if selected_wdl is None else HumanWdl(
            win=selected_wdl[0] / 1000,
            draw=selected_wdl[1] / 1000,
            loss=selected_wdl[2] / 1000,
        )

        return MaiaMovesResponse(
            model=request.model,
            target_elo=request.target_elo,
            self_elo=request.self_elo,
            opponent_elo=request.opponent_elo,
            candidates=candidates,
            candidate_probability_mass=sum(candidate.probability for candidate in candidates),
            played_move_probability=played_probability,
            expected_human_move=candidates[0].uci if candidates else None,
            human_wdl=human_wdl,
            model_prediction=True,
        )
