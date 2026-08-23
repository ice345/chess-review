from typing import Literal

import chess
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class MaiaMovesRequest(BaseModel):
    fen: str
    target_elo: int = Field(ge=400, le=3000)
    self_elo: int = Field(ge=400, le=3000)
    opponent_elo: int = Field(ge=400, le=3000)
    multi_pv: int = Field(default=5, ge=1, le=20)
    played_move: str | None = Field(default=None, pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")
    model: Literal["maia3-5m", "maia3-23m", "maia3-79m"] = "maia3-5m"
    temperature: float = Field(default=0, ge=0, le=5)
    top_p: float = Field(default=1, gt=0, le=1)

    @field_validator("fen")
    @classmethod
    def validate_fen(cls, value: str) -> str:
        try:
            chess.Board(value)
        except ValueError as exc:
            raise ValueError("Invalid FEN") from exc
        return value


class HumanWdl(BaseModel):
    win: float = Field(ge=0, le=1)
    draw: float = Field(ge=0, le=1)
    loss: float = Field(ge=0, le=1)


class MaiaCandidate(BaseModel):
    uci: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")
    san: str
    probability: float = Field(ge=0, le=1)


class MaiaMovesResponse(BaseModel):
    model: str
    target_elo: int
    self_elo: int
    opponent_elo: int
    candidates: list[MaiaCandidate]
    candidate_probability_mass: float = Field(ge=0, le=1.000001)
    played_move_probability: float = Field(ge=0, le=1)
    expected_human_move: str | None = None
    human_wdl: HumanWdl | None = None
    model_prediction: Literal[True] = True


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class CoachModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class CoachEngineScore(CoachModel):
    kind: Literal["cp", "mate"]
    cp: int | None = None
    mate_in: int | None = None

    @model_validator(mode="after")
    def validate_score_variant(self) -> "CoachEngineScore":
        if self.kind == "cp" and (self.cp is None or self.mate_in is not None):
            raise ValueError("A centipawn score must contain only cp")
        if self.kind == "mate" and (self.mate_in is None or self.cp is not None):
            raise ValueError("A mate score must contain only mateIn")
        return self


class CoachCandidateFacts(CoachModel):
    rank: int = Field(ge=1)
    score: CoachEngineScore
    pv: list[str]

    @field_validator("pv")
    @classmethod
    def validate_pv(cls, value: list[str]) -> list[str]:
        for move in value:
            try:
                chess.Move.from_uci(move)
            except ValueError as exc:
                raise ValueError(f"Invalid UCI move in PV: {move}") from exc
        return value


class CoachSacrificeFacts(CoachModel):
    sacrificed_material: int
    see: int
    compensation_cp: int
    survives_best_response: bool
    recovered_within_pv: int
    genuine: bool


class CoachClassificationReason(CoachModel):
    precedence_rule: str
    is_engine_best: bool
    engine_rank: int | None = None
    centipawn_loss: int | None = None
    win_percent_before: float
    win_percent_after: float
    win_percent_loss: float = Field(ge=0)
    second_best_gap_cp: int | None = None
    second_best_gap_win_percent: float | None = None
    legal_move_count: int = Field(ge=1)
    is_forced: bool
    is_book: bool
    is_checkmate: bool
    is_obvious_recapture: bool
    is_trivial_check_escape: bool
    played_move_outside_multi_pv: bool
    sacrifice: CoachSacrificeFacts | None = None
    exclusions: list[str]


class CoachOpeningFacts(CoachModel):
    eco: str
    name: str
    variation: str | None = None
    matched_ply: int = Field(ge=0)
    theory_until_ply: int = Field(ge=0)


class CoachHumanCandidate(CoachModel):
    uci: str
    san: str
    probability: float = Field(ge=0, le=1)


class CoachHumanWdl(CoachModel):
    win: float = Field(ge=0, le=1)
    draw: float = Field(ge=0, le=1)
    loss: float = Field(ge=0, le=1)


class CoachHumanDifficulty(CoachModel):
    label: Literal["natural", "findable", "hard", "very-hard", "exceptional"]
    score: float = Field(ge=0, le=100)
    evidence: dict[str, object]


class CoachHumanFacts(CoachModel):
    model: str
    target_elo: int
    self_elo: int
    opponent_elo: int
    candidates: list[CoachHumanCandidate]
    candidate_probability_mass: float = Field(ge=0, le=1.000001)
    played_move_probability: float = Field(ge=0, le=1)
    expected_human_move: str | None = None
    human_wdl: CoachHumanWdl | None = None
    model_prediction: Literal[True]
    find_difficulty: CoachHumanDifficulty


class CoachMaterialFacts(CoachModel):
    white: dict[str, int]
    black: dict[str, int]
    balance_cp: int


class CoachMovePosition(CoachModel):
    fen_before: str
    fen_after: str
    phase: Literal["opening", "middlegame", "endgame"]


class CoachMoveIdentity(CoachModel):
    ply: int = Field(ge=1)
    color: Literal["white", "black"]
    san: str
    uci: str
    classification: str
    accuracy: float = Field(ge=0, le=100)


class CoachObjectiveFacts(CoachModel):
    evaluation_before: CoachEngineScore
    played_move_score: CoachEngineScore
    evaluation_after: CoachEngineScore
    best_move: str | None = None
    candidates: list[CoachCandidateFacts]
    after_candidates: list[CoachCandidateFacts]
    classification_reason: CoachClassificationReason


class CoachBoardFacts(CoachModel):
    material_before: CoachMaterialFacts
    material_after: CoachMaterialFacts
    is_capture: bool
    gives_check: bool
    motifs: list[str]


class CoachPhaseAccuracy(CoachModel):
    white: float | None = None
    black: float | None = None


class CoachMoveFacts(CoachModel):
    facts_version: Literal[1]
    position: CoachMovePosition
    move: CoachMoveIdentity
    objective: CoachObjectiveFacts
    human: CoachHumanFacts | None = None
    board_facts: CoachBoardFacts
    opening: CoachOpeningFacts | None = None
    phase_accuracy: CoachPhaseAccuracy

    @model_validator(mode="after")
    def validate_canonical_move(self) -> "CoachMoveFacts":
        try:
            board = chess.Board(self.position.fen_before)
            move = chess.Move.from_uci(self.move.uci)
        except ValueError as exc:
            raise ValueError("Coach move facts contain invalid FEN or UCI") from exc
        if move not in board.legal_moves:
            raise ValueError("Coach move is not legal in fenBefore")
        if board.san(move) != self.move.san:
            raise ValueError("Coach SAN does not match the legal UCI move")
        board.push(move)
        expected = " ".join(board.fen().split(" ")[:4])
        supplied = " ".join(self.position.fen_after.split(" ")[:4])
        if expected != supplied:
            raise ValueError("fenAfter does not match the played move")
        return self


class CoachPlayerFacts(CoachModel):
    color: Literal["white", "black"]
    accuracy: float | None = None
    phase_accuracy: dict[str, float]
    classification_counts: dict[str, int]


class CoachDivisionFacts(CoachModel):
    middle_ply: int | None = None
    end_ply: int | None = None
    total_plies: int = Field(ge=0)


class CoachGameMoveFacts(CoachModel):
    ply: int = Field(ge=1)
    color: Literal["white", "black"]
    san: str
    uci: str
    phase: Literal["opening", "middlegame", "endgame"]
    classification: str
    accuracy: float = Field(ge=0, le=100)
    win_percent_loss: float = Field(ge=0)
    human_probability: float | None = Field(default=None, ge=0, le=1)
    human_difficulty: str | None = None


class CoachCriticalMomentFacts(CoachModel):
    ply: int = Field(ge=1)
    classification: str
    win_percent_swing: float = Field(ge=0)


class CoachGamePlayers(CoachModel):
    white: CoachPlayerFacts
    black: CoachPlayerFacts


class CoachGameFacts(CoachModel):
    facts_version: Literal[1]
    headers: dict[str, str]
    opening: CoachOpeningFacts | None = None
    division: CoachDivisionFacts
    players: CoachGamePlayers
    moves: list[CoachGameMoveFacts]
    critical_moments: list[CoachCriticalMomentFacts]

    @model_validator(mode="after")
    def validate_critical_plies(self) -> "CoachGameFacts":
        plies = {move.ply for move in self.moves}
        if any(moment.ply not in plies for moment in self.critical_moments):
            raise ValueError("Critical moments must refer to supplied moves")
        return self


class CoachExplainRequest(CoachModel):
    facts_version: Literal[1]
    facts: CoachMoveFacts
    provider: Literal["ollama", "openai-compatible"] = "ollama"
    model: str | None = Field(default=None, min_length=1, max_length=120)
    language: Literal["en", "zh-CN"] = "zh-CN"

    @model_validator(mode="after")
    def validate_fact_versions(self) -> "CoachExplainRequest":
        if self.facts_version != self.facts.facts_version:
            raise ValueError("Request and payload factsVersion differ")
        return self


class CoachGameSummaryRequest(CoachModel):
    facts_version: Literal[1]
    facts: CoachGameFacts
    provider: Literal["ollama", "openai-compatible"] = "ollama"
    model: str | None = Field(default=None, min_length=1, max_length=120)
    language: Literal["en", "zh-CN"] = "zh-CN"


class CoachLinePayload(CoachModel):
    label: str = Field(min_length=1, max_length=80)
    start: Literal["before", "after"]
    moves: list[str] = Field(max_length=6)
    note: str | None = Field(max_length=240)


class CoachExplanationPayload(CoachModel):
    headline: str = Field(min_length=1, max_length=100)
    summary: str = Field(min_length=1, max_length=500)
    why_move_works: str | None = Field(max_length=420)
    what_went_wrong: str | None = Field(max_length=420)
    better_plan: str | None = Field(max_length=420)
    human_perspective: str | None = Field(max_length=420)
    tactical_idea: str | None = Field(max_length=420)
    training_tip: str | None = Field(max_length=420)
    confidence: Literal["high", "medium", "low"]
    lines: list[CoachLinePayload] = Field(max_length=2)


class CoachCriticalInsightPayload(CoachModel):
    ply: int = Field(ge=1)
    insight: str = Field(min_length=1, max_length=300)


class CoachTrainingPayload(CoachModel):
    title: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=300)
    focus: str = Field(min_length=1, max_length=300)


