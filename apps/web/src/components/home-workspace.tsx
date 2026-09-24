"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import { playLegalBoardMove } from "@chess-review/chess-core";
import type { SyncedGame } from "@chess-review/shared";
import { Icon, WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { useBoardPieces } from "../hooks/use-board-pieces";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import type { LibrarySnapshot } from "../lib/library-snapshot";
import { buildReviewRecord, saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { externalGameKey } from "../lib/review-status";
import { STARTING_FEN, openSyncedGameRecord } from "./import-desk";

export function HomeWorkspace() {
  const { snapshot, error, loading, refresh } = useLibrarySnapshot();
  const latest = snapshot?.records[0];
  const href = latest ? `/review/${latest.id}${latest.kind === "fen" ? "/engine" : ""}` : "/import";
  return <main className="page-scroll bluebird-home">
    <section className="bluebird-hero" aria-label="Home prelude">
      <div className="bluebird-hero-inside">
        <p className="page-kicker">A quiet place to understand chess</p>
        <h1>Between each move,<br />a little more possibility.</h1>
        <p>Return to a game. Understand a choice.<br />Take something new into the next one.</p>
        <Link className="primary-link" href={href}>{latest ? "Return to your game" : "Import your first game"} →</Link>
      </div>
    </section>
    {error && <p role="alert" className="error">{error} <button type="button" className="text-button" disabled={loading} onClick={() => void refresh()}>Retry loading games</button></p>}
    <div className="home-desk-heading"><h2>Start here today</h2><span>Your study desk</span></div>
    <div className="home-next-grid">
      <section><p className="page-kicker">On your desk</p><h2>{latest ? latest.title : "Your first game awaits."}</h2><p>{loading && !snapshot ? "Opening your library…" : latest ? snapshot?.statuses.get(latest.id)?.label ?? "Saved in this browser" : "Bring a PGN or a position into your personal library."}</p><Link className="text-button" href={href}>{latest ? "Continue" : "Bring a game in"} →</Link></section>
      <section><p className="page-kicker">Practice</p><h2>Make understanding a habit.</h2><p>Revisit decisions from your own games, one position at a time.</p><Link className="text-button" href="/training">Visit Practice →</Link></section>
    </div>
    <HomeContinue records={snapshot?.records.slice(0,6) ?? []} games={snapshot?.games.slice(0,8) ?? []} statuses={snapshot?.statuses} loading={loading && !snapshot} onOpened={refresh} />
    <details className="home-position-tools"><summary>Explore a position <span>Open a board without importing a game</span></summary><PositionDesk /></details>
    <p className="home-footer"><Link href="/import">Import or connect an account →</Link><Link href="/help">Help and data privacy →</Link></p>
  </main>;
}

function PositionDesk() {
  const pieces = useBoardPieces();
  const router = useRouter();
  const [played, setPlayed] = useState<{ fen: string; san: string }[]>([]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fen = played.at(-1)?.fen ?? STARTING_FEN;
  async function openPosition() {
    if (opening) return;
    setOpening(true); setError(null);
    try {
      const record = await saveReviewRecord(await buildReviewRecord("fen",fen), { restoreDeleted:true });
      router.push(`/review/${record.id}/engine`);
    } catch { setError("Could not open this position. Please try again."); setOpening(false); }
  }
  return <div className="position-desk">
    <div className="position-desk-board"><Chessboard options={{ ...WINDOWLIGHT_BOARD_APPEARANCE, position:fen, pieces, allowDragging:!opening, allowDrawingArrows:false, showNotation:true, onPieceDrop:({sourceSquare,targetSquare})=> {
      if (!targetSquare || opening) return false;
      try { const move=playLegalBoardMove(fen,{from:sourceSquare,to:targetSquare}); setPlayed(current=>[...current,{fen:move.fenAfter,san:move.san}]); return true; } catch { return false; }
    } }} /></div>
    <section><p className="page-kicker">Position desk</p><h2>Follow your curiosity.</h2><p>Move pieces to reach a position, then open it in Engine Lab.</p><p>{played.length ? `After ${played.at(-1)?.san}` : "Starting position · no engine running"}</p><div className="position-actions"><button type="button" className="secondary" disabled={!played.length || opening} aria-label="Undo" onClick={()=>setPlayed(current=>current.slice(0,-1))}><Icon name="undo" /> Undo</button><button type="button" className="secondary" disabled={!played.length || opening} onClick={()=>setPlayed([])}><Icon name="reset" /> Reset</button></div><button type="button" className="primary" disabled={opening} onClick={()=>void openPosition()}>{opening ? "Opening…" : "Open in Engine Lab →"}</button>{error && <p role="alert" className="error">{error}</p>}</section>
  </div>;
}

function HomeContinue({
  records,
  games,
  statuses,
  loading,
  onOpened,
}: {
  records: ReviewRecord[];
  games: SyncedGame[];
  statuses: LibrarySnapshot["statuses"] | undefined;
  loading?: boolean;
  onOpened: () => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compactMobile, setCompactMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 560px)");
    const sync = () => setCompactMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const reviewedKeys = new Set(
    records.flatMap((record) => (record.external ? [externalGameKey(record.external)] : [])),
  );
  const pendingGames = games.filter((game) => !reviewedKeys.has(externalGameKey(game.external)));

  type Row =
    | { kind: "review"; record: ReviewRecord; at: string }
    | { kind: "synced"; game: SyncedGame; at: string };
  const rows: Row[] = [
    ...records.map((record) => ({ kind: "review" as const, record, at: record.updatedAt })),
    ...pendingGames.map((game) => ({ kind: "synced" as const, game, at: game.playedAt })),
  ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 5);

  const limit = compactMobile && !expanded ? 3 : 5;
  const visible = rows.slice(0, limit);
  const canExpand = compactMobile && rows.length > 3;

  async function openGame(game: SyncedGame) {
    if (busyId) return;
    setBusyId(game.id);
    setError(null);
    try {
      const id = await openSyncedGameRecord(game);
      onOpened();
      router.push(`/review/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open synced game.");
      setBusyId(null);
    }
  }

  return (
    <section className="home-continue">

      <div className="panel-heading">
        <h2>Recent games</h2>
        {records.length > 0 || games.length > 0 ? <Link className="text-button" href="/history">View all →</Link> : null}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading saved games…</p> : rows.length === 0 ? (
        <div className="recent-empty">Imported and synced games will wait here.</div>
      ) : (
        <>
          <div className="continue-grid">
            {visible.map((row) => row.kind === "review" ? (
              <Link
                href={row.record.kind === "pgn" ? `/review/${row.record.id}` : `/review/${row.record.id}/engine`}
                key={row.record.id}
              >
                <strong>{row.record.title}</strong>
                <small>{row.record.subtitle}</small>
                <em>{statuses?.get(row.record.id)?.label ?? "Reviewed"}</em>
              </Link>
            ) : (
              <button type="button" key={row.game.id} disabled={busyId !== null} onClick={() => void openGame(row.game)}>
                <strong>{row.game.white.username} vs {row.game.black.username}</strong>
                <small>{row.game.timeClass ?? "game"} · {new Date(row.game.playedAt).toLocaleDateString()}</small>
                <em>{busyId === row.game.id ? "Preparing…" : "Synced · not reviewed"}</em>
              </button>
            ))}
          </div>
          {canExpand ? (
            <button
              type="button"
              className="text-button home-continue-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Show fewer" : `Show ${rows.length - 3} more`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
