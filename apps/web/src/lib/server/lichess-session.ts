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
