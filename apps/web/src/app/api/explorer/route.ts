import { fenToEpd, normalizeFen } from "@chess-review/chess-core";
import { EXPLORER_SOURCES, normalizeExplorerPosition, type ExplorerSource } from "@chess-review/openings";
import { platformRequest } from "../../../lib/server/platform-request";
import { fetchProvider, readProviderJson } from "../../../lib/server/platform-response";

/*
 * Opening Explorer proxy.
 *
 * The browser never calls lichess.org directly: the request goes through this
 * route, which is the one place that talks to the public explorer. That keeps the
 * data destination declarable in Help ("the current position is sent to
 * lichess.org through this site's server"), gives the deployment a rate limit it
 * controls, and lets the response be validated before any of it reaches the UI.
 *
 * Only the position identity (EPD) and the source are forwarded. No game, PGN,
 * account or identifier from the local library is part of the request.
 */

const HEADERS = { Accept: "application/json", "User-Agent": "OpenChessReview/0.1 https://github.com/ice345/chess-review" };
const EXPLORER_ORIGIN = "https://explorer.lichess.ovh";
/** Public explorer databases are bounded; a huge position would answer with an error anyway. */
const MAX_FEN_LENGTH = 128;

class ExplorerInputError extends Error {}

function source(value: string | null): ExplorerSource {
  if (value === null) return "lichess";
  if ((EXPLORER_SOURCES as readonly string[]).includes(value)) return value as ExplorerSource;
  throw new ExplorerInputError("Unknown explorer source.");
}

function positionFen(value: string | null): string {
  if (!value || value.length > MAX_FEN_LENGTH) throw new ExplorerInputError("Provide a position FEN.");
  try {
    return fenToEpd(normalizeFen(value));
  } catch {
    throw new ExplorerInputError("That FEN is not a valid position.");
  }
}

function upstreamUrl(source: ExplorerSource, epd: string): string {
  const query = new URLSearchParams({ variant: "standard", fen: epd, moves: "12", topGames: "0" });
  if (source === "masters") {
    query.set("speeds", "blitz,rapid,classical");
    return `${EXPLORER_ORIGIN}/masters?${query.toString()}`;
  }
  // Human games at club strength and above: the explorer is a study tool here,
  // not a popularity poll of every casual blitz game.
  query.set("speeds", "blitz,rapid,classical");
  query.set("ratings", "1600,1800,2000,2200,2500");
  query.set("recentGames", "0");
  return `${EXPLORER_ORIGIN}/lichess?${query.toString()}`;
}

export async function GET(request: Request) {
  return platformRequest(request, async (request, signal) => {
    let epd: string;
    let selected: ExplorerSource;
    try {
      const url = new URL(request.url);
      selected = source(url.searchParams.get("source"));
      epd = positionFen(url.searchParams.get("fen"));
    } catch (error) {
      if (error instanceof ExplorerInputError) return Response.json({ error: error.message }, { status: 400 });
      throw error;
    }
    const response = await fetchProvider(upstreamUrl(selected, epd), { headers: HEADERS, cache: "no-store", signal, redirect: "error" });
    if (response.status === 429) return Response.json({ error: "The opening explorer is rate limiting requests. Try again shortly." }, { status: 429, headers: { "Retry-After": response.headers.get("Retry-After") ?? "60" } });
    // 404 is how the explorer reports a position with no games at all.
    if (response.status === 404) {
      const empty = normalizeExplorerPosition({ white: 0, draws: 0, black: 0, moves: [] }, epd, selected);
      return empty ? Response.json({ position: empty }) : Response.json({ error: "The opening explorer is unavailable." }, { status: 502 });
    }
    if (!response.ok) return Response.json({ error: `The opening explorer request failed (${response.status}).` }, { status: 502 });
    const payload = await readProviderJson<unknown>(response, signal, 1_048_576);
    const position = normalizeExplorerPosition(payload, epd, selected);
    // An unusable payload is reported as such: showing a partial table would
    // present missing games as zero games.
    if (!position) return Response.json({ error: "The opening explorer returned an unusable response." }, { status: 502 });
    return Response.json({ position });
  });
}
