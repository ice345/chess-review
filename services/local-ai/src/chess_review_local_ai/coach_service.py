from __future__ import annotations

import re
from datetime import UTC, datetime

import chess
from pydantic import ValidationError

from .coach_provider import CoachGenerationError, CoachProviderRegistry
from .schemas import (
    CoachCriticalInsight,
    CoachExplainRequest,
    CoachExplanationPayload,
    CoachExplanationResponse,
    CoachGameFacts,
    CoachGameSummaryPayload,
    CoachGameSummaryRequest,
    CoachGameSummaryResponse,
    CoachGrounding,
    CoachMoveFacts,
    CoachSource,
    CoachTrainingRecommendation,
    CoachValidatedLine,
    CoachValidatedMove,
)

PROMPT_VERSION = "coach-v4"
MOVE_TOKEN = re.compile(
    r"(?<![\w])(?:"
    r"[a-h][1-8][a-h][1-8][qrbn]?|"
    r"O-O(?:-O)?[+#]?|"
    r"[KQRBN](?:[a-h1-8]{0,2})?x?[a-h][1-8](?:=[QRBN])?[+#]?|"
    r"[a-h](?:x[a-h])?[1-8](?:=[QRBN])?[+#]?"
    r")(?![\w])"
)
CJK_TOKEN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")


def _ensure_requested_language(language: str, task: str, values: list[str | None]) -> None:
    # Chinese is preferred when requested, but a valid English structured
    # explanation is kept instead of discarding the provider result.
    if language != "zh-CN":
        return
    sample = " ".join(value for value in values if value is not None)
    if len(CJK_TOKEN.findall(sample)) < 6 and not sample.strip():
        raise CoachGenerationError(f"Coach {task} response did not use the requested language.")


def _instructions(task: str, language: str) -> str:
    language_name = "Simplified Chinese" if language == "zh-CN" else "English"
    return f"""You are the explanation layer for a chess review application.
The supplied structured facts are canonical. Stockfish owns objective evaluation and classification; Maia owns only human-model probabilities. Never change, recalculate, contradict, or invent those facts.
Write in {language_name}. Return only JSON matching the supplied schema.
If evidence is missing, use null or communicate uncertainty. Do not infer tactics, material, openings, position features, or human frequencies beyond the fields supplied.
Every position-specific sentence must be a direct paraphrase of an explicit field. Do not add chess knowledge from pretraining. In particular: do not name openings or variations unless the opening object supplies that exact name; do not call a move common, popular, natural, easy, or hard unless the human object supplies model evidence; and do not claim center control, development, space, initiative, king safety, or a tactical motif unless the structured facts explicitly supply that evidence.
humanPerspective must be null when human is absent. tacticalIdea must be null when motifs is empty and classificationReason.sacrifice is absent. Generic training advice may describe a review process, but must not introduce named openings, positions, moves, or tactical facts.
Organize move teaching around notice, moveIdea, problem, consequence, practicalAlternative, and takeaway. Keep a field null when its corresponding deterministic fact is absent. consequence may only paraphrase boardFacts.futureConsequence and should be paired with that short validated line. practicalAlternative must be null unless boardFacts.practicalAlternative exists; it is a humanly likely, objectively acceptable option, never a replacement for the objective best move.
Concrete chess moves belong only in the structured lines field. Each line must use UCI moves copied as a prefix from a supplied canonical PV, with the correct before/after start. Do not put SAN or UCI notation in prose unless it appears verbatim in the facts.
Be concise: keep the complete move explanation under 350 words or the complete game summary under 500 words. Use at most one 2–4-ply validated line for a move explanation. Use null rather than filling unsupported optional fields.
Task: {task}."""


def _replay_notation(fen: str, pv: list[str]) -> tuple[set[str], list[chess.Board]]:
    board = chess.Board(fen)
    notation: set[str] = set()
    boards = [board.copy(stack=False)]
    for uci in pv:
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            break
        if move not in board.legal_moves:
            break
        notation.add(uci)
        notation.add(board.san(move))
        board.push(move)
        boards.append(board.copy(stack=False))
    return notation, boards


def _move_grounding(facts: CoachMoveFacts) -> tuple[set[str], list[chess.Board]]:
    notation = {facts.move.uci, facts.move.san}
    boards = [chess.Board(facts.position.fen_before), chess.Board(facts.position.fen_after)]
    for candidate in facts.objective.candidates:
        candidate_notation, candidate_boards = _replay_notation(facts.position.fen_before, candidate.pv)
        notation.update(candidate_notation)
        boards.extend(candidate_boards)
    for candidate in facts.objective.after_candidates:
        candidate_notation, candidate_boards = _replay_notation(facts.position.fen_after, candidate.pv)
        notation.update(candidate_notation)
        boards.extend(candidate_boards)
    return notation, boards


