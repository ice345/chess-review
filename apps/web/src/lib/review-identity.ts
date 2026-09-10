import { parsePgn } from "@chess-review/chess-core";
import type { ReviewRecord } from "./review-library";

/** Derived by the canonical parser, never accepted from a backup as evidence. */
export interface ReviewIdentity {
  version: 1;
  input: string;
  initialFen: string;
  uciMoves: string[];
}
export function buildReviewIdentity(input: string, game: ReturnType<typeof parsePgn>): ReviewIdentity {
  return { version: 1, input, initialFen: game.initialFen, uciMoves: game.plies.map((ply) => ply.uci) };
}
export function hasReviewIdentity(record: ReviewRecord): boolean {
  const identity = record.identity;
  return identity?.version === 1 && identity.input === record.input && identity.initialFen === record.initialFen
    && Array.isArray(identity.uciMoves) && identity.uciMoves.length === record.totalPlies;
}
export function readReviewIdentity(record: ReviewRecord): ReviewIdentity {
  if (hasReviewIdentity(record)) return record.identity!;
  return buildReviewIdentity(record.input, parsePgn(record.input));
}
