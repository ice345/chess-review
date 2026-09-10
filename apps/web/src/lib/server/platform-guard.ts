import { requestOrigin } from "./request-origin";
import { createHash } from "node:crypto";
import { isIP } from "node:net";

export class PlatformLimitError extends Error {
  constructor(message: string, readonly retryAfter = 60) { super(message); }
}
interface Bucket { count: number; resetsAt: number }
interface Waiter { resolve: (release: () => void) => void; reject: (error: unknown) => void; signal: AbortSignal; abort: () => void }
interface Lane { active: boolean; waiters: Waiter[]; cooldownUntil: number }
interface GuardState { buckets: Map<string, Bucket>; lanes: Map<string, Lane> }
const globalState = globalThis as typeof globalThis & { __ocrPlatformGuard?: GuardState };
const state = globalState.__ocrPlatformGuard ??= { buckets: new Map(), lanes: new Map() };

/** Fixed one-minute windows, bounded memory, no IP/token logging or persistence. */
export function checkPlatformRate(request: Request): void {
  const now = Date.now();
  for (const [key, bucket] of state.buckets) if (bucket.resetsAt <= now) state.buckets.delete(key);
  // Do not trust caller-supplied forwarding headers by default. An operator may
  // select one header ONLY behind an ingress that overwrites it and blocks bypass.
  const header = process.env.PLATFORM_CLIENT_IP_HEADER;
  const rawIp = header ? request.headers.get(header)?.trim() : undefined;
  const client = rawIp && isIP(rawIp) ? createHash("sha256").update(rawIp).digest("hex") : "shared";
  const metadata = /\/(config|session)$/.test(new URL(request.url).pathname) && request.method === "GET";
  const group = metadata ? "metadata" : "work";
  for (const [key, limit] of [[`global:${group}`, metadata ? 600 : 240], [`${group}:${client}`, metadata ? 240 : 120]] as const) {
    let bucket = state.buckets.get(key);
    if (!bucket) {
      if (state.buckets.size >= 10_000) throw new PlatformLimitError("The platform service is busy. Retry shortly.");
      bucket = { count: 0, resetsAt: now + 60_000 }; state.buckets.set(key, bucket);
    }
    if (bucket.count >= limit) throw new PlatformLimitError("Too many platform requests. Retry from the saved checkpoint shortly.", Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)));
    bucket.count++;
  }
}

export function sameOriginMutation(request: Request): boolean {
  if (["GET", "HEAD"].includes(request.method)) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients still receive the same rate limits.
  try { return origin === requestOrigin(request); } catch { return false; }
}

/** One provider request at a time through completion/body consumption, with eight bounded waiters. */
export function acquireProvider(provider: "chesscom" | "lichess", signal: AbortSignal): Promise<() => void> {
  signal.throwIfAborted();
  let lane = state.lanes.get(provider);
  if (!lane) { lane = { active: false, waiters: [], cooldownUntil: 0 }; state.lanes.set(provider, lane); }
  const current = lane;
  const remaining = Math.ceil((current.cooldownUntil - Date.now()) / 1000);
  if (remaining > 0) throw new PlatformLimitError(`${provider === "lichess" ? "Lichess" : "Chess.com"} asked us to pause requests. Retry from the saved checkpoint.`, remaining);
  function releaseOnce(): () => void {
    let released = false;
    return () => {
      if (released) return; released = true;
      const next = current.waiters.shift();
      if (next) { next.signal.removeEventListener("abort", next.abort); next.resolve(releaseOnce()); }
      else current.active = false;
    };
  }
  if (!current.active) { current.active = true; return Promise.resolve(releaseOnce()); }
  if (current.waiters.length >= 8) throw new PlatformLimitError("The platform service is busy. Retry from the saved checkpoint.", 5);
  return new Promise((resolve, reject) => {
    const waiter: Waiter = { resolve, reject, signal, abort: () => { current.waiters = current.waiters.filter((item) => item !== waiter); reject(signal.reason); } };
    current.waiters.push(waiter); signal.addEventListener("abort", waiter.abort, { once: true });
  });
}
export function providerCooldown(provider: "chesscom" | "lichess", retryAfter: string | null): void {
  const lane = state.lanes.get(provider); if (!lane) return;
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : retryAfter ? Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000) : 60;
  const wait = Math.max(60, Math.min(3600, Number.isFinite(seconds) ? seconds : 60));
  lane.cooldownUntil = Date.now() + wait * 1000;
  for (const pending of lane.waiters.splice(0)) {
    pending.signal.removeEventListener("abort", pending.abort);
    pending.reject(new PlatformLimitError("The platform asked us to pause requests. Retry from the saved checkpoint.", wait));
  }
}
