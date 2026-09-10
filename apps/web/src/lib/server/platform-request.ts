import { acquireProvider, checkPlatformRate, PlatformLimitError, providerCooldown, sameOriginMutation } from "./platform-guard";
import type { PlatformAccount } from "@chess-review/shared";
import { readBoundedJson, type PlatformSyncMode } from "../platform-sync";

class PlatformInputError extends Error {}
export interface SyncInput { account?: PlatformAccount; mode: PlatformSyncMode; limit: number; since?: string; cursor?: string }
function invalid(message: string): never { throw new PlatformInputError(message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Send a valid JSON object.");
  return value as Record<string, unknown>;
}
export function chessComUsername(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{2,32}$/i.test(value.trim())) invalid("Enter a valid Chess.com username.");
  return value.trim();
}
export async function readLinkInput(request: Request, signal = request.signal): Promise<string> {
  return chessComUsername(object(await readBoundedJson<unknown>(request, undefined, signal)).username);
}
export async function readSyncInput(request: Request, provider: "chesscom" | "lichess", signal = request.signal): Promise<SyncInput> {
  const body = object(await readBoundedJson<unknown>(request, undefined, signal));
  if (body.mode !== undefined && body.mode !== "incremental" && body.mode !== "full-history") invalid("Invalid sync mode.");
  if (body.limit !== undefined && (typeof body.limit !== "number" || !Number.isInteger(body.limit) || body.limit < 1 || body.limit > 100)) invalid("Sync limit must be an integer from 1 to 100.");
  if (body.since !== undefined && (typeof body.since !== "string" || body.since.length > 64 || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(body.since) || !Number.isFinite(Date.parse(body.since)))) invalid("Invalid sync date.");
  if (body.cursor !== undefined) {
    if (typeof body.cursor !== "string" || body.cursor.length > 100) invalid("Invalid sync checkpoint.");
    const match = provider === "chesscom"
      ? body.cursor.match(/^(?:cc2:(?:\d{4}-(?:0[1-9]|1[0-2]))?:|cc:\d+:)(\d+)$/)
      : body.cursor.match(/^li:(\d+)$/);
    if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 0
      || provider === "lichess" && Number(match[1]) > 8_640_000_000_000_000
      || body.cursor.startsWith("cc:") && !Number.isSafeInteger(Number(body.cursor.split(":")[1]))) invalid("Invalid sync checkpoint.");
  }
  let account: PlatformAccount | undefined;
  if (provider === "chesscom") {
    const raw = object(body.account);
    const username = chessComUsername(raw.username);
    if (raw.provider !== "chesscom" || typeof raw.id !== "string" || raw.id.length === 0 || raw.id.length > 128
      || typeof raw.linkedAt !== "string" || !Number.isFinite(Date.parse(raw.linkedAt))) invalid("A linked Chess.com account is required.");
    account = {
      id: raw.id, provider, username, linkedAt: raw.linkedAt,
      authMode: "public-username", verified: false,
      ...(typeof raw.displayName === "string" ? { displayName: raw.displayName.slice(0, 128) } : {}),
      ...(typeof raw.avatarUrl === "string" && raw.avatarUrl.length < 2048 ? { avatarUrl: raw.avatarUrl } : {}),
      ...(typeof raw.lastSyncAt === "string" && Number.isFinite(Date.parse(raw.lastSyncAt)) ? { lastSyncAt: raw.lastSyncAt } : {}),
      ...(raw.ratings && typeof raw.ratings === "object" && !Array.isArray(raw.ratings) ? { ratings: Object.fromEntries(Object.entries(raw.ratings).filter(([key, value]) => ["bullet", "blitz", "rapid", "daily"].includes(key) && typeof value === "number" && Number.isFinite(value))) } : {}),
    };
  }
  return { mode: (body.mode ?? "incremental") as PlatformSyncMode, limit: (body.limit ?? 50) as number,
    ...(typeof body.since === "string" ? { since: body.since } : {}),
    ...(typeof body.cursor === "string" ? { cursor: body.cursor } : {}), ...(account ? { account } : {}) };
}

/** Typed input failures and provider failures share a recoverable response shape. */
export async function platformRequest(request: Request, handler: (request: Request, signal: AbortSignal) => Promise<Response>, provider?: "chesscom" | "lichess"): Promise<Response> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 20_000);
  let release: (() => void) | undefined;
  try {
    if (!sameOriginMutation(request)) return Response.json({ error: "Open this website to change its platform connection." }, { status: 403 });
    checkPlatformRate(request);
    const signal = AbortSignal.any([request.signal, timeout.signal]);
    if (provider) release = await acquireProvider(provider, signal);
    // Next can proxy route requests; cloning the proxy loses native Request state.
    const response = await handler(request, signal);
    response.headers.set("Cache-Control", "no-store");
    if (provider && response.status === 429) providerCooldown(provider, response.headers.get("Retry-After"));
    return response;
  } catch (error) {
    if (error instanceof PlatformLimitError) return Response.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "no-store" } });
    if (error instanceof PlatformInputError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.name === "PayloadTooLargeError") return Response.json({ error: "Request body is too large." }, { status: 413 });
    if (timeout.signal.aborted) return Response.json({ error: "The platform request timed out. Retry from the saved checkpoint." }, { status: 504 });
    if (request.signal.aborted) return Response.json({ error: "The platform request was cancelled." }, { status: 408 });
    return Response.json({ error: "The platform could not be reached or returned an invalid response. Retry from the saved checkpoint." }, { status: 502 });
  } finally { release?.(); clearTimeout(timer); }
}
