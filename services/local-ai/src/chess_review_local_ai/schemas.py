from typing import Literal

import chess
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MaiaModelName = Literal["maia3-5m", "maia3-23m", "maia3-79m"]
MaiaModelState = Literal["active", "cached", "not-cached", "unavailable", "error"]


class MaiaRequestConfig(BaseModel):
    target_elo: int = Field(ge=400, le=3000)
    self_elo: int = Field(ge=400, le=3000)
    opponent_elo: int = Field(ge=400, le=3000)
    multi_pv: int = Field(default=5, ge=1, le=20)
    model: MaiaModelName = "maia3-5m"
    temperature: float = Field(default=0, ge=0, le=5)
    top_p: float = Field(default=1, gt=0, le=1)
    candidate_moves: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("candidate_moves")
    @classmethod
    def validate_candidate_moves(cls, value: list[str]) -> list[str]:
        for move in value:
            try:
                chess.Move.from_uci(move)
            except ValueError as exc:
                raise ValueError(f"Invalid candidate UCI move: {move}") from exc
        return list(dict.fromkeys(value))


class MaiaPositionAnalysisRequest(MaiaRequestConfig):
    fen: str

    @field_validator("fen")
    @classmethod
    def validate_fen(cls, value: str) -> str:
        try:
            chess.Board(value)
        except ValueError as exc:
            raise ValueError("Invalid FEN") from exc
        return value


class MaiaMoveReviewRequest(MaiaRequestConfig):
    fen_before: str
    played_move: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")

    @field_validator("fen_before")
    @classmethod
    def validate_fen(cls, value: str) -> str:
        try:
            chess.Board(value)
        except ValueError as exc:
            raise ValueError("Invalid FEN") from exc
        return value


