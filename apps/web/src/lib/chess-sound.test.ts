import { describe, expect, it, vi } from "vitest";
import { parsePgn, playLegalBoardMove, replayUciLine } from "@chess-review/chess-core";
import { appendBranchMove, createAnalysisBranch } from "./analysis-branch";
import {
  ChessSoundController,
  isNewSoundTransition,
  resolveChessSoundEvent,
  resolveReviewSoundTransition,
  type ChessSoundAudio,
  type ReviewSoundSnapshot,
} from "./chess-sound";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PREFERENCES = { enabled: true, volume: 0.35, theme: "wintrchess" as const };

function fenAfter(uciMoves: string[]): string {
  return replayUciLine(STARTING_FEN, uciMoves).at(-1)?.fenAfter ?? STARTING_FEN;
}

describe("chess sound event resolver", () => {
  it("resolves a quiet move", () => {
    expect(resolveChessSoundEvent(STARTING_FEN, "e2e4")).toBe("move");
  });

  it("resolves a capture", () => {
    expect(resolveChessSoundEvent(fenAfter(["e2e4", "d7d5"]), "e4d5")).toBe("capture");
  });

  it("resolves castling", () => {
    expect(resolveChessSoundEvent("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1")).toBe("castle");
  });

  it("resolves check ahead of a quiet move", () => {
    expect(resolveChessSoundEvent("4k3/8/8/8/8/8/4R3/4K3 w - - 0 1", "e2e7")).toBe("check");
  });

  it("resolves capture-check as check by precedence", () => {
    expect(resolveChessSoundEvent("4k3/4q3/8/8/8/8/4R3/4K3 w - - 0 1", "e2e7")).toBe("check");
  });

  it("resolves a non-checking promotion", () => {
    expect(resolveChessSoundEvent("8/P7/7k/8/8/8/8/7K w - - 0 1", "a7a8q")).toBe("promotion");
  });

  it("resolves a capture-promotion as promotion like WintrChess", () => {
    expect(resolveChessSoundEvent("1r6/P6k/8/8/8/8/8/7K w - - 0 1", "a7b8q")).toBe("promotion");
  });

  it("resolves checkmate before check", () => {
    expect(resolveChessSoundEvent(fenAfter(["f2f3", "e7e5", "g2g4"]), "d8h4")).toBe("checkmate");
  });

  it("uses the game-end cue when a legal move produces stalemate", () => {
    expect(resolveChessSoundEvent("k7/2Q5/2K5/8/8/8/8/8 w - - 0 1", "c7b6")).toBe("gameEnd");
  });
});

describe("review navigation sound semantics", () => {
  const game = parsePgn("1. e4 e5 2. Nf3 Nc6 *");
  const snapshot = (currentPly: number): ReviewSoundSnapshot => ({ game, currentPly, branch: null });

  it("uses the entered move when navigating forward, including jumps", () => {
    const resolved = resolveReviewSoundTransition(snapshot(0), snapshot(3));
    expect(resolved).toMatchObject({ direction: "forward", event: "move", move: { uci: "g1f3" } });
  });

  it("uses the undone move when navigating backward, including jumps", () => {
    const resolved = resolveReviewSoundTransition(snapshot(3), snapshot(1));
    expect(resolved).toMatchObject({ direction: "backward", event: "move", move: { uci: "g1f3" } });
  });

  it("plays a newly entered branch move and stays silent when returning to game", () => {
    const root = createAnalysisBranch(0, game.initialFen);
    const move = playLegalBoardMove(game.initialFen, { from: "e2", to: "e4" });
    const branch = appendBranchMove(root, move);
    const entered = resolveReviewSoundTransition(snapshot(0), { game, currentPly: 0, branch });
    const returned = resolveReviewSoundTransition({ game, currentPly: 0, branch }, snapshot(0));
    expect(entered).toMatchObject({ direction: "forward", move: { uci: "e2e4" } });
    expect(returned).toBeNull();
  });

  it("plays legal branch moves from a FEN-only study", () => {
    const fen = "8/8/7k/8/8/8/P7/7K w - - 0 1";
    const root = createAnalysisBranch(0, fen);
    const branch = appendBranchMove(root, playLegalBoardMove(fen, { from: "a2", to: "a3" }));
    const entered = resolveReviewSoundTransition(
      { game: null, currentPly: 0, branch: null },
      { game: null, currentPly: 0, branch },
    );
    expect(entered).toMatchObject({ event: "move", move: { uci: "a2a3" } });
  });

  it("suppresses only duplicate transition tokens", () => {
    const forward = resolveReviewSoundTransition(snapshot(0), snapshot(1));
    const backward = resolveReviewSoundTransition(snapshot(1), snapshot(0));
    expect(isNewSoundTransition(null, forward)).toBe(true);
    expect(isNewSoundTransition(forward?.token ?? null, forward)).toBe(false);
    expect(isNewSoundTransition(forward?.token ?? null, backward)).toBe(true);
  });
});

