from typing import Any

import pytest

from chess_review_local_ai.coach_provider import CoachGenerationError, CoachProviderRegistry, CoachProviderResult
from chess_review_local_ai.coach_service import CoachService
from chess_review_local_ai.schemas import CoachExplainRequest, CoachGameSummaryRequest


class FakeCoachProvider:
    name = "ollama"
    status = "available"

    def __init__(self, content: dict[str, object]) -> None:
        self.content = content
        self.last_facts = ""

    def generate_json(self, **kwargs: Any) -> CoachProviderResult:
        self.last_facts = kwargs["facts_json"]
        return CoachProviderResult(content=self.content, model="fixture-model")


def move_facts() -> dict[str, object]:
    before = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    after = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    score = {"kind": "cp", "cp": 35}
    reason = {
        "precedenceRule": "engine-top-choice",
        "isEngineBest": True,
        "engineRank": 1,
        "centipawnLoss": 0,
        "winPercentBefore": 52,
        "winPercentAfter": 52,
        "winPercentLoss": 0,
        "secondBestGapCp": 20,
        "legalMoveCount": 20,
        "isForced": False,
        "isBook": False,
        "isCheckmate": False,
        "isObviousRecapture": False,
        "isTrivialCheckEscape": False,
        "playedMoveOutsideMultiPv": False,
        "exclusions": [],
    }
    material = {
        "white": {"pawn": 8, "knight": 2, "bishop": 2, "rook": 2, "queen": 1},
        "black": {"pawn": 8, "knight": 2, "bishop": 2, "rook": 2, "queen": 1},
        "balanceCp": 0,
    }
    def side_position() -> dict[str, object]:
        return {
            "inCheck": False,
            "castled": False,
            "pawnShieldCount": 3,
            "undevelopedMinorSquares": ["b1", "c1", "f1", "g1"],
            "doubledPawnFiles": [],
            "isolatedPawnFiles": [],
            "passedPawnSquares": [],
        }

    def position_understanding(side_to_move: str, white_center: list[str]) -> dict[str, object]:
        return {
            "sideToMove": side_to_move,
            "legalMoveCount": 20,
            "checks": [],
            "captures": [],
            "forcingCandidates": [],
            "attackedUndefendedPieces": [],
            "center": {"whiteOccupied": white_center, "blackOccupied": [], "contested": []},
            "openFiles": [],
            "whiteSemiOpenFiles": [],
            "blackSemiOpenFiles": [],
            "white": side_position(),
            "black": side_position(),
        }
    return {
        "factsVersion": 1,
        "position": {"fenBefore": before, "fenAfter": after, "phase": "opening"},
        "move": {"ply": 1, "color": "white", "san": "e4", "uci": "e2e4", "classification": "best", "accuracy": 99.2},
        "objective": {
            "evaluationBefore": score,
            "playedMoveScore": score,
            "evaluationAfter": {"kind": "cp", "cp": 28},
            "bestMove": "e2e4",
            "candidates": [{"rank": 1, "score": score, "pv": ["e2e4", "e7e5", "g1f3"]}],
            "afterCandidates": [{"rank": 1, "score": {"kind": "cp", "cp": 28}, "pv": ["e7e5", "g1f3"]}],
            "classificationReason": reason,
        },
        "boardFacts": {
            "materialBefore": material,
            "materialAfter": material,
            "isCapture": False,
            "givesCheck": False,
            "motifs": [],
            "positionBefore": position_understanding("white", []),
            "positionAfter": position_understanding("black", ["e4"]),
            "futureConsequence": {
                "start": "after",
                "moves": ["e7e5", "g1f3"],
                "opponentBestResponse": "e7e5",
            },
        },
        "phaseAccuracy": {"white": 99.2},
    }


def explanation_payload() -> dict[str, object]:
    return {
        "headline": "Why e4 works but h2h5 does not",
        "summary": "The facts support e4 without changing the engine score.",
        "whyMoveWorks": "It follows the grounded e4 line.",
        "whatWentWrong": None,
        "betterPlan": None,
        "humanPerspective": None,
        "tacticalIdea": None,
        "trainingTip": "Do not invent h2h5.",
        "notice": "Compare the supplied forcing candidates.",
        "moveIdea": "The move preserves the supplied objective score.",
        "problem": "null",
        "consequence": "The supplied line starts with e5.",
        "practicalAlternative": None,
        "takeaway": "Compare the move idea with the validated line.",
        "confidence": "high",
        "lines": [
            {"label": "Canonical", "start": "before", "moves": ["e2e4", "e7e5"], "note": None},
            {"label": "Invented", "start": "before", "moves": ["a2a3"], "note": None},
        ],
    }


