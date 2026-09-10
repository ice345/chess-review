"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { judgePracticeScore, practiceMoves } from "@chess-review/analysis";
import { legalBoardDestinations, replayUciLine } from "@chess-review/chess-core";
import { BrowserStockfish } from "@chess-review/stockfish";
import type { GameAnalysisV2, MoveAnalysisV2, PlayerColor } from "@chess-review/shared";
import { analysisScheduler } from "../lib/analysis-scheduler";
import { useReviewRuntime } from "./review-runtime";
import { useReviewStore } from "../store/review-store";

type Outcome = "solved" | "hinted" | "revealed" | "skipped";

export function MistakePractice({ analysis }: { analysis: GameAnalysisV2 }) {
  const runtime = useReviewRuntime();
  const [open, setOpen] = useState(false);
  return <section className="review-next-step" aria-label="Learn from your mistakes">
    <h2>Find a better move</h2>
    <p>Revisit your mistakes with the answers hidden. Play a move, check it with Stockfish, then explore the evidence.</p>
    <button type="button" className="secondary" onClick={() => { runtime.pausePlayback(); setOpen(true); }}>Practice my mistakes →</button>
    {open && <PracticeDialog key={runtime.gameId} analysis={analysis} initialColor={runtime.record.preferredOrientation ?? "white"} close={() => setOpen(false)} />}
  </section>;
}

