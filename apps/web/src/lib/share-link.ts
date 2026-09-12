/** URL fragment prefix for a shared game. */
export const SHARE_HASH_PREFIX = "#pgn=" as const;

/** Client route that reads a shared game from its own fragment. */
export const SHARE_ROUTE = "/share" as const;

/** Raw UTF-8 PGN byte budget, chosen so the encoded URL stays well under an 8 KiB Nginx request line. */
export const MAX_SHARE_PGN_BYTES = 4096 as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// base64url helpers that work in both browser and Node/Vitest
// We go through standard base64 (atob/btoa) and translate the alphabet.

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64urlToBytes(b64: string): Uint8Array | null {
  try {
    // Restore standard base64 with padding
    const standard = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (standard.length % 4)) % 4;
    const padded = standard + "=".repeat(pad);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** base64url (unpadded) of the UTF-8 PGN, or null when it exceeds MAX_SHARE_PGN_BYTES. */
export function encodeSharePayload(pgn: string): string | null {
  const bytes = encoder.encode(pgn);
  if (bytes.length > MAX_SHARE_PGN_BYTES) return null;
  return bytesToBase64url(bytes);
}

/** Absolute share URL for a game, or null when it is too large to share by link. */
export function buildShareUrl(pgn: string, origin: string): string | null {
  const payload = encodeSharePayload(pgn);
  if (payload === null) return null;
  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}${SHARE_ROUTE}${SHARE_HASH_PREFIX}${payload}`;
}

type ReadResult =
  | { ok: true; pgn: string }
  | { ok: false; reason: "empty" | "invalid" | "too-large" };

/** Reads a `location.hash`; "empty" when absent, "invalid" when the payload cannot decode, "too-large" when it exceeds the budget. */
export function readSharedPgn(hash: string): ReadResult {
  // Strip leading '#' if present
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;

  // Require the pgn= prefix (SHARE_HASH_PREFIX without '#')
  const prefix = SHARE_HASH_PREFIX.slice(1); // "pgn="
  if (!raw.startsWith(prefix)) return { ok: false, reason: "empty" };

  const payload = raw.slice(prefix.length);
  if (!payload) return { ok: false, reason: "empty" };

  const bytes = base64urlToBytes(payload);
  if (!bytes) return { ok: false, reason: "invalid" };

  if (bytes.length > MAX_SHARE_PGN_BYTES) return { ok: false, reason: "too-large" };

  try {
    const pgn = decoder.decode(bytes);
    return { ok: true, pgn };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
