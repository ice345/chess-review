import type {
  CoachExplanation,
  CoachGameFacts,
  CoachLanguage,
  CoachMoveFacts,
  GameCoachSummary,
  HumanMoveCandidate,
  MaiaModel,
  MaiaMoveReview,
  MaiaPositionAnalysis,
} from "@chess-review/shared";

export type { MaiaModel, MaiaMoveReview, MaiaPositionAnalysis } from "@chess-review/shared";
export type MaiaAvailability = "available" | "not-installed" | "error";
export type MaiaModelState = "active" | "cached" | "not-cached" | "unavailable" | "error";
export type CoachRequestProvider = "ollama" | "openai-compatible";

export interface LocalAiHealth {
  status: "ok";
  maia: MaiaAvailability;
  maiaModels: Record<MaiaModel, MaiaModelState>;
  coach: {
    ollama: "available" | "offline" | "error";
    ollamaModel: "available" | "missing" | "offline" | "error";
    configuredModel: string;
    ollamaModels: string[];
    openaiCompatible: "configured" | "not-configured";
  };
}

interface MaiaRequestConfig {
  targetElo: number;
  selfElo: number;
  opponentElo: number;
  multiPv?: number;
  model: MaiaModel;
  candidateMoves?: string[];
}

export interface MaiaMoveReviewRequest extends MaiaRequestConfig {
  fenBefore: string;
  playedMove: string;
}

export interface MaiaPositionAnalysisRequest extends MaiaRequestConfig {
  fen: string;
}

export class LocalAiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "LocalAiRequestError";
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

const LOCAL_AI_URL = (process.env.NEXT_PUBLIC_LOCAL_AI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function errorFromResponse(response: Response, body: unknown): LocalAiRequestError {
  const detail = typeof body === "object" && body !== null && "detail" in body
    ? (body as { detail?: unknown }).detail
    : undefined;
  const message = typeof detail === "object" && detail !== null && "message" in detail
    ? String((detail as { message: unknown }).message)
    : typeof detail === "string" ? detail : `Local AI request failed (${response.status}).`;
  const code = typeof detail === "object" && detail !== null && "code" in detail
    ? String((detail as { code: unknown }).code)
    : undefined;
  return new LocalAiRequestError(message, response.status, code);
}

export async function getLocalAiHealth(signal?: AbortSignal): Promise<LocalAiHealth> {
  const response = await fetch(`${LOCAL_AI_URL}/health`, signal === undefined ? {} : { signal });
  const body = await responseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  return body as LocalAiHealth;
}

interface ApiMaiaCandidate {
  uci: string;
  san: string;
  probability: number;
  policy_rank: number;
  wdl: { win: number; draw: number; loss: number } | null;
}

interface ApiMaiaMoveReview {
  kind: "move-review";
  fen_before: string;
  played_move: string;
  model: MaiaModel;
  target_elo: number;
  self_elo: number;
  opponent_elo: number;
  candidates: ApiMaiaCandidate[];
  candidate_probability_mass: number;
  played_move_probability: number;
  played_move_rank: number;
  expected_human_move: string | null;
  played_move_wdl: { win: number; draw: number; loss: number } | null;
  model_prediction: true;
}

interface ApiMaiaPositionAnalysis {
  kind: "position-analysis";
  fen: string;
  side_to_move: "white" | "black";
  model: MaiaModel;
  target_elo: number;
  self_elo: number;
  opponent_elo: number;
  candidates: ApiMaiaCandidate[];
  evaluated_candidates: ApiMaiaCandidate[];
  candidate_probability_mass: number;
  root_wdl: { win: number; draw: number; loss: number };
  expected_human_move: string | null;
  model_prediction: true;
}

function candidateFromApi(candidate: ApiMaiaCandidate): HumanMoveCandidate {
  return {
    uci: candidate.uci,
    san: candidate.san,
    probability: candidate.probability,
    policyRank: candidate.policy_rank,
    ...(candidate.wdl === null ? {} : { wdl: candidate.wdl }),
  };
}

function maiaConfigBody(request: MaiaRequestConfig) {
  return {
    target_elo: request.targetElo,
    self_elo: request.selfElo,
    opponent_elo: request.opponentElo,
    multi_pv: request.multiPv ?? 5,
    model: request.model,
    candidate_moves: request.candidateMoves ?? [],
  };
}

export async function reviewMaiaMove(
  request: MaiaMoveReviewRequest,
  signal?: AbortSignal,
): Promise<MaiaMoveReview> {
  const response = await fetch(`${LOCAL_AI_URL}/maia/move-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...maiaConfigBody(request),
      fen_before: request.fenBefore,
      played_move: request.playedMove,
    }),
    ...(signal === undefined ? {} : { signal }),
  });
  const body = await responseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  const result = body as ApiMaiaMoveReview;
  return {
    kind: result.kind,
    fenBefore: result.fen_before,
    playedMove: result.played_move,
    model: result.model,
    targetElo: result.target_elo,
    selfElo: result.self_elo,
    opponentElo: result.opponent_elo,
    candidates: result.candidates.map(candidateFromApi),
    candidateProbabilityMass: result.candidate_probability_mass,
    playedMoveProbability: result.played_move_probability,
    playedMoveRank: result.played_move_rank,
    ...(result.expected_human_move === null ? {} : { expectedHumanMove: result.expected_human_move }),
    ...(result.played_move_wdl === null ? {} : { playedMoveWdl: result.played_move_wdl }),
    modelPrediction: result.model_prediction,
  };
}

export async function analyzeMaiaPosition(
  request: MaiaPositionAnalysisRequest,
  signal?: AbortSignal,
): Promise<MaiaPositionAnalysis> {
  const response = await fetch(`${LOCAL_AI_URL}/maia/position-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...maiaConfigBody(request), fen: request.fen }),
    ...(signal === undefined ? {} : { signal }),
  });
  const body = await responseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  const result = body as ApiMaiaPositionAnalysis;
  return {
    kind: result.kind,
    fen: result.fen,
    sideToMove: result.side_to_move,
    model: result.model,
    targetElo: result.target_elo,
    selfElo: result.self_elo,
    opponentElo: result.opponent_elo,
    candidates: result.candidates.map(candidateFromApi),
    evaluatedCandidates: result.evaluated_candidates.map(candidateFromApi),
    candidateProbabilityMass: result.candidate_probability_mass,
    rootWdl: result.root_wdl,
    ...(result.expected_human_move === null ? {} : { expectedHumanMove: result.expected_human_move }),
    modelPrediction: result.model_prediction,
  };
}

