import type { CoachLanguage, MaiaModel } from "./schema";

export const MOBILE_COMPANION_POLICY_VERSION = "mobile-policy-v1" as const;
export const MOBILE_ENDPOINT_PROTOCOL_VERSION = "mobile-endpoint-v1" as const;

export type MobileCapabilityId =
  | "game-import"
  | "review-navigation"
  | "objective-analysis"
  | "human-analysis"
  | "coach"
  | "training";

export type MobileExecutionLane =
  | "device"
  | "cache"
  | "remote"
  | "deterministic"
  | "unavailable";

export type MobileDecisionReason =
  | "local-rules"
  | "local-review-data"
  | "canonical-cache"
  | "device-stockfish"
  | "trusted-remote-stockfish"
  | "trusted-remote-maia"
  | "trusted-remote-coach"
  | "deterministic-grounded-copy"
  | "requires-game"
  | "requires-canonical-analysis"
  | "requires-capable-stockfish"
  | "requires-trusted-remote-maia";

/** Capabilities advertised by an explicitly paired mobile analysis endpoint. */
export interface MobileEndpointManifestV1 {
  protocolVersion: typeof MOBILE_ENDPOINT_PROTOCOL_VERSION;
  endpointId: string;
  objective:
    | { available: false; gameAnalysisVersion: 1 }
    | { available: true; gameAnalysisVersion: 1; stockfishVersion: string };
  human: {
    available: boolean;
    maiaModels: MaiaModel[];
  };
  coach: {
    available: boolean;
    languages: CoachLanguage[];
  };
}

export interface MobileCacheState {
  game: boolean;
  objective: boolean;
  human: boolean;
  coach: boolean;
  training: boolean;
}

export interface MobileRemoteState {
  online: boolean;
  /** Set only after URL parsing and the native transport policy accepts HTTPS. */
  secureTransport: boolean;
  /** Represents an explicit pairing, not merely a reachable host. */
  authenticated: boolean;
  manifest?: MobileEndpointManifestV1;
}

export interface MobileRuntimeContext {
  cache: MobileCacheState;
  /** True only after a real Web Worker/WASM search capability probe. */
  deviceStockfishReady: boolean;
  selectedMaiaModel: MaiaModel;
  language: CoachLanguage;
  remote?: MobileRemoteState;
}

export interface MobileCapabilityDecision {
  capability: MobileCapabilityId;
  lane: MobileExecutionLane;
  reason: MobileDecisionReason;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMaiaModel(value: unknown): value is MaiaModel {
  return value === "maia3-5m" || value === "maia3-23m" || value === "maia3-79m";
}

function isCoachLanguage(value: unknown): value is CoachLanguage {
  return value === "en" || value === "zh-CN";
}

/** Validate the untrusted JSON returned by a future paired endpoint. */
export function isMobileEndpointManifestV1(value: unknown): value is MobileEndpointManifestV1 {
  if (!isRecord(value) || value.protocolVersion !== MOBILE_ENDPOINT_PROTOCOL_VERSION) return false;
  if (typeof value.endpointId !== "string" || value.endpointId.trim().length === 0) return false;
  if (!isRecord(value.objective) || !isRecord(value.human) || !isRecord(value.coach)) return false;

  const objectiveValid = value.objective.gameAnalysisVersion === 1
    && (value.objective.available === false
      || (value.objective.available === true
        && typeof value.objective.stockfishVersion === "string"
        && value.objective.stockfishVersion.trim().length > 0));
  const humanValid =
    typeof value.human.available === "boolean"
    && Array.isArray(value.human.maiaModels)
    && value.human.maiaModels.every(isMaiaModel);
  const coachValid =
    typeof value.coach.available === "boolean"
    && Array.isArray(value.coach.languages)
    && value.coach.languages.every(isCoachLanguage);

  return objectiveValid && humanValid && coachValid;
}

function trustedRemote(context: MobileRuntimeContext): MobileEndpointManifestV1 | null {
  const remote = context.remote;
  if (!remote?.online || !remote.secureTransport || !remote.authenticated || !remote.manifest) return null;
  return isMobileEndpointManifestV1(remote.manifest) ? remote.manifest : null;
}

/**
 * Resolve the execution lane without blending analysis sources.
 *
 * Cached canonical facts are preferred over new work. Stockfish may run on a
 * proven-capable device or a trusted endpoint; Maia is remote-only on mobile;
 * Coach falls back to deterministic grounded copy when no trusted model exists.
 */
export function resolveMobileCapabilities(context: MobileRuntimeContext): MobileCapabilityDecision[] {
  const endpoint = trustedRemote(context);

  const objective: MobileCapabilityDecision = context.cache.objective
    ? { capability: "objective-analysis", lane: "cache", reason: "canonical-cache" }
    : context.deviceStockfishReady
      ? { capability: "objective-analysis", lane: "device", reason: "device-stockfish" }
      : endpoint?.objective.available === true
        ? { capability: "objective-analysis", lane: "remote", reason: "trusted-remote-stockfish" }
        : { capability: "objective-analysis", lane: "unavailable", reason: "requires-capable-stockfish" };

  const human: MobileCapabilityDecision = context.cache.human
    ? { capability: "human-analysis", lane: "cache", reason: "canonical-cache" }
    : endpoint?.human.available === true && endpoint.human.maiaModels.includes(context.selectedMaiaModel)
      ? { capability: "human-analysis", lane: "remote", reason: "trusted-remote-maia" }
      : { capability: "human-analysis", lane: "unavailable", reason: "requires-trusted-remote-maia" };

  const coach: MobileCapabilityDecision = context.cache.coach
    ? { capability: "coach", lane: "cache", reason: "canonical-cache" }
    : endpoint?.coach.available === true && endpoint.coach.languages.includes(context.language)
      ? { capability: "coach", lane: "remote", reason: "trusted-remote-coach" }
      : { capability: "coach", lane: "deterministic", reason: "deterministic-grounded-copy" };

  return [
    { capability: "game-import", lane: "device", reason: "local-rules" },
    context.cache.game
      ? { capability: "review-navigation", lane: "device", reason: "local-review-data" }
      : { capability: "review-navigation", lane: "unavailable", reason: "requires-game" },
    objective,
    human,
    coach,
    context.cache.training || context.cache.objective
      ? { capability: "training", lane: "cache", reason: "canonical-cache" }
      : { capability: "training", lane: "unavailable", reason: "requires-canonical-analysis" },
  ];
}
