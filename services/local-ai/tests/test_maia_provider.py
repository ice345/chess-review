import chess

from chess_review_local_ai.maia_provider import (
    Maia3Provider,
    MaiaInferenceError,
    _Inference,
    _PolicyCandidate,
)
from chess_review_local_ai.schemas import MaiaMoveReviewRequest, MaiaPositionAnalysisRequest


POLICY = [
    _PolicyCandidate(chess.Move.from_uci("e2e4"), 0.55, 1),
    _PolicyCandidate(chess.Move.from_uci("d2d4"), 0.25, 2),
    _PolicyCandidate(chess.Move.from_uci("g1f3"), 0.04, 7),
]


class ProviderWithFakeInference(Maia3Provider):
    def __init__(self) -> None:
        super().__init__()
        self.value_moves: list[chess.Move] = []

    def _engine_locked(self, _model: str) -> object:
        return object()

    def _infer(
        self,
        _engine: object,
        _board: chess.Board,
        *,
        self_elo: int,
        opponent_elo: int,
        multi_pv: int,
        value_moves: list[chess.Move],
    ) -> _Inference:
        assert (self_elo, opponent_elo, multi_pv) == (1200, 1600, 2)
        self.value_moves = value_moves
        bounded = self._bounded_value_moves(POLICY, multi_pv, value_moves)
        wdls = {
            move.uci(): (350, 480, 170) if move.uci() == "g1f3" else (480, 400, 120)
            for move in bounded
        }
        return _Inference(root_wdl=(460, 360, 180), policy=POLICY, candidate_wdls=wdls)


def move_request(**overrides: object) -> MaiaMoveReviewRequest:
    values: dict[str, object] = {
        "fen_before": chess.STARTING_FEN,
        "target_elo": 1400,
        "self_elo": 1200,
        "opponent_elo": 1600,
        "multi_pv": 2,
        "played_move": "g1f3",
    }
    values.update(overrides)
    return MaiaMoveReviewRequest.model_validate(values)


def position_request(**overrides: object) -> MaiaPositionAnalysisRequest:
    values: dict[str, object] = {
        "fen": chess.STARTING_FEN,
        "target_elo": 1400,
        "self_elo": 1200,
        "opponent_elo": 1600,
        "multi_pv": 2,
        "candidate_moves": ["g1f3"],
    }
    values.update(overrides)
    return MaiaPositionAnalysisRequest.model_validate(values)


def test_move_review_returns_exact_policy_rank_and_played_move_wdl() -> None:
    provider = ProviderWithFakeInference()
    response = provider.review_move(move_request())

    assert provider.value_moves == [chess.Move.from_uci("g1f3")]
    assert [candidate.uci for candidate in response.candidates] == ["e2e4", "d2d4"]
    assert response.candidate_probability_mass == 0.8
    assert response.played_move_probability == 0.04
    assert response.played_move_rank == 7
    assert response.played_move_wdl is not None
    assert response.played_move_wdl.model_dump() == {"win": 0.35, "draw": 0.48, "loss": 0.17}


def test_position_analysis_keeps_root_wdl_separate_and_evaluates_requested_union() -> None:
    response = ProviderWithFakeInference().analyze_position(position_request())

    assert response.side_to_move == "white"
    assert response.root_wdl.model_dump() == {"win": 0.46, "draw": 0.36, "loss": 0.18}
    assert [candidate.uci for candidate in response.candidates] == ["e2e4", "d2d4"]
    assert [candidate.uci for candidate in response.evaluated_candidates] == ["e2e4", "d2d4", "g1f3"]
    assert all(candidate.wdl is not None for candidate in response.evaluated_candidates)


def test_candidate_value_batch_is_bounded_not_every_legal_move() -> None:
    board = chess.Board()
    policy = [
        _PolicyCandidate(move, 1 / board.legal_moves.count(), rank)
        for rank, move in enumerate(board.legal_moves, start=1)
    ]
    extras = [policy[0].move, policy[-1].move]
    bounded = Maia3Provider._bounded_value_moves(policy, 2, extras)

    assert len(policy) == 20
    assert len(bounded) == 3
    assert bounded == [policy[0].move, policy[1].move, policy[-1].move]


def test_switch_policy_releases_the_previous_resident_model() -> None:
    class Engine:
        model = object()

    provider = Maia3Provider()
    engine = Engine()
    provider._active_model = "maia3-5m"
    provider._active_engine = engine
    provider._release_active_locked()

    assert provider._active_model is None
    assert provider._active_engine is None
    assert engine.model is None


def test_loading_a_new_tier_releases_the_previous_network_before_allocation() -> None:
    class Engine:
        def __init__(self) -> None:
            self.model = object()

        def ensure_model_loaded(self) -> None:
            pass

    provider = Maia3Provider()
    previous = Engine()
    provider._active_model = "maia3-5m"
    provider._active_engine = previous

    def factory() -> Engine:
        assert provider._active_model is None
        assert provider._active_engine is None
        assert previous.model is None
        return Engine()

    current = provider._load_active_locked("maia3-23m", factory)

    assert provider._active_model == "maia3-23m"
    assert provider._active_engine is current


def test_adapter_rejects_a_structurally_valid_but_illegal_played_move() -> None:
    provider = ProviderWithFakeInference()

    try:
        provider.review_move(move_request(played_move="e2e5"))
    except MaiaInferenceError as exc:
        assert str(exc) == "The requested move e2e5 is not legal in the supplied FEN."
    else:
        raise AssertionError("Expected an illegal played move to fail")
