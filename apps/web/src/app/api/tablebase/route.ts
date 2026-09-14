import { TABLEBASE_MAX_PIECES, normalizeTablebasePosition, tablebasePieceCount, tablebasePositionKey } from "@chess-review/tablebase";
import { platformRequest } from "../../../lib/server/platform-request";
import { fetchProvider, readProviderJson } from "../../../lib/server/platform-response";

/*
 * Tablebase proxy.
 *
 * The one place that talks to the Syzygy tables. The piece-count rule is enforced
 * here as well as in the panel: a position the tables do not cover must never
 * come back with a result, because that result would then be an engine guess
 * wearing the tablebase's authority.
 *
 * Only the position identity (EPD) is forwarded. No game, PGN, account or
 * identifier from the local library is part of the request.
 */

const HEADERS = { Accept: "application/json", "User-Agent": "OpenChessReview/0.1 https://github.com/ice345/chess-review" };
const TABLEBASE_ORIGIN = "https://tablebase.lichess.ovh";
const MAX_FEN_LENGTH = 128;

export async function GET(request: Request) {
  return platformRequest(request, async (request, signal) => {
    const raw = new URL(request.url).searchParams.get("fen");
    if (!raw || raw.length > MAX_FEN_LENGTH) return Response.json({ error: "Provide a position FEN." }, { status: 400 });
    let fen: string;
    let pieceCount: number | null;
    try {
      fen = tablebasePositionKey(raw);
      pieceCount = tablebasePieceCount(raw);
    } catch {
      return Response.json({ error: "That FEN is not a valid position." }, { status: 400 });
    }
    if (pieceCount === null) return Response.json({ error: "That FEN is not a valid position." }, { status: 400 });
    if (pieceCount > TABLEBASE_MAX_PIECES) {
      return Response.json({ error: `The tablebase covers positions with at most ${TABLEBASE_MAX_PIECES} pieces; this position has ${pieceCount}.` }, { status: 400 });
    }

    const response = await fetchProvider(`${TABLEBASE_ORIGIN}/standard?${new URLSearchParams({ fen }).toString()}`, { headers: HEADERS, cache: "no-store", signal, redirect: "error" });
    if (response.status === 429) return Response.json({ error: "The tablebase is rate limiting requests. Try again shortly." }, { status: 429, headers: { "Retry-After": response.headers.get("Retry-After") ?? "60" } });
    // 404 is the tables' answer for a position they do not carry.
    if (response.status === 404) return Response.json({ error: "The tables do not carry this position." }, { status: 404 });
    if (!response.ok) return Response.json({ error: `The tablebase request failed (${response.status}).` }, { status: 502 });
    const payload = await readProviderJson<unknown>(response, signal, 1_048_576);
    const position = normalizeTablebasePosition(payload, fen);
    if (!position) return Response.json({ error: "The tablebase returned an unusable response." }, { status: 502 });
    return Response.json({ position });
  });
}