# Deprecated compatibility request. Product code uses the two explicit contracts above.
class MaiaMovesRequest(MaiaPositionAnalysisRequest):
    played_move: str | None = Field(default=None, pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")


class HumanWdl(BaseModel):
    win: float = Field(ge=0, le=1)
    draw: float = Field(ge=0, le=1)
    loss: float = Field(ge=0, le=1)


class MaiaCandidate(BaseModel):
    uci: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")
    san: str
    probability: float = Field(ge=0, le=1)
    policy_rank: int = Field(ge=1)
    wdl: HumanWdl | None = None


class MaiaMoveReviewResponse(BaseModel):
    kind: Literal["move-review"] = "move-review"
    fen_before: str
    played_move: str
    model: MaiaModelName
    target_elo: int
    self_elo: int
    opponent_elo: int
    candidates: list[MaiaCandidate]
    candidate_probability_mass: float = Field(ge=0, le=1.000001)
    played_move_probability: float = Field(ge=0, le=1)
    played_move_rank: int = Field(ge=1)
    expected_human_move: str | None = None
    played_move_wdl: HumanWdl | None = None
    model_prediction: Literal[True] = True


class MaiaPositionAnalysisResponse(BaseModel):
    kind: Literal["position-analysis"] = "position-analysis"
    fen: str
    side_to_move: Literal["white", "black"]
    model: MaiaModelName
    target_elo: int
    self_elo: int
    opponent_elo: int
    candidates: list[MaiaCandidate]
    evaluated_candidates: list[MaiaCandidate]
    candidate_probability_mass: float = Field(ge=0, le=1.000001)
    root_wdl: HumanWdl
    expected_human_move: str | None = None
    model_prediction: Literal[True] = True


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


class MaiaModelSetupResponse(BaseModel):
    model: MaiaModelName
    status: MaiaModelState


class MaiaModelSetupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: Literal[True]


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


class CoachEngineConsistencyFacts(CoachModel):
    win_percent_delta: float = Field(ge=0)
    centipawn_delta: int | None = Field(default=None, ge=0)
    tolerance_win_percent: float = Field(ge=0)
    consistent: bool


class CoachObjectiveVerificationFacts(CoachModel):
    status: Literal["baseline", "verified"]
    depth: int = Field(ge=1)
    multi_pv: int = Field(ge=1)
    reasons: list[str]


class CoachClassificationReason(CoachModel):
    precedence_rule: str
    quality_rule: str | None = None
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
    engine_consistency: CoachEngineConsistencyFacts | None = None
    verification: CoachObjectiveVerificationFacts | None = None
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
    policy_rank: int = Field(ge=1)
    wdl: "CoachHumanWdl | None" = None


class CoachHumanWdl(CoachModel):
    win: float = Field(ge=0, le=1)
    draw: float = Field(ge=0, le=1)
    loss: float = Field(ge=0, le=1)


class CoachHumanDifficulty(CoachModel):
    label: Literal["natural", "findable", "hard", "very-hard", "exceptional"]
    score: float = Field(ge=0, le=100)
    evidence: dict[str, object]


class CoachHumanFacts(CoachModel):
    version: Literal["human-v2"]
    model: str
    target_elo: int
    self_elo: int
    opponent_elo: int
    candidates: list[CoachHumanCandidate]
    candidate_probability_mass: float = Field(ge=0, le=1.000001)
    played_move_probability: float = Field(ge=0, le=1)
    played_move_rank: int = Field(ge=1)
    expected_human_move: str | None = None
    played_move_wdl: CoachHumanWdl | None = None
    model_prediction: Literal[True]
    find_difficulty: CoachHumanDifficulty


class CoachMaterialFacts(CoachModel):
    white: dict[str, int]
    black: dict[str, int]
    balance_cp: int


class CoachPieceSquareFacts(CoachModel):
    color: Literal["white", "black"]
    piece: Literal["pawn", "knight", "bishop", "rook", "queen"]
    square: str = Field(pattern=r"^[a-h][1-8]$")


class CoachSidePositionFacts(CoachModel):
    in_check: bool
    castled: bool
    pawn_shield_count: int = Field(ge=0, le=3)
    undeveloped_minor_squares: list[str]
    doubled_pawn_files: list[str]
    isolated_pawn_files: list[str]
    passed_pawn_squares: list[str]


class CoachCenterFacts(CoachModel):
    white_occupied: list[str]
    black_occupied: list[str]
    contested: list[str]


class CoachPositionUnderstanding(CoachModel):
    side_to_move: Literal["white", "black"]
    legal_move_count: int = Field(ge=0)
    checks: list[str]
    captures: list[str]
    forcing_candidates: list[str]
    attacked_undefended_pieces: list[CoachPieceSquareFacts]
    center: CoachCenterFacts
    open_files: list[str]
    white_semi_open_files: list[str]
    black_semi_open_files: list[str]
    white: CoachSidePositionFacts
    black: CoachSidePositionFacts


class CoachFutureConsequenceFacts(CoachModel):
    start: Literal["after"]
    moves: list[str] = Field(min_length=1, max_length=4)
    opponent_best_response: str | None = None


class CoachPracticalAlternativeFacts(CoachModel):
    uci: str
    san: str
    stockfish_rank: int = Field(ge=2)
    score: CoachEngineScore
    maia_probability: float = Field(ge=0, le=1)
    objective_best_uci: str
    objective_best_maia_probability: float | None = Field(default=None, ge=0, le=1)
    win_percent_cost: float = Field(ge=0, le=4.000001)


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
    quality: str | None = None
    annotations: list[str] = Field(default_factory=list)
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
    position_before: CoachPositionUnderstanding
    position_after: CoachPositionUnderstanding
    future_consequence: CoachFutureConsequenceFacts | None = None
    practical_alternative: CoachPracticalAlternativeFacts | None = None


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
        before_side = "white" if chess.Board(self.position.fen_before).turn == chess.WHITE else "black"
        after_board = chess.Board(self.position.fen_after)
        after_side = "white" if after_board.turn == chess.WHITE else "black"
        if self.board_facts.position_before.side_to_move != before_side or self.board_facts.position_after.side_to_move != after_side:
            raise ValueError("positionUnderstanding sideToMove does not match its FEN")
        consequence = self.board_facts.future_consequence
        if consequence is not None:
            if not any(candidate.pv[: len(consequence.moves)] == consequence.moves for candidate in self.objective.after_candidates):
                raise ValueError("futureConsequence must be a prefix of an after-position PV")
            replay = after_board.copy(stack=False)
            for uci in consequence.moves:
                candidate = chess.Move.from_uci(uci)
                if candidate not in replay.legal_moves:
                    raise ValueError("futureConsequence contains an illegal move")
                replay.push(candidate)
            if consequence.opponent_best_response is not None and consequence.opponent_best_response != consequence.moves[0]:
                raise ValueError("opponentBestResponse must be the first consequence move")
        practical = self.board_facts.practical_alternative
        if practical is not None:
            stockfish = next((candidate for candidate in self.objective.candidates if candidate.rank == practical.stockfish_rank and candidate.pv and candidate.pv[0] == practical.uci), None)
            human = None if self.human is None else next((candidate for candidate in self.human.candidates if candidate.uci == practical.uci), None)
            best = next((candidate for candidate in self.objective.candidates if candidate.rank == 1 and candidate.pv), None)
            if stockfish is None or human is None or best is None:
                raise ValueError("practicalAlternative must be supported by Stockfish and Maia candidates")
            if practical.objective_best_uci != best.pv[0] or abs(practical.maia_probability - human.probability) > 1e-9:
                raise ValueError("practicalAlternative evidence does not match supplied candidates")
        return self


class CoachPlayerFacts(CoachModel):
    color: Literal["white", "black"]
    accuracy: float | None = None
    phase_accuracy: dict[str, float]
    classification_counts: dict[str, int]
    quality_counts: dict[str, int] | None = None
    annotation_counts: dict[str, int] | None = None


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
    quality: str | None = None
    annotations: list[str] = Field(default_factory=list)
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
    moves: list[str] = Field(max_length=4)
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
    # Coach v3 always returns the six teaching slots. A slot may be null when
    # its deterministic evidence is absent, but omitting the key is an old or
    # malformed provider response and must fail schema validation.
    notice: str | None = Field(max_length=420)
    move_idea: str | None = Field(max_length=420)
    problem: str | None = Field(max_length=420)
    consequence: str | None = Field(max_length=420)
    practical_alternative: str | None = Field(max_length=420)
    takeaway: str | None = Field(max_length=420)
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
    language: Literal["en", "zh-CN"]
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
    notice: str | None = None
    move_idea: str | None = None
    problem: str | None = None
    consequence: str | None = None
    practical_alternative: str | None = None
    takeaway: str | None = None
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
    ollama_models: list[str]
    openai_compatible: Literal["configured", "not-configured"]


class ServiceIdentity(CoachModel):
    product: Literal["open-chess-review-local-ai"] = "open-chess-review-local-ai"
    version: str = "0.1.0"


class HealthResponse(CoachModel):
    status: Literal["ok"] = "ok"
    maia: Literal["available", "not-installed", "error"]
    maia_models: dict[str, MaiaModelState]
    coach: CoachHealth
    identity: ServiceIdentity = Field(default_factory=ServiceIdentity)
