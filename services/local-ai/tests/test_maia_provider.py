from threading import Lock

import chess

from chess_review_local_ai.maia_provider import Maia3Provider, MaiaInferenceError
from chess_review_local_ai.schemas import MaiaMovesRequest


class FakeEngine:
    self_elo = 0
    oppo_elo = 0
    temperature = 0.0
    top_p = 1.0
    multipv = 0
    position_command = ""

    def cmd_position(self, command: str) -> None:
        self.position_command = command

    def score_moves(self) -> tuple[chess.Move, list[dict[str, object]]]:
        moves = [
            {"move": chess.Move.from_uci("e2e4"), "policy": 0.55, "wdl": (480, 400, 120)},
            {"move": chess.Move.from_uci("d2d4"), "policy": 0.25, "wdl": (430, 440, 130)},
            {"move": chess.Move.from_uci("g1f3"), "policy": 0.04, "wdl": (350, 480, 170)},
        ]
        return chess.Move.from_uci("e2e4"), moves


class ProviderWithFakeEngine(Maia3Provider):
    def __init__(self, engine: FakeEngine) -> None:
        super().__init__()
        self.engine = engine
        self._locks["maia3-5m"] = Lock()

    def _engine(self, _: str) -> FakeEngine:
        return self.engine


def request(**overrides: object) -> MaiaMovesRequest:
    values: dict[str, object] = {
        "fen": chess.STARTING_FEN,
        "target_elo": 1400,
        "self_elo": 1200,
        "opponent_elo": 1600,
        "multi_pv": 2,
        "played_move": "g1f3",
    }
    values.update(overrides)
    return MaiaMovesRequest.model_validate(values)


def test_adapter_returns_raw_policy_and_exact_played_move_probability() -> None:
    engine = FakeEngine()
    response = ProviderWithFakeEngine(engine).analyze(request())

    assert engine.position_command == f"position fen {chess.STARTING_FEN}"
    assert (engine.self_elo, engine.oppo_elo) == (1200, 1600)
    assert engine.multipv == 20
    assert [candidate.uci for candidate in response.candidates] == ["e2e4", "d2d4"]
    assert response.candidate_probability_mass == 0.8
    assert response.played_move_probability == 0.04
    assert response.human_wdl is not None
    assert response.human_wdl.model_dump() == {"win": 0.35, "draw": 0.48, "loss": 0.17}


def test_adapter_rejects_a_structurally_valid_but_illegal_played_move() -> None:
    provider = ProviderWithFakeEngine(FakeEngine())

    try:
        provider.analyze(request(played_move="e2e5"))
    except MaiaInferenceError as exc:
        assert str(exc) == "The played move is not legal in the supplied FEN."
    else:
        raise AssertionError("Expected an illegal played move to fail")