export async function downloadMaiaModel(model: MaiaModel, signal?: AbortSignal): Promise<MaiaModelState> {
  const response = await fetch(`${LOCAL_AI_URL}/maia/models/${model}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: true }),
    ...(signal === undefined ? {} : { signal }),
  });
  const body = await responseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  return (body as { status: MaiaModelState }).status;
}

interface CoachRequestOptions {
  provider: CoachRequestProvider;
  model?: string;
  language: CoachLanguage;
}

function normalizeExplanation(value: CoachExplanation): CoachExplanation {
  const nullable = value as CoachExplanation & Record<string, unknown>;
  return {
    headline: value.headline,
    summary: value.summary,
    ...(typeof nullable.whyMoveWorks === "string" ? { whyMoveWorks: nullable.whyMoveWorks } : {}),
    ...(typeof nullable.whatWentWrong === "string" ? { whatWentWrong: nullable.whatWentWrong } : {}),
    ...(typeof nullable.betterPlan === "string" ? { betterPlan: nullable.betterPlan } : {}),
    ...(typeof nullable.humanPerspective === "string" ? { humanPerspective: nullable.humanPerspective } : {}),
    ...(typeof nullable.tacticalIdea === "string" ? { tacticalIdea: nullable.tacticalIdea } : {}),
    ...(typeof nullable.trainingTip === "string" ? { trainingTip: nullable.trainingTip } : {}),
    ...(typeof nullable.notice === "string" ? { notice: nullable.notice } : {}),
    ...(typeof nullable.moveIdea === "string" ? { moveIdea: nullable.moveIdea } : {}),
    ...(typeof nullable.problem === "string" ? { problem: nullable.problem } : {}),
    ...(typeof nullable.consequence === "string" ? { consequence: nullable.consequence } : {}),
    ...(typeof nullable.practicalAlternative === "string" ? { practicalAlternative: nullable.practicalAlternative } : {}),
    ...(typeof nullable.takeaway === "string" ? { takeaway: nullable.takeaway } : {}),
    confidence: value.confidence,
    validatedLines: value.validatedLines.map((line) => ({
      label: line.label,
      start: line.start,
      moves: line.moves,
      ...(typeof (line as typeof line & { note?: unknown }).note === "string" ? { note: line.note } : {}),
    })),
    grounding: value.grounding,
    source: value.source,
  };
}

async function coachRequest<T>(
  path: string,
  facts: CoachMoveFacts | CoachGameFacts,
  options: CoachRequestOptions,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${LOCAL_AI_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factsVersion: 1,
      facts,
      provider: options.provider,
      ...(options.model === undefined || options.model.trim() === "" ? {} : { model: options.model.trim() }),
      language: options.language,
    }),
    ...(signal === undefined ? {} : { signal }),
  });
  const body = await responseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  return body as T;
}

export async function explainCoachMove(
  facts: CoachMoveFacts,
  options: CoachRequestOptions,
  signal?: AbortSignal,
): Promise<CoachExplanation> {
  const result = await coachRequest<CoachExplanation>("/coach/explain", facts, options, signal);
  return normalizeExplanation(result);
}

export async function summarizeCoachGame(
  facts: CoachGameFacts,
  options: CoachRequestOptions,
  signal?: AbortSignal,
): Promise<GameCoachSummary> {
  return coachRequest<GameCoachSummary>("/coach/game-summary", facts, options, signal);
}
