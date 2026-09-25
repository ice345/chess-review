"use client";

import { useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { resolveMoveInput } from "@chess-review/chess-core";
import { useReviewStore } from "../../store/review-store";
import { useReviewRuntime } from "../review-runtime";
import { useUiLanguage } from "../../hooks/use-ui-language";

/**
 * The keyboard equivalent of moving a piece on the board.
 *
 * A screen-reader or keyboard-only visitor cannot drag a pawn, so the workspace
 * needs a way to state a move. This accepts SAN and UCI, validates it against the
 * position with chess-core, and hands it to `playMove` — the same path a drop
 * takes, so a practice attempt is judged and a variation is opened exactly as the
 * board would do it. A promotion must name its piece, because the board asks the
 * same question with its chooser instead of guessing.
 */
type PlayMove = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => boolean;

type MoveEntryCopy = {
  empty: string;
  illegal: (text: string) => string;
  couldNotPlay: (san: string) => string;
  played: (san: string) => string;
  label: string;
  placeholder: string;
  play: string;
  helpCompact: string;
  help: string;
};

const COPY: Record<UiLanguage, MoveEntryCopy> = {
  en: {
    empty: "Type a move first, for example Nf3, e2e4, O-O or e8=Q.",
    illegal: (text) => `\u201c${text}\u201d is not a legal move in this position. Use SAN (Nf3, O-O, e8=Q) or UCI (g1f3, e7e8q).`,
    couldNotPlay: (san) => `\u201c${san}\u201d could not be played from this position.`,
    played: (san) => `Played ${san}.`,
    label: "Play a move",
    placeholder: "Nf3 or g1f3",
    play: "Play",
    helpCompact: "SAN or UCI, for example e8=Q.",
    help: "SAN or UCI. Promotions name the piece, for example e8=Q.",
  },
  "zh-CN": {
    empty: "请先输入着法，例如 Nf3、e2e4、O-O 或 e8=Q。",
    illegal: (text) => `\u201c${text}\u201d 在此局面不是合法着法。请使用 SAN（Nf3、O-O、e8=Q）或 UCI（g1f3、e7e8q）。`,
    couldNotPlay: (san) => `\u201c${san}\u201d 无法在此局面走出。`,
    played: (san) => `已走 ${san}。`,
    label: "走出一步",
    placeholder: "Nf3 或 g1f3",
    play: "走棋",
    helpCompact: "SAN 或 UCI，例如 e8=Q。",
    help: "SAN 或 UCI。升变需指定棋子，例如 e8=Q。",
  },
};

export function MoveEntry({
  compact = false,
  playMove,
}: {
  compact?: boolean;
  /** Prefer the board-owned play path when rendered inside ReviewBoardSurface. */
  playMove?: PlayMove;
} = {}) {
  const copy = COPY[useUiLanguage()];
  const runtime = useReviewRuntime();
  const play = playMove ?? runtime.playMove;
  const positionFen = useReviewStore((store) => store.positionFen);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = value.trim();
    const resolved = resolveMoveInput(positionFen, text);
    if (resolved === null) {
      setMessage(null);
      setError(text === ""
        ? copy.empty
        : copy.illegal(text));
      return;
    }
    setError(null);
    const played = play(resolved.from, resolved.to, resolved.promotion);
    if (!played) {
      setError(copy.couldNotPlay(resolved.san));
      return;
    }
    setMessage(copy.played(resolved.san));
    setValue("");
  }

  return (
    <form className="move-entry" onSubmit={submit}>
      <label htmlFor="board-move-input">{copy.label}</label>
      <input
        id="board-move-input"
        name="move"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={copy.placeholder}
        aria-describedby="board-move-help"
        onChange={(event) => { setValue(event.currentTarget.value); setError(null); }}
      />
      <button type="submit" className="secondary">{copy.play}</button>
      <small id="board-move-help">{compact ? copy.helpCompact : copy.help}</small>
      {message !== null && <p className="move-entry-message" role="status">{message}</p>}
      {error !== null && <p className="move-entry-error" role="alert">{error}</p>}
    </form>
  );
}