describe("chess sound controller", () => {
  it("preloads after unlock, clamps volume and suppresses duplicate playback", () => {
    const audio: ChessSoundAudio[] = [];
    const urls: string[] = [];
    const controller = new ChessSoundController((url) => {
      urls.push(url);
      const item: ChessSoundAudio = {
        currentTime: 8,
        preload: "",
        volume: 0,
        load: vi.fn(),
        pause: vi.fn(),
        play: vi.fn(),
      };
      audio.push(item);
      return item;
    });
    const forward = resolveReviewSoundTransition(
      { game: parsePgn("1. e4 *"), currentPly: 0, branch: null },
      { game: null, currentPly: 1, branch: null },
    );
    // Different game identities intentionally stay silent.
    expect(forward).toBeNull();

    const game = parsePgn("1. e4 *");
    const transition = resolveReviewSoundTransition(
      { game, currentPly: 0, branch: null },
      { game, currentPly: 1, branch: null },
    );
    controller.playTransition(transition, PREFERENCES);
    expect(audio).toHaveLength(0);
    controller.unlock();
    expect(audio).toHaveLength(6);
    expect(urls).toEqual(expect.arrayContaining([
      "/sounds/wintrchess/move.mp3",
      "/sounds/wintrchess/capture.mp3",
      "/sounds/wintrchess/castle.mp3",
      "/sounds/wintrchess/check.mp3",
      "/sounds/wintrchess/promote.mp3",
      "/sounds/wintrchess/gameend.mp3",
    ]));
    controller.playTransition(transition, { ...PREFERENCES, volume: 4 });
    controller.playTransition(transition, { ...PREFERENCES, volume: 4 });
    expect(audio.reduce((count, item) => count + (item.play as ReturnType<typeof vi.fn>).mock.calls.length, 0)).toBe(1);
    const playedOnce = audio.find((item) => (item.play as ReturnType<typeof vi.fn>).mock.calls.length === 1);
    expect(playedOnce).toMatchObject({ currentTime: 0, volume: 1, preload: "auto" });
    controller.resetSequence();
    controller.playTransition(transition, PREFERENCES);
    expect(audio.reduce((count, item) => count + (item.play as ReturnType<typeof vi.fn>).mock.calls.length, 0)).toBe(2);
    const played = audio.find((item) => (item.play as ReturnType<typeof vi.fn>).mock.calls.length === 1);
    expect(played).toBeUndefined();
    const replayed = audio.find((item) => (item.play as ReturnType<typeof vi.fn>).mock.calls.length === 2);
    expect(replayed).toMatchObject({ currentTime: 0, volume: 0.35, preload: "auto" });
  });

  it("swallows rejected browser playback without affecting navigation", async () => {
    const controller = new ChessSoundController(() => ({
      currentTime: 0,
      preload: "",
      volume: 0,
      load: vi.fn(),
      pause: vi.fn(),
      play: () => Promise.reject(new Error("autoplay denied")),
    }));
    const game = parsePgn("1. e4 *");
    controller.unlock();
    expect(() => controller.playTransition(resolveReviewSoundTransition(
      { game, currentPly: 0, branch: null },
      { game, currentPly: 1, branch: null },
    ), PREFERENCES)).not.toThrow();
    await Promise.resolve();
  });
});
