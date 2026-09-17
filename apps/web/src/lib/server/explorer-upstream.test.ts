import { describe, expect, it } from "vitest";
import { EXPLORER_DEFAULT_POPULATION } from "@chess-review/openings";
import { explorerRequestHeaders, explorerUpstreamUrl } from "./explorer-upstream";

describe("explorer upstream request", () => {
  it("asks the players database for the population that was requested", () => {
    const url = new URL(explorerUpstreamUrl("lichess", "epd", EXPLORER_DEFAULT_POPULATION));
    expect(url.origin + url.pathname).toBe("https://explorer.lichess.ovh/lichess");
    expect(url.searchParams.get("fen")).toBe("epd");
    expect(url.searchParams.get("speeds")).toBe("blitz,rapid,classical");
    expect(url.searchParams.get("ratings")).toBe("1600,1800,2000,2200,2500");

    const restricted = new URL(explorerUpstreamUrl("lichess", "epd", { ratingFloor: 2000, speeds: ["rapid"] }));
    expect(restricted.searchParams.get("ratings")).toBe("2000,2200,2500");
    expect(restricted.searchParams.get("speeds")).toBe("rapid");
  });

  it("omits a bound instead of sending an empty one", () => {
    const everyGame = new URL(explorerUpstreamUrl("lichess", "epd", { ratingFloor: null, speeds: [] }));
    expect(everyGame.searchParams.has("ratings")).toBe(false);
    expect(everyGame.searchParams.has("speeds")).toBe(false);
  });

  it("authenticates every request, because the explorer refuses anonymous calls", () => {
    const headers = explorerRequestHeaders("lip_fixture");
    expect(headers.Authorization).toBe("Bearer lip_fixture");
    expect(headers.Accept).toBe("application/json");
  });

  it("never sends a rating floor to the masters cohort", () => {
    const url = new URL(explorerUpstreamUrl("masters", "epd", { ratingFloor: 2200, speeds: ["rapid"] }));
    expect(url.origin + url.pathname).toBe("https://explorer.lichess.ovh/masters");
    expect(url.searchParams.get("speeds")).toBe("rapid");
    expect(url.searchParams.has("ratings")).toBe(false);
  });
});
