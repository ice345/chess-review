import { requestOrigin } from "./request-origin";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const LICHESS_SESSION_COOKIE = "ocr_lichess_session";
export const LICHESS_PKCE_COOKIE = "ocr_lichess_pkce";

export interface LichessSession {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  account: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    ratings?: Partial<Record<string, number>>;
  };
}

export interface LichessPkceState {
  state: string;
  verifier: string;
  redirectUri: string;
  createdAt: string;
}

function secretKey(): Buffer {
  const secret = process.env.LICHESS_SESSION_SECRET;
  if (!secret || secret.length < 24) throw new Error("Set LICHESS_SESSION_SECRET to a private value of at least 24 characters.");
  return createHash("sha256").update(secret).digest();
}

export function requireLichessClientId(): string {
  const clientId = process.env.LICHESS_CLIENT_ID?.trim();
  if (!clientId) throw new Error("Set LICHESS_CLIENT_ID to a unique public OAuth client ID (for example your deployment hostname).");
  return clientId;
}

export function sealLichessValue(value: object): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function openLichessValue<T>(sealed: string): T {
  const payload = Buffer.from(sealed, "base64url");
  if (payload.length < 29) throw new Error("Invalid sealed Lichess session.");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8")) as T;
}

export function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function randomBase64Url(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** The encrypted cookie is server-owned, but validate expiry and shape before using its credential. */
export function readLichessSession(sealed: string): LichessSession {
  const session = openLichessValue<LichessSession>(sealed);
  if (!session || typeof session.accessToken !== "string" || !session.accessToken.length
    || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()
    || typeof session.account?.id !== "string" || !/^[\w-]{2,32}$/.test(session.account.id)
    || typeof session.account.username !== "string") throw new Error("The Lichess session is expired or invalid. Connect again.");
  return session;
}

/**
 * The origin a visitor actually reached us on, preferring the canonical
 * configured address. Every Lichess redirect — success and failure alike — must
 * be built from this, because the standalone server sees its own internal
 * address in `request.url` and would otherwise send the browser to
 * `http://web:3000` (or to an insecure cookie) behind the reverse proxy.
 */
export function lichessOrigin(request: Request): string {
  const requested = new URL(requestOrigin(request));
  const configured = process.env.APP_ORIGIN?.trim();
  const origin = new URL(configured || requested.origin);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("The website origin is not configured correctly.");
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))) throw new Error("Lichess sign-in requires HTTPS or a local development address.");
  if (configured && origin.origin !== requested.origin) throw new Error("Open the configured website address to connect Lichess.");
  if (!configured && process.env.NODE_ENV === "production" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("Lichess sign-in is not configured for this website address.");
  return origin.origin;
}

/**
 * Whether a session cookie may carry the `Secure` attribute. Derived from the
 * canonical origin instead of `new URL(request.url).protocol`: the standalone
 * server builds `request.url` from its internal listen address, so behind the
 * reverse proxy that expression depends on incidental header handling rather
 * than on the address the visitor actually used.
 */
export function secureCookieFor(request: Request): boolean {
  const configured = process.env.APP_ORIGIN?.trim();
  const origin = configured && configured.length > 0 ? configured : requestOrigin(request);
  return origin.startsWith("https://");
}

/**
 * Only the origin of the callback URL, with no path, query or fragment. A
 * redirect built from `new URL(request.url).origin` keeps `#fragment` when
 * someone opens the callback with one, and a fragment on a redirect re-sends it
 * back to the provider as if it were part of our own response.
 */
export function lichessRedirectOrigin(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}