function PracticeDialog({ analysis, initialColor, close }: { analysis: GameAnalysisV2; initialColor: PlayerColor; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [color, setColor] = useState(initialColor);
  const [inaccuracies, setInaccuracies] = useState(false);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const runtime = useReviewRuntime();
  const moves = useMemo(() => practiceMoves(analysis.moves, color, inaccuracies), [analysis, color, inaccuracies]);
  const current = moves[index];
  useEffect(() => { dialog.current?.showModal(); }, []);
  function reset() { setIndex(0); setOutcomes({}); }
  return <dialog ref={dialog} className="mistake-practice-dialog" aria-label="Mistake practice" onCancel={close} onKeyDown={(event) => event.stopPropagation()}>
    <header><div><span className="kicker">Learn from your own games</span><h2>Mistake practice</h2></div><button type="button" className="secondary" onClick={close}>Close practice</button></header>
    <div className="practice-filters">
      <label>Practice side <select value={color} onChange={(event) => { setColor(event.target.value as PlayerColor); reset(); }}><option value="white">White</option><option value="black">Black</option></select></label>
      <label><input type="checkbox" checked={inaccuracies} onChange={(event) => { setInaccuracies(event.target.checked); reset(); }} /> Include inaccuracies</label>
      <small>This session only. Changing filters starts a new session; viewed answers do not count as solved.</small>
    </div>
    {current ? <PracticePosition key={`${color}:${inaccuracies}:${current.ply}`} move={current}
      progress={`${index + 1} / ${moves.length}`} onNext={(outcome) => { setOutcomes((previous) => ({ ...previous, [current.ply]: outcome })); setIndex((previous) => previous + 1); }}
      onExplore={() => { close(); runtime.navigateToPly(current.ply); }} /> : <section aria-label="Practice summary">
      <h3>{moves.length ? "Session complete" : "No eligible mistakes for this side"}</h3>
      {moves.length ? <><p>{Object.values(outcomes).filter((value) => value === "solved").length} solved without hints · {Object.values(outcomes).filter((value) => value === "hinted").length} solved with hints · {Object.values(outcomes).filter((value) => value === "revealed").length} answers viewed · {Object.values(outcomes).filter((value) => value === "skipped").length} skipped</p><button type="button" className="secondary" onClick={reset}>Practice again</button></> : <p>Try the other side or include inaccuracies. Practice requires a legal Stockfish alternative to the played move.</p>}
    </section>}
  </dialog>;
}

function PracticePosition({ move, progress, onNext, onExplore }: { move: MoveAnalysisV2; progress: string; onNext: (outcome: Outcome) => void; onExplore: () => void }) {
  const game = useReviewStore((state) => state.game);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [input, setInput] = useState("");
  const [hinted, setHinted] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [message, setMessage] = useState("Find a better move. The engine arrows, evaluation and continuation are hidden.");
  const [busy, setBusy] = useState(false);
  const [solution, setSolution] = useState(move.stockfish.lines.find((line) => line.pv[0] === move.stockfish.bestMove)?.pv ?? [move.stockfish.bestMove!]);
  const [preview, setPreview] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const engine = useRef<BrowserStockfish | null>(null);
  useEffect(() => () => { controller.current?.abort(); engine.current?.terminate(); }, []);
  const replay = useMemo(() => {
    // Retain only the legal prefix if an old PV contains a malformed tail.
    const valid = [];
    for (let count = 1; count <= solution.length; count++) {
      try { valid.push(replayUciLine(move.fenBefore, solution.slice(0, count)).at(-1)!); } catch { break; }
    }
    return valid;
  }, [move.fenBefore, solution]);
  const fen = outcome && preview > 0 ? replay[preview - 1]?.fenAfter ?? move.fenBefore : move.fenBefore;
  async function attempt(uci: string) {
    if (controller.current || outcome) return;
    let san: string;
    try { san = replayUciLine(move.fenBefore, [uci])[0]!.san; }
    catch { setMessage("That move is not legal in this position. Try again."); return; }
    setInput(""); setSelected(null); setPromotion(null);
    if (uci === move.uci) { setMessage("That is the move played in the game. Try a different move."); return; }
    const abort = new AbortController(); controller.current = abort; setBusy(true); setMessage("Checking your move with Stockfish…");
    const timer = setTimeout(() => abort.abort(), 30_000);
    try {
      let root = move.stockfish;
      let candidate = root.lines.find((line) => line.pv[0] === uci);
      if (!candidate && uci !== root.bestMove) {
        // Outside MultiPV is unknown, not wrong. Check it at the same root,
        // with the original game history and a fresh unrestricted baseline.
        if (!game) throw new Error("The original game history is unavailable.");
        const history = { startFen: game.initialFen, moves: game.plies.slice(0, move.ply - 1).map((ply) => ply.uci) };
        const depth = Math.max(12, Math.min(15, root.depth));
        engine.current ??= new BrowserStockfish();
        const worker = engine.current;
        const result = await analysisScheduler.run("interactive-position", async () => {
          const baseline = await worker.search(move.fenBefore, { ...history, depth, multiPv: 3, signal: abort.signal });
          const answer = baseline.lines.find((line) => line.pv[0] === uci)
            ?? (await worker.search(move.fenBefore, { ...history, depth, multiPv: 1, searchMoves: [uci], signal: abort.signal })).lines.find((line) => line.pv[0] === uci);
          return { baseline, answer };
        }, abort.signal);
        root = result.baseline; candidate = result.answer;
      }
      if (abort.signal.aborted) throw new Error("Analysis was cancelled or timed out. Try again.");
      const best = root.lines.find((line) => line.pv[0] === root.bestMove);
      if (!root.bestMove || (!candidate && uci !== root.bestMove)) throw new Error("Stockfish did not return enough evidence. Retry or view the saved answer.");
      const verdict = uci === root.bestMove ? { accepted: true } : judgePracticeScore(root.score, candidate!.score, move.color);
      if (verdict.accepted) {
        setOutcome(hinted ? "hinted" : "solved"); setSolution(candidate?.pv ?? best?.pv ?? [uci]); setPreview(1);
        setMessage(`${san} is ${uci === root.bestMove ? "Stockfish’s top choice" : "a near-best alternative"} at depth ${root.depth}. ${hinted ? "Solved with a hint." : "Solved without hints."}`);
      } else setMessage(`${san} does not preserve the best available outcome at this depth. Try again, request a hint or view the answer.`);
    } catch (cause) {
      if (controller.current === abort) setMessage(abort.signal.aborted ? "Analysis was cancelled or timed out. Your answer was not marked wrong. Try again." : cause instanceof Error ? cause.message : "Unable to check this move. Try again.");
    } finally {
      clearTimeout(timer);
      if (controller.current === abort) { controller.current = null; setBusy(false); }
    }
  }
  function boardMove(from: string, to: string) {
    if (busy || outcome) return false;
    const legal = legalBoardDestinations(move.fenBefore, from).filter((destination) => destination.to === to);
    if (!legal.length) return false;
    if (legal.some((destination) => destination.promotion)) setPromotion({ from, to });
    else void attempt(`${from}${to}`);
    return false; // The task board remains at the decision position until reveal.
  }
  return <div className="practice-position">
    <div className="practice-board"><Chessboard options={{ position: fen, boardOrientation: move.color, allowDragging: !busy && !outcome, allowDrawingArrows: false,
      arrows: [], animationDurationInMs: 0,
      onPieceDrop: ({ sourceSquare, targetSquare }) => targetSquare ? boardMove(sourceSquare, targetSquare) : false,
      onSquareClick: ({ square }) => { if (busy || outcome) return; if (selected && legalBoardDestinations(move.fenBefore, selected).some((destination) => destination.to === square)) { boardMove(selected, square); setSelected(null); } else setSelected(square); },
      squareStyles: selected ? { [selected]: { boxShadow: "inset 0 0 0 3px #6d8290" } } : {},
      lightSquareStyle: { backgroundColor: "#f2e5cf" }, darkSquareStyle: { backgroundColor: "#91aeb6" },
      lightSquareNotationStyle: { color: "#6d8290" }, darkSquareNotationStyle: { color: "#f4eadb" },
    }} /></div>
    <section className="practice-controls" aria-label="Practice answer">
      <span className="kicker">Position {progress}</span><h3>{move.color === "white" ? "White" : "Black"} to move · move {move.fenBefore.split(" ")[5]}</h3>
      <p role="status" aria-label="Answer feedback">{message}</p>
      {!outcome && <><form onSubmit={(event) => { event.preventDefault(); void attempt(input.trim().toLowerCase()); }}>
        <label>Your move (UCI)<input value={input} onChange={(event) => setInput(event.target.value)} placeholder="e2e4" autoComplete="off" disabled={busy} /></label>
        <small>Move on the board, or type from/to squares. Add q, r, b or n for promotion.</small>
        <button type="submit" className="primary" disabled={busy || !input.trim()}>Check move</button>
      </form>
      {promotion && <div aria-label="Promotion choice">{(["q", "r", "b", "n"] as const).map((piece) => <button type="button" className="secondary" key={piece} onClick={() => void attempt(`${promotion.from}${promotion.to}${piece}`)}>{({ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" })[piece]}</button>)}</div>}
      {busy ? <button type="button" className="secondary" onClick={() => controller.current?.abort()}>Cancel check</button> : <div className="practice-actions">
        <button type="button" className="secondary" onClick={() => { setHinted(true); setMessage(`Hint: look for a move from ${move.stockfish.bestMove!.slice(0, 2)}.`); }}>Hint</button>
        <button type="button" className="secondary" onClick={() => { setOutcome("revealed"); setPreview(1); setSelected(null); setMessage("Answer viewed. This position is not counted as solved."); }}>Show answer</button>
        <button type="button" className="text-button" onClick={() => onNext("skipped")}>Skip position</button>
      </div>}</>}
      {outcome && <><p>Played in the game: {move.san}. {outcome === "revealed" ? "Saved Stockfish line" : "Your accepted line"}: <strong>{replay.map((ply) => ply.san).join(" ")}</strong></p>
        <div className="practice-actions"><button type="button" className="secondary" disabled={preview === 0} onClick={() => setPreview((value) => value - 1)}>Previous line move</button><button type="button" className="secondary" disabled={preview >= replay.length} onClick={() => setPreview((value) => value + 1)}>Next line move</button></div>
        <div className="practice-actions"><button type="button" className="primary" onClick={() => onNext(outcome)}>Next position</button><button type="button" className="secondary" onClick={onExplore}>Open full evidence</button></div>
      </>}
      <small>Stockfish checks at a limited depth. More than one good answer may exist.</small>
    </section>
  </div>;
}
