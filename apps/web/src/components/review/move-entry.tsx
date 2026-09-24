"use client";

import { useState } from "react";
import { resolveMoveInput } from "@chess-review/chess-core";
import { useReviewStore } from "../../store/review-store";
import { useReviewRuntime } from "../review-runtime";

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

export function MoveEntry({
  compact = false,
  playMove,
}: {
  compact?: boolean;
  /** Prefer the board-owned play path when rendered inside ReviewBoardSurface. */
  playMove?: PlayMove;
} = {}) {
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
        ? "Type a move first, for example Nf3, e2e4, O-O or e8=Q."
        : `“${text}” is not a legal move in this position. Use SAN (Nf3, O-O, e8=Q) or UCI (g1f3, e7e8q).`);
      return;
    }
    setError(null);
    const played = play(resolved.from, resolved.to, resolved.promotion);
    if (!played) {
      setError(`“${resolved.san}” could not be played from this position.`);
      return;
    }
    setMessage(`Played ${resolved.san}.`);
    setValue("");
  }

  return (
    <form className="move-entry" onSubmit={submit}>
      <label htmlFor="board-move-input">Play a move</label>
      <input
        id="board-move-input"
        name="move"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder="Nf3 or g1f3"
        aria-describedby="board-move-help"
        onChange={(event) => { setValue(event.currentTarget.value); setError(null); }}
      />
      <button type="submit" className="secondary">Play</button>
      <small id="board-move-help">{compact ? "SAN or UCI, for example e8=Q." : "SAN or UCI. Promotions name the piece, for example e8=Q."}</small>
      {message !== null && <p className="move-entry-message" role="status">{message}</p>}
      {error !== null && <p className="move-entry-error" role="alert">{error}</p>}
    </form>
  );
}
