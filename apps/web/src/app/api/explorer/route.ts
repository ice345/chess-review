import { fenToEpd, normalizeFen } from "@chess-review/chess-core";
import {
  EXPLORER_SOURCES,
  normalizeExplorerPosition,
  parseExplorerPopulation,
  type ExplorerPopulationV1,
  type ExplorerSource,
} from "@chess-review/openings";
import { platformRequest } from "../../../lib/server/platform-request";
import { explorerRequestHeaders, explorerUpstreamUrl } from "../../../lib/server/explorer-upstream";
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
 * Only the position identity (EPD), the source and the population that was asked for
 * are forwarded. No game, PGN, account or identifier from the local library is part
 * of the request. The upstream token (`LICHESS_EXPLORER_TOKEN`) stays on the server.
 */

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

export async function GET(request: Request) {
  return platformRequest(request, async (request, signal) => {
    let epd: string;
    let selected: ExplorerSource;
    let population: ExplorerPopulationV1;
    try {
      const url = new URL(request.url);
      selected = source(url.searchParams.get("source"));
      epd = positionFen(url.searchParams.get("fen"));
      const parsed = parseExplorerPopulation(url.searchParams.get("rating"), url.searchParams.get("speeds"));
      if (!parsed) throw new ExplorerInputError("That explorer population is not one this site supports.");
      population = parsed;
    } catch (error) {
      if (error instanceof ExplorerInputError) return Response.json({ error: error.message }, { status: 400 });
      throw error;
    }
    // The explorer has required authentication since 2026-03-03. Without a token the
    // request would answer 401, which reads to the visitor as a broken site: say what
    // is actually missing, and keep the state distinguishable from a rate limit or an
    // outage so the panel can offer the right thing.
    const token = process.env.LICHESS_EXPLORER_TOKEN?.trim();
    if (!token) {
      return Response.json(
        { error: "The opening explorer needs a Lichess API token on this deployment.", unconfigured: true },
        { status: 503 },
      );
    }
    const response = await fetchProvider(explorerUpstreamUrl(selected, epd, population), { headers: explorerRequestHeaders(token), cache: "no-store", signal, redirect: "error" });
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