def test_move_coach_validates_lines_and_removes_ungrounded_notation() -> None:
    provider = FakeCoachProvider(explanation_payload())
    service = CoachService(CoachProviderRegistry(ollama=provider, openai_compatible=provider))
    request = CoachExplainRequest.model_validate({
        "factsVersion": 1,
        "facts": move_facts(),
        "provider": "ollama",
        "language": "en",
    })

    response = service.explain(request)

    assert '"classification":"best"' in provider.last_facts
    assert response.validated_lines[0].moves[1].san == "e5"
    assert len(response.validated_lines) == 1
    assert "h2h5" in response.grounding.removed_move_mentions
    assert "a2a3" in response.grounding.removed_move_mentions
    assert "h2h5" not in response.headline
    assert response.problem is None
    assert response.confidence == "low"


def test_move_coach_accepts_objective_v2_quality_and_verification_evidence() -> None:
    facts = move_facts()
    move = facts["move"]
    objective = facts["objective"]
    assert isinstance(move, dict)
    assert isinstance(objective, dict)
    reason = objective["classificationReason"]
    assert isinstance(reason, dict)

    move["quality"] = "best"
    move["annotations"] = ["critical"]
    reason["qualityRule"] = "win-percent-loss"
    reason["engineConsistency"] = {
        "winPercentDelta": 0.2,
        "centipawnDelta": 7,
        "toleranceWinPercent": 1,
        "consistent": True,
    }
    reason["verification"] = {
        "status": "verified",
        "depth": 18,
        "multiPv": 5,
        "reasons": ["special-annotation"],
    }

    request = CoachExplainRequest.model_validate({"factsVersion": 1, "facts": facts})

    assert request.facts.move.quality == "best"
    assert request.facts.move.annotations == ["critical"]
    assert request.facts.objective.classification_reason.quality_rule == "win-percent-loss"
    assert request.facts.objective.classification_reason.verification is not None
    assert request.facts.objective.classification_reason.verification.multi_pv == 5


def test_move_coach_rejects_json_that_does_not_match_the_contract() -> None:
    provider = FakeCoachProvider({"headline": "Missing required fields"})
    service = CoachService(CoachProviderRegistry(ollama=provider, openai_compatible=provider))
    request = CoachExplainRequest.model_validate({"factsVersion": 1, "facts": move_facts()})

    with pytest.raises(CoachGenerationError, match="schema validation"):
        service.explain(request)


def test_move_coach_removes_sections_without_required_evidence() -> None:
    payload = explanation_payload()
    payload["humanPerspective"] = "Human players prefer e4."
    payload["tacticalIdea"] = "e4 creates a tactical threat."
    payload["consequence"] = "The opponent must reply e5."
    payload["practicalAlternative"] = "Play d4 instead."
    provider = FakeCoachProvider(payload)
    service = CoachService(CoachProviderRegistry(ollama=provider, openai_compatible=provider))

    facts = move_facts()
    board_facts = facts["boardFacts"]
    assert isinstance(board_facts, dict)
    board_facts.pop("futureConsequence")

    response = service.explain(CoachExplainRequest.model_validate({
        "factsVersion": 1,
        "facts": facts,
        "language": "en",
    }))

    assert response.human_perspective is None
    assert response.tactical_idea is None
    assert response.consequence is None
    assert response.practical_alternative is None
    assert response.confidence == "low"
    assert response.grounding.removed_unsupported_claims == [
        "humanPerspective: no Maia facts supplied",
        "tacticalIdea: no tactical evidence supplied",
        "consequence: no deterministic future-consequence facts supplied",
        "practicalAlternative: no Stockfish/Maia-supported alternative supplied",
    ]


def test_move_facts_reject_a_future_line_that_is_not_an_after_position_pv() -> None:
    facts = move_facts()
    board_facts = facts["boardFacts"]
    assert isinstance(board_facts, dict)
    consequence = board_facts["futureConsequence"]
    assert isinstance(consequence, dict)
    consequence["moves"] = ["c7c5"]
    consequence["opponentBestResponse"] = "c7c5"

    with pytest.raises(ValueError, match="prefix of an after-position PV"):
        CoachExplainRequest.model_validate({"factsVersion": 1, "facts": facts})


def test_move_coach_rejects_a_provider_that_ignores_requested_chinese() -> None:
    provider = FakeCoachProvider(explanation_payload())
    service = CoachService(CoachProviderRegistry(ollama=provider, openai_compatible=provider))

    with pytest.raises(CoachGenerationError, match="requested language"):
        service.explain(CoachExplainRequest.model_validate({
            "factsVersion": 1,
            "facts": move_facts(),
            "language": "zh-CN",
        }))