class CoachGameSummaryPayload(CoachModel):
    headline: str = Field(min_length=1, max_length=100)
    summary: str = Field(min_length=1, max_length=700)
    strengths: list[str] = Field(max_length=3)
    weaknesses: list[str] = Field(max_length=3)
    critical_moments: list[CoachCriticalInsightPayload] = Field(max_length=5)
    training_recommendations: list[CoachTrainingPayload] = Field(max_length=3)
    confidence: Literal["high", "medium", "low"]


class CoachValidatedMove(CoachModel):
    uci: str
    san: str


class CoachValidatedLine(CoachModel):
    label: str
    start: Literal["before", "after"]
    moves: list[CoachValidatedMove]
    note: str | None = None


class CoachGrounding(CoachModel):
    facts_version: Literal[1] = 1
    structured_facts_only: Literal[True] = True
    removed_move_mentions: list[str]
    removed_unsupported_claims: list[str]
    validated_line_count: int = Field(ge=0)


class CoachSource(CoachModel):
    provider: Literal["ollama", "openai-compatible"]
    model: str
    prompt_version: str
    generated_at: str


class CoachExplanationResponse(CoachModel):
    headline: str
    summary: str
    why_move_works: str | None = None
    what_went_wrong: str | None = None
    better_plan: str | None = None
    human_perspective: str | None = None
    tactical_idea: str | None = None
    training_tip: str | None = None
    confidence: Literal["high", "medium", "low"]
    validated_lines: list[CoachValidatedLine]
    grounding: CoachGrounding
    source: CoachSource


class CoachCriticalInsight(CoachModel):
    ply: int
    insight: str


class CoachTrainingRecommendation(CoachModel):
    title: str
    reason: str
    focus: str


class CoachGameSummaryResponse(CoachModel):
    headline: str
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    critical_moments: list[CoachCriticalInsight]
    training_recommendations: list[CoachTrainingRecommendation]
    confidence: Literal["high", "medium", "low"]
    grounding: CoachGrounding
    source: CoachSource


class CoachHealth(CoachModel):
    ollama: Literal["available", "offline", "error"]
    ollama_model: Literal["available", "missing", "offline", "error"]
    configured_model: str
    openai_compatible: Literal["configured", "not-configured"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    maia: Literal["available", "not-installed", "error"]
    coach: CoachHealth