def _sanitize_text(value: str | None, notation: set[str], removed: list[str]) -> str | None:
    if value is None or value.strip().lower() in {"", "null", "none", "n/a"}:
        return None

    def replace(match: re.Match[str]) -> str:
        token = match.group(0)
        if token in notation:
            return token
        if token not in removed:
            removed.append(token)
        return "[unverified move omitted]"

    return MOVE_TOKEN.sub(replace, value)


def _canonical_sequences(facts: CoachMoveFacts, start: str) -> list[list[str]]:
    if start == "before":
        return [candidate.pv for candidate in facts.objective.candidates] + [[facts.move.uci]]
    return [candidate.pv for candidate in facts.objective.after_candidates]


def _validated_lines(
    payload: CoachExplanationPayload,
    facts: CoachMoveFacts,
    notation: set[str],
    removed: list[str],
) -> list[CoachValidatedLine]:
    validated: list[CoachValidatedLine] = []
    for line in payload.lines:
        canonical = _canonical_sequences(facts, line.start)
        if not line.moves or not any(sequence[: len(line.moves)] == line.moves for sequence in canonical):
            marker = " ".join(line.moves)
            if marker and marker not in removed:
                removed.append(marker)
            continue
        board = chess.Board(facts.position.fen_before if line.start == "before" else facts.position.fen_after)
        moves: list[CoachValidatedMove] = []
        legal = True
        for uci in line.moves:
            try:
                move = chess.Move.from_uci(uci)
            except ValueError:
                legal = False
                break
            if move not in board.legal_moves:
                legal = False
                break
            moves.append(CoachValidatedMove(uci=uci, san=board.san(move)))
            board.push(move)
        if legal:
            validated.append(CoachValidatedLine(
                label=_sanitize_text(line.label, notation, removed) or "Validated line",
                start=line.start,
                moves=moves,
                note=_sanitize_text(line.note, notation, removed),
            ))
    return validated


