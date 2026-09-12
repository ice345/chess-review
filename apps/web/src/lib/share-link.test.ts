import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  encodeSharePayload,
  MAX_SHARE_PGN_BYTES,
  readSharedPgn,
  SHARE_HASH_PREFIX,
  SHARE_ROUTE,
} from "./share-link";

describe("share link encoding", () => {
  const pgn = `[White "Каспаров"]\n[Black "Карпов"]\n\n1. e4 e5 *`;

  it("round-trips a PGN with non-ASCII characters", () => {
    const payload = encodeSharePayload(pgn);
    expect(payload).not.toBeNull();
    const result = readSharedPgn(`${SHARE_HASH_PREFIX}${payload}`);
    expect(result).toEqual({ ok: true, pgn });
  });

  it("returns null for a payload exceeding the byte budget", () => {
    const large = "x".repeat(MAX_SHARE_PGN_BYTES + 1);
    expect(encodeSharePayload(large)).toBeNull();
  });

  it("accepts a payload at exactly the byte budget", () => {
    const exact = "x".repeat(MAX_SHARE_PGN_BYTES);
    expect(encodeSharePayload(exact)).not.toBeNull();
    const result = readSharedPgn(`${SHARE_HASH_PREFIX}${encodeSharePayload(exact)}`);
    expect(result).toEqual({ ok: true, pgn: exact });
  });

  it("reports too-large when decoded bytes exceed the budget", () => {
    // Manually build an oversize payload by encoding MAX+1 bytes
    const oversize = "a".repeat(MAX_SHARE_PGN_BYTES + 1);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(oversize);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
    const raw = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    const result = readSharedPgn(`#pgn=${raw}`);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("returns empty when hash is absent or has no payload", () => {
    expect(readSharedPgn("")).toEqual({ ok: false, reason: "empty" });
    expect(readSharedPgn("#")).toEqual({ ok: false, reason: "empty" });
    expect(readSharedPgn("#pgn=")).toEqual({ ok: false, reason: "empty" });
  });

  it("returns invalid for garbage base64", () => {
    expect(readSharedPgn("#pgn=!!!not-valid")).toEqual({ ok: false, reason: "invalid" });
  });

  it("handles hash with or without leading #", () => {
    const payload = encodeSharePayload("1. e4 *");
    const withHash = readSharedPgn(`#pgn=${payload}`);
    const withoutHash = readSharedPgn(`pgn=${payload}`);
    expect(withHash).toEqual(withoutHash);
    expect(withHash).toEqual({ ok: true, pgn: "1. e4 *" });
  });
});

describe("buildShareUrl", () => {
  it("produces the expected URL shape", () => {
    const url = buildShareUrl("1. e4 *", "https://example.com");
    expect(url).toMatch(new RegExp(`^https://example\\.com${SHARE_ROUTE}${SHARE_HASH_PREFIX.replace("#", "#")}`));
    expect(url).toContain(SHARE_ROUTE);
  });

  it("trims trailing slash from origin", () => {
    const a = buildShareUrl("1. e4 *", "https://example.com/");
    const b = buildShareUrl("1. e4 *", "https://example.com");
    expect(a).toBe(b);
  });

  it("returns null for oversized PGN", () => {
    expect(buildShareUrl("x".repeat(MAX_SHARE_PGN_BYTES + 1), "https://example.com")).toBeNull();
  });
});