def game_facts() -> dict[str, object]:
    return {
        "factsVersion": 1,
        "headers": {"White": "Ada", "Black": "Mikhail"},
        "division": {"totalPlies": 2},
        "players": {
            "white": {"color": "white", "accuracy": 99.2, "phaseAccuracy": {"opening": 99.2}, "classificationCounts": {"best": 1}},
            "black": {"color": "black", "accuracy": 34, "phaseAccuracy": {"opening": 34}, "classificationCounts": {"blunder": 1}},
        },
        "moves": [
            {"ply": 1, "color": "white", "san": "e4", "uci": "e2e4", "phase": "opening", "classification": "best", "accuracy": 99.2, "winPercentLoss": 0},
            {"ply": 2, "color": "black", "san": "e5", "uci": "e7e5", "phase": "opening", "classification": "blunder", "accuracy": 34, "winPercentLoss": 23},
        ],
        "criticalMoments": [{"ply": 2, "classification": "blunder", "winPercentSwing": 23}],
    }


def test_game_summary_filters_unknown_moments_and_ungrounded_moves() -> None:
    provider = FakeCoachProvider({
        "headline": "Game summary",
        "summary": "Review a2a4 next.",
        "strengths": ["The e4 decision was grounded."],
        "weaknesses": ["One critical error."],
        "criticalMoments": [
            {"ply": 2, "insight": "The e5 moment changed the game."},
            {"ply": 99, "insight": "Invented moment."},
        ],
        "trainingRecommendations": [{"title": "Calculation", "reason": "One blunder", "focus": "Compare forcing lines"}],
        "confidence": "high",
    })
    service = CoachService(CoachProviderRegistry(ollama=provider, openai_compatible=provider))
    request = CoachGameSummaryRequest.model_validate({"factsVersion": 1, "facts": game_facts(), "language": "en"})

    response = service.game_summary(request)

    assert [moment.ply for moment in response.critical_moments] == [2]
    assert response.grounding.removed_unsupported_claims == [
        "criticalMoment.ply=99: not a canonical critical moment"
    ]
    assert "a2a4" in response.grounding.removed_move_mentions
    assert "a2a4" not in response.summary
    assert response.confidence == "low"


def test_game_summary_accepts_objective_v2_quality_and_annotation_counts() -> None:
    facts = game_facts()
    players = facts["players"]
    moves = facts["moves"]
    assert isinstance(players, dict)
    assert isinstance(moves, list)
    white = players["white"]
    assert isinstance(white, dict)
    first_move = moves[0]
    assert isinstance(first_move, dict)

    white["qualityCounts"] = {"best": 1}
    white["annotationCounts"] = {"critical": 1}
    first_move["quality"] = "best"
    first_move["annotations"] = ["critical"]

    request = CoachGameSummaryRequest.model_validate({"factsVersion": 1, "facts": facts})

    assert request.facts.players.white.quality_counts == {"best": 1}
    assert request.facts.players.white.annotation_counts == {"critical": 1}
    assert request.facts.moves[0].annotations == ["critical"]


def test_game_summary_rejects_a_provider_that_ignores_requested_chinese() -> None:
    provider = FakeCoachProvider({
        "headline": "Game summary",
        "summary": "The game should be reviewed carefully.",
        "strengths": ["Good decisions"],
        "weaknesses": ["One critical error"],
        "criticalMoments": [{"ply": 2, "insight": "A large swing happened here."}],
        "trainingRecommendations": [{"title": "Calculation", "reason": "One blunder", "focus": "Compare forcing lines"}],
        "confidence": "high",
    })
    service = CoachService(CoachProviderRegistry(ollama=provider, openai_compatible=provider))

    with pytest.raises(CoachGenerationError, match="requested language"):
        service.game_summary(CoachGameSummaryRequest.model_validate({
            "factsVersion": 1,
            "facts": game_facts(),
            "language": "zh-CN",
        }))


def test_game_summary_accepts_the_requested_chinese_and_records_it_in_source() -> None:
    provider = FakeCoachProvider({
        "headline": "整盘复盘总结",
        "summary": "这盘棋需要重点复盘关键节点和候选着法。",
        "strengths": ["能够找到高质量的着法。"],
        "weaknesses": ["关键节点的计算仍需加强。"],
        "criticalMoments": [{"ply": 2, "insight": "这里出现了明显的胜率波动。"}],
        "trainingRecommendations": [{"title": "计算训练", "reason": "本局出现一次严重失误。", "focus": "比较强制着法和候选变化。"}],
        "confidence": "high",
    })
    service = CoachService(CoachProviderRegistry(ollama=provider, openai_compatible=provider))

    response = service.game_summary(CoachGameSummaryRequest.model_validate({
        "factsVersion": 1,
        "facts": game_facts(),
        "language": "zh-CN",
    }))

    assert response.source.language == "zh-CN"
    assert response.headline == "整盘复盘总结"