class CoachService:
    def __init__(self, registry: CoachProviderRegistry | None = None) -> None:
        self.registry = registry or CoachProviderRegistry()

    def explain(self, request: CoachExplainRequest) -> CoachExplanationResponse:
        provider = self.registry.get(request.provider)
        result = provider.generate_json(
            instructions=_instructions("Teach the reviewed move through notice, idea, problem, short consequence, supported practical alternative, and takeaway", request.language),
            facts_json=request.facts.model_dump_json(by_alias=True, exclude_none=True),
            schema=CoachExplanationPayload.model_json_schema(by_alias=True),
            schema_name="coach_move_explanation",
            model=request.model,
        )
        try:
            payload = CoachExplanationPayload.model_validate(result.content)
        except ValidationError as exc:
            raise CoachGenerationError("Coach move response failed schema validation.") from exc
        _ensure_requested_language(request.language, "move", [
            payload.headline,
            payload.summary,
            payload.notice,
            payload.move_idea,
            payload.problem,
            payload.consequence,
            payload.practical_alternative,
            payload.takeaway,
        ])

        notation, _boards = _move_grounding(request.facts)
        removed: list[str] = []
        unsupported: list[str] = []
        lines = _validated_lines(payload, request.facts, notation, removed)
        human_perspective = _sanitize_text(payload.human_perspective, notation, removed)
        if request.facts.human is None and human_perspective is not None:
            unsupported.append("humanPerspective: no Maia facts supplied")
            human_perspective = None
        tactical_idea = _sanitize_text(payload.tactical_idea, notation, removed)
        has_tactical_evidence = bool(
            request.facts.board_facts.motifs
            or request.facts.objective.classification_reason.sacrifice
        )
        if not has_tactical_evidence and tactical_idea is not None:
            unsupported.append("tacticalIdea: no tactical evidence supplied")
            tactical_idea = None
        consequence = _sanitize_text(payload.consequence, notation, removed)
        if request.facts.board_facts.future_consequence is None and consequence is not None:
            unsupported.append("consequence: no deterministic future-consequence facts supplied")
            consequence = None
        practical_alternative = _sanitize_text(payload.practical_alternative, notation, removed)
        if request.facts.board_facts.practical_alternative is None and practical_alternative is not None:
            unsupported.append("practicalAlternative: no Stockfish/Maia-supported alternative supplied")
            practical_alternative = None
        fields = {
            "headline": _sanitize_text(payload.headline, notation, removed) or "Grounded move review",
            "summary": _sanitize_text(payload.summary, notation, removed) or "Insufficient grounded explanation.",
            "why_move_works": _sanitize_text(payload.why_move_works, notation, removed),
            "what_went_wrong": _sanitize_text(payload.what_went_wrong, notation, removed),
            "better_plan": _sanitize_text(payload.better_plan, notation, removed),
            "human_perspective": human_perspective,
            "tactical_idea": tactical_idea,
            "training_tip": _sanitize_text(payload.training_tip, notation, removed),
            "notice": _sanitize_text(payload.notice, notation, removed),
            "move_idea": _sanitize_text(payload.move_idea, notation, removed),
            "problem": _sanitize_text(payload.problem, notation, removed),
            "consequence": consequence,
            "practical_alternative": practical_alternative,
            "takeaway": _sanitize_text(payload.takeaway, notation, removed),
        }
        return CoachExplanationResponse(
            **fields,
            confidence="low" if removed or unsupported else payload.confidence,
            validated_lines=lines,
            grounding=CoachGrounding(
                removed_move_mentions=removed,
                removed_unsupported_claims=unsupported,
                validated_line_count=len(lines),
            ),
            source=CoachSource(
                provider=request.provider,
                model=result.model,
                language=request.language,
                prompt_version=PROMPT_VERSION,
                generated_at=datetime.now(UTC).isoformat(),
            ),
        )

    def game_summary(self, request: CoachGameSummaryRequest) -> CoachGameSummaryResponse:
        provider = self.registry.get(request.provider)
        result = provider.generate_json(
            instructions=_instructions("Summarize the game and return prioritized training recommendations", request.language),
            facts_json=request.facts.model_dump_json(by_alias=True, exclude_none=True),
            schema=CoachGameSummaryPayload.model_json_schema(by_alias=True),
            schema_name="coach_game_summary",
            model=request.model,
        )
        try:
            payload = CoachGameSummaryPayload.model_validate(result.content)
        except ValidationError as exc:
            raise CoachGenerationError("Coach game summary failed schema validation.") from exc
        _ensure_requested_language(request.language, "game summary", [
            payload.headline,
            payload.summary,
            *payload.strengths,
            *payload.weaknesses,
            *(moment.insight for moment in payload.critical_moments),
            *(value for item in payload.training_recommendations for value in (item.title, item.reason, item.focus)),
        ])

        notation = {move.uci for move in request.facts.moves} | {move.san for move in request.facts.moves}
        removed: list[str] = []
        canonical_critical = {moment.ply for moment in request.facts.critical_moments}
        unsupported = [
            f"criticalMoment.ply={moment.ply}: not a canonical critical moment"
            for moment in payload.critical_moments
            if moment.ply not in canonical_critical
        ]
        critical = [
            CoachCriticalInsight(
                ply=moment.ply,
                insight=_sanitize_text(moment.insight, notation, removed) or "Grounded critical moment.",
            )
            for moment in payload.critical_moments
            if moment.ply in canonical_critical
        ]
        recommendations = [
            CoachTrainingRecommendation(
                title=_sanitize_text(item.title, notation, removed) or "Training focus",
                reason=_sanitize_text(item.reason, notation, removed) or "Derived from structured game facts.",
                focus=_sanitize_text(item.focus, notation, removed) or "Review the canonical critical moments.",
            )
            for item in payload.training_recommendations
        ]
        return CoachGameSummaryResponse(
            headline=_sanitize_text(payload.headline, notation, removed) or "Grounded game review",
            summary=_sanitize_text(payload.summary, notation, removed) or "Insufficient grounded summary.",
            strengths=[_sanitize_text(item, notation, removed) or "Grounded strength." for item in payload.strengths],
            weaknesses=[_sanitize_text(item, notation, removed) or "Grounded weakness." for item in payload.weaknesses],
            critical_moments=critical,
            training_recommendations=recommendations,
            confidence="low" if removed or unsupported else payload.confidence,
            grounding=CoachGrounding(
                removed_move_mentions=removed,
                removed_unsupported_claims=unsupported,
                validated_line_count=0,
            ),
            source=CoachSource(
                provider=request.provider,
                model=result.model,
                language=request.language,
                prompt_version=PROMPT_VERSION,
                generated_at=datetime.now(UTC).isoformat(),
            ),
        )
