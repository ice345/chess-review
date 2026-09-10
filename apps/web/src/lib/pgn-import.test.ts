import { describe, expect, it, vi } from "vitest";
import { noLegalMoveTerminalStatus, parsePgn } from "@chess-review/chess-core";
import { buildReviewRecord } from "./review-library";
import { EXAMPLE_PGN } from "./example-game";
import { inspectPgnImport, MAX_PGN_BYTES, readPgnFile, splitPgnGames } from "./pgn-import";

const FIRST = '[White "Ada"]\n[Black "Mikhail"]\n\n1. e4 {a comment with 0-1 and [Event "not a game"]} e5 $1 (1... c5 (1... e6)) 2. Nf3 *';
const SECOND = '[White "Mei"]\n[Black "Yuki"]\n\n1. d4 d5 1/2-1/2';

describe("PGN file boundaries", () => {
  it("preserves comments, NAGs and nested variations while framing multiple games", () => {
    const choices = inspectPgnImport(`${FIRST}\n\n${SECOND}`);
    expect(choices).toHaveLength(2);
    expect(choices[0]?.pgn).toBe(`${FIRST}\n\n`);
    expect(choices[1]?.label).toContain("Mei vs Yuki");
  });
  it("does not split on result-like text inside tags, line comments or variations", () => {
    const raw = '[Event "A \\"quote\\" and 1-0"]\n\n1. e4 ; fake 0-1\n e5 (1... c5 *) 2. Nf3 *';
    expect(splitPgnGames(raw)).toEqual([raw]);
  });
  it("frames headerless games and games separated by new headers", () => {
    expect(inspectPgnImport("1. e4 e5 *\n1. d4 d5 *")).toHaveLength(2);
    expect(inspectPgnImport('1. e4 e5\n\n[White "Mei"]\n\n1. d4 d5 *')).toHaveLength(2);
  });
  it("rejects invalid games before offering a partially valid file", () => {
    expect(() => inspectPgnImport(`${FIRST}\n[White "Bad"]\n\n1. e5 *`)).toThrow("Game 2");
  });
  it.each(["", "{unfinished", '[White "unfinished', "1. e4 (1. d4 *", "1. e4 ) *", "\0"])("rejects invalid framing %#", (pgn) => {
    expect(() => inspectPgnImport(pgn)).toThrow();
  });
  it("bounds file bytes before reading and accepts uppercase extensions", async () => {
    const text = vi.fn().mockResolvedValue(FIRST);
    await expect(readPgnFile({ name: "games.pgn", size: MAX_PGN_BYTES + 1, text })).rejects.toThrow("1 MiB");
    expect(text).not.toHaveBeenCalled();
    await expect(readPgnFile({ name: "board.png", size: 10, text })).rejects.toThrow(".pgn");
    expect(text).not.toHaveBeenCalled();
    expect(await readPgnFile({ name: "GAME.PGN", size: FIRST.length, text })).toHaveLength(1);
  });
  it("bounds decoded UTF-8 input and game count", () => {
    expect(() => inspectPgnImport(`{${"鳥".repeat(400_000)}}\n1. e4 *`)).toThrow("1 MiB");
    expect(() => inspectPgnImport("1. e4 *\n".repeat(101))).toThrow("100 games");
    expect(inspectPgnImport("1. e4 *\n".repeat(100))).toHaveLength(100);
  });
  it("retains exact source text separately from the normalized import identity", async () => {
    const raw = `\r\n${FIRST}\r\n`;
    const record = await buildReviewRecord("pgn", raw);
    expect(record.originalPgn).toBe(raw);
    expect(record.id).toBe((await buildReviewRecord("pgn", FIRST)).id);
  });
  it("replays the complete example to its declared checkmate", () => {
    const game = parsePgn(EXAMPLE_PGN);
    expect(game.plies).toHaveLength(33);
    expect(game.headers.Result).toBe("1-0");
    expect(noLegalMoveTerminalStatus(game.finalFen)?.kind).toBe("checkmate");
  });
});
