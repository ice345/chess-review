import type {
  CoachExplanation,
  CoachGameFacts,
  CoachLanguage,
  CoachMoveFacts,
  GameCoachSummary,
} from "@chess-review/shared";

export type MaiaModel = "maia3-5m" | "maia3-23m" | "maia3-79m";
export type MaiaAvailability = "available" | "not-installed" | "error";
export type CoachRequestProvider = "ollama" | "openai-compatible";

export interface LocalAiHealth {
  status: "ok";
  maia: MaiaAvailability;
  coach: {
    ollama: "available" | "offline" | "error";
    ollamaModel: "available" | "missing" | "offline" | "error";
    configuredModel: string;
    ollamaModels: string[];
    openaiCompatible: "configured" | "not-configured";
  };
}

export interface MaiaMovesRequest {
  fen: string;
  targetElo: number;
  selfElo: number;
  opponentElo: number;
  playedMove?: string;
  multiPv?: number;
  model?: MaiaModel;
}

export interface MaiaMovesResponse {
  model: string;
  targetElo: number;
  selfElo: number;
  opponentElo: number;
  candidates: Array<{ uci: string; san: string; probability: number }>;
  candidateProbabilityMass: number;
  playedMoveProbability: number;
  expectedHumanMove?: string;
  humanWdl?: { win: number; draw: number; loss: number };
  modelPrediction: true;
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

interface ApiMaiaMovesResponse {
  model: string;
  target_elo: number;
  self_elo: number;
  opponent_elo: number;
  candidates: Array<{ uci: string; san: string; probability: number }>;
  candidate_probability_mass: number;
  played_move_probability: number;
  expected_human_move: string | null;
  human_wdl: { win: number; draw: number; loss: number } | null;
  model_prediction: true;
}

export async function analyzeMaiaMove(
  request: MaiaMovesRequest,
  signal?: AbortSignal,
): Promise<MaiaMovesResponse> {
  const response = await fetch(`${LOCAL_AI_URL}/maia/moves`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fen: request.fen,
      target_elo: request.targetElo,
      self_elo: request.selfElo,
      opponent_elo: request.opponentElo,
      ...(request.playedMove === undefined ? {} : { played_move: request.playedMove }),
      multi_pv: request.multiPv ?? 5,
      model: request.model ?? "maia3-5m",
    }),
    ...(signal === undefined ? {} : { signal }),
  });
  const body = await responseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  const result = body as ApiMaiaMovesResponse;
  return {
    model: result.model,
    targetElo: result.target_elo,
    selfElo: result.self_elo,
    opponentElo: result.opponent_elo,
    candidates: result.candidates,
    candidateProbabilityMass: result.candidate_probability_mass,
    playedMoveProbability: result.played_move_probability,
    ...(result.expected_human_move === null ? {} : { expectedHumanMove: result.expected_human_move }),
    ...(result.human_wdl === null ? {} : { humanWdl: result.human_wdl }),
    modelPrediction: result.model_prediction,
  };
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
