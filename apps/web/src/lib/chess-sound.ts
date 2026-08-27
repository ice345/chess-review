import { noLegalMoveTerminalStatus, replayUciLine, type NormalizedGame, type ReplayedUciMove } from "@chess-review/chess-core";
import type { AnalysisBranchTree } from "./analysis-branch";

export type ChessSoundEvent =
  | "move"
  | "capture"
  | "castle"
  | "check"
  | "checkmate"
  | "gameEnd"
  | "promotion";

export type ChessSoundTheme = "wintrchess";
export type NavigationSoundDirection = "forward" | "backward";

export interface ChessSoundPreferences {
  enabled: boolean;
  volume: number;
  theme: ChessSoundTheme;
}

export interface ReviewSoundSnapshot {
  game: NormalizedGame | null;
  currentPly: number;
  branch: AnalysisBranchTree | null;
}

export interface ChessSoundTransition {
  event: ChessSoundEvent;
  direction: NavigationSoundDirection;
  token: string;
  move: ReplayedUciMove;
}

export interface ChessSoundAudio {
  currentTime: number;
  preload: string;
  volume: number;
  load(): void;
  pause(): void;
  play(): Promise<void> | void;
}

export type ChessSoundAudioFactory = (url: string) => ChessSoundAudio;

const WINTRCHESS_ASSETS: Record<ChessSoundEvent, string> = {
  move: "/sounds/wintrchess/move.mp3",
  capture: "/sounds/wintrchess/capture.mp3",
  castle: "/sounds/wintrchess/castle.mp3",
  check: "/sounds/wintrchess/check.mp3",
  checkmate: "/sounds/wintrchess/gameend.mp3",
  gameEnd: "/sounds/wintrchess/gameend.mp3",
  promotion: "/sounds/wintrchess/promote.mp3",
};

function asReplayedMove(move: {
  ply: number;
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
}): ReplayedUciMove {
  return {
    ply: move.ply,
    uci: move.uci,
    san: move.san,
    fenBefore: move.fenBefore,
    fenAfter: move.fenAfter,
  };
}

/** Resolve sound from one legal chess transition, never from the UI control. */
export function resolveChessSoundEvent(fenBefore: string, uci: string): ChessSoundEvent {
  const [move] = replayUciLine(fenBefore, [uci]);
  if (!move) throw new Error("A chess sound transition requires one legal move.");
  const terminal = noLegalMoveTerminalStatus(move.fenAfter);
  if (terminal?.kind === "checkmate") return "checkmate";
  if (terminal?.kind === "stalemate") return "gameEnd";
  if (move.san.endsWith("+")) return "check";
  if (move.san.startsWith("O-O")) return "castle";
  if (move.uci.length === 5 || move.san.includes("=")) return "promotion";
  if (move.san.includes("x")) return "capture";
  return "move";
}

function transition(
  move: ReplayedUciMove,
  direction: NavigationSoundDirection,
  scope: string,
): ChessSoundTransition {
  return {
    event: resolveChessSoundEvent(move.fenBefore, move.uci),
    direction,
    token: `${scope}:${direction}:${move.fenBefore}:${move.uci}`,
    move,
  };
}

/**
 * Select the real move crossed by a review navigation change.
 *
 * Forward jumps use the move entering the displayed position; backward jumps
 * use the move being undone. Returning from a branch to its canonical root is
 * intentionally silent because it does not traverse a real move.
 */
export function resolveReviewSoundTransition(
  previous: ReviewSoundSnapshot,
  next: ReviewSoundSnapshot,
): ChessSoundTransition | null {
  if (next.branch) {
    const nextNodeId = next.branch.activePath[next.branch.selectedIndex];
    const nextNode = nextNodeId ? next.branch.nodes[nextNodeId] : undefined;
    if (!previous.branch) {
      return nextNode?.move
        ? transition(nextNode.move, "forward", `branch:${next.branch.rootPly}:${nextNode.id}`)
        : null;
    }
    if (previous.branch.rootFen !== next.branch.rootFen || previous.branch.rootPly !== next.branch.rootPly) return null;
    const previousNodeId = previous.branch.activePath[previous.branch.selectedIndex];
    const previousNode = previousNodeId ? previous.branch.nodes[previousNodeId] : undefined;
    if (previousNodeId === nextNodeId && previous.branch.selectedIndex === next.branch.selectedIndex) return null;
    if (next.branch.selectedIndex > previous.branch.selectedIndex) {
      return nextNode?.move
        ? transition(nextNode.move, "forward", `branch:${next.branch.rootPly}:${nextNode.id}`)
        : null;
    }
    return previousNode?.move
      ? transition(previousNode.move, "backward", `branch:${previous.branch.rootPly}:${previousNode.id}`)
      : null;
  }

  if (!previous.game || previous.game !== next.game) return null;
  if (previous.branch || previous.currentPly === next.currentPly) return null;
  if (next.currentPly > previous.currentPly) {
    const move = next.game.plies[next.currentPly - 1];
    return move
      ? transition(asReplayedMove(move), "forward", `canonical:${move.ply}`)
      : null;
  }
  const move = next.game.plies[previous.currentPly - 1];
  return move
    ? transition(asReplayedMove(move), "backward", `canonical:${move.ply}`)
    : null;
}

export function isNewSoundTransition(lastToken: string | null, next: ChessSoundTransition | null): boolean {
  return next !== null && next.token !== lastToken;
}

export class ChessSoundController {
  private readonly audio = new Map<string, ChessSoundAudio>();
  private unlocked = false;
  private lastToken: string | null = null;

  constructor(
    private readonly createAudio: ChessSoundAudioFactory = (url) => new Audio(url),
  ) {}

  isUnlocked(): boolean {
    return this.unlocked;
  }

  resetSequence(): void {
    this.lastToken = null;
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    for (const url of new Set(Object.values(WINTRCHESS_ASSETS))) {
      try {
        const audio = this.createAudio(url);
        audio.preload = "auto";
        audio.load();
        this.audio.set(url, audio);
      } catch {
        // Audio is optional feedback. A platform/media failure must never
        // affect board state or navigation.
      }
    }
  }

  playTransition(next: ChessSoundTransition | null, preferences: ChessSoundPreferences): void {
    if (!next || !this.unlocked || !preferences.enabled || preferences.volume <= 0 || !isNewSoundTransition(this.lastToken, next)) return;
    this.lastToken = next.token;
    this.playEvent(next.event, preferences);
  }

  playEvent(event: ChessSoundEvent, preferences: ChessSoundPreferences): void {
    if (!this.unlocked || !preferences.enabled || preferences.volume <= 0) return;
    const url = WINTRCHESS_ASSETS[event];
    const audio = this.audio.get(url);
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, preferences.volume));
      const result = audio.play();
      if (result) void result.catch(() => undefined);
    } catch {
      // Browsers may reject playback despite an earlier gesture. Navigation
      // remains authoritative and audio failure stays invisible.
    }
  }
}
