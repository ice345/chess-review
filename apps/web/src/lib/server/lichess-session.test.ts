import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { base64UrlSha256, openLichessValue, sealLichessValue } from "./lichess-session";

describe("Lichess OAuth session sealing", () => {
  beforeAll(() => { process.env.LICHESS_SESSION_SECRET = "test-only-secret-longer-than-24-characters"; });
  afterAll(() => { delete process.env.LICHESS_SESSION_SECRET; });

  it("round-trips server-only session data and rejects tampering", () => {
    const sealed = sealLichessValue({ accessToken: "secret-token", account: { id: "ada" } });
    expect(sealed).not.toContain("secret-token");
    expect(openLichessValue(sealed)).toEqual({ accessToken: "secret-token", account: { id: "ada" } });
    expect(() => openLichessValue(`${sealed.slice(0, -2)}aa`)).toThrow();
  });

  it("creates the RFC 7636 S256 challenge encoding", () => {
    expect(base64UrlSha256("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });
});
