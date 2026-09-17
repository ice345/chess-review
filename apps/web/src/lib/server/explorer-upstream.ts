import { explorerPopulationQuery, explorerRatingBuckets, type ExplorerPopulationV1, type ExplorerSource } from "@chess-review/openings";

/**
 * The upstream request for one explorer answer.
 *
 * This is the whole contract with lichess.org's public explorer, in one testable
 * place: which position, which database and which games the numbers will describe.
 * The masters database is a single elite cohort — it takes the speeds but has no
 * rating buckets, so a rating floor is never sent to it.
 *
 * Since 2026-03-03 the explorer answers anonymous requests with 401 Authorization
 * Required, so every request carries a deployment token:
 * https://lichess.org/@/thibault/blog/the-opening-explorer-now-requires-authentication/FSWh9Zg3
 * The token is server configuration and never part of a response or the browser.
 */
const EXPLORER_ORIGIN = "https://explorer.lichess.ovh";

export const EXPLORER_USER_AGENT = "OpenChessReview/0.1 https://github.com/ice345/chess-review";

/** Headers for one explorer request. The token is required; the caller refuses to call without one. */
export function explorerRequestHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": EXPLORER_USER_AGENT,
    Authorization: `Bearer ${token}`,
  };
}

export function explorerUpstreamUrl(source: ExplorerSource, epd: string, population: ExplorerPopulationV1): string {
  const query = new URLSearchParams({ variant: "standard", fen: epd, moves: "12", topGames: "0" });
  const speeds = explorerPopulationQuery(population).speeds;
  if (source === "masters") {
    if (speeds !== "all") query.set("speeds", speeds);
    return `${EXPLORER_ORIGIN}/masters?${query.toString()}`;
  }
  if (speeds !== "all") query.set("speeds", speeds);
  const buckets = explorerRatingBuckets(population.ratingFloor);
  if (buckets.length > 0) query.set("ratings", buckets.join(","));
  query.set("recentGames", "0");
  return `${EXPLORER_ORIGIN}/lichess?${query.toString()}`;
}
