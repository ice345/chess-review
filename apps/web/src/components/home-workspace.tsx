"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import { playLegalBoardMove } from "@chess-review/chess-core";
import type { PlatformAccount, SyncedGame } from "@chess-review/shared";
import { WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { useBoardPieces } from "../hooks/use-board-pieces";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import type { LibrarySnapshot } from "../lib/library-snapshot";
import { listPlatformAccounts } from "../lib/platform-library";
import { buildReviewRecord, saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { externalGameKey } from "../lib/review-status";
import { ImportForm, STARTING_FEN, openSyncedGameRecord, type ImportPreview } from "./import-desk";


interface PlayedMove {
  fen: string;
  san: string;
}

function boardMeta(played: readonly PlayedMove[]): string {
  if (played.length === 0) return "BOARD";
  const last = played[played.length - 1]!;
  const moveNumber = Math.ceil(played.length / 2);
  return `BOARD ${moveNumber}${played.length % 2 === 0 ? "…" : ""} ${last.san}`;
}

function playedLine(played: readonly PlayedMove[]): string {
  return played.map((move, index) => (
    index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ${move.san}` : move.san
  )).join(" ");
}

export function HomeWorkspace() {
  const pieces = useBoardPieces();
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview>({ fen: STARTING_FEN, previewable: false, kind: "pgn", hasInput: false });
  const [played, setPlayed] = useState<PlayedMove[]>([]);
  const [opening, setOpening] = useState(false);
  const { snapshot, error: libraryError, loading: libraryLoading, refresh: refreshLibrary } = useLibrarySnapshot();
  const recent = snapshot?.records.slice(0, 6) ?? [];
  const syncedGames = snapshot?.games.slice(0, 8) ?? [];
  const interactive = !preview.hasInput;
  const fen = preview.hasInput ? preview.fen : (played.at(-1)?.fen ?? STARTING_FEN);

  async function openPosition() {
    if (opening) return;
    setOpening(true);
    try {
      const record = await saveReviewRecord(await buildReviewRecord("fen", fen), { restoreDeleted: true });
      router.push(`/review/${record.id}/engine`);
    } catch {
      setOpening(false);
    }
  }

  return (
    <main className="page-scroll home-page">
      <div className="home-scene">
        <section className="page-head head-threshold">
          <p className="page-kicker">Open Chess Review</p>
          <h1 className="page-display">A quieter desk for your games.</h1>
          <p className="page-lede">
            Play, paste or open a game and the desk reads it once: what mattered, what you could have
            tried, and what to practise next. Everything stays on this machine.
          </p>
          <p className="page-steps">
            <span>Import</span><span>Key moment</span><span>Practice</span><span>Evidence</span><span>Keep</span>
          </p>
        </section>

        {/* Aside first in the document so a phone reads the form before the board;
            the desktop grid puts the board back on the left. */}
        <div className="home-aside">
          <ImportForm surface="instrument" onPreview={setPreview} />
          {libraryError && <p className="error" role="alert">{libraryError} <button type="button" className="text-button" disabled={libraryLoading} onClick={() => void refreshLibrary()}>Retry loading games</button></p>}
          <HomeAccounts games={snapshot?.games ?? []} />
          <HomeContinue
            records={recent}
            games={syncedGames}
            statuses={snapshot?.statuses}
            loading={libraryLoading && !snapshot}
            onOpened={refreshLibrary}
          />
        </div>

        <figure className="home-board paper-panel">
          <div className="board-card-head">
            <span className="board-card-pip" aria-hidden="true" />
            <div>
              <h2>{preview.hasInput ? (preview.kind === "fen" ? "This position" : "PGN preview") : "Start from a position"}</h2>
              <p>{
                preview.hasInput
                  ? (preview.previewable
                    ? (preview.kind === "fen" ? "Pasted FEN." : "Opening position of the pasted game.")
                    : "Could not preview this input.")
                  : played.length > 0
                    ? `Position after ${playedLine(played)}.`
                    : "Drag a piece to make a move, or paste a PGN on the right."
              }</p>
            </div>
            <span className="board-card-meta">{boardMeta(interactive ? played : [])}</span>
          </div>
          <div className="home-board-frame" {...(interactive ? { "aria-label": "Start from a position" } : { "aria-hidden": true })}>
            <Chessboard options={{
              ...WINDOWLIGHT_BOARD_APPEARANCE,
              position: fen,
              pieces,
              allowDragging: interactive,
              canDragPiece: () => interactive,
              allowDrawingArrows: false,
              boardOrientation: "white",
              showNotation: true,
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (!interactive || !targetSquare) return false;
                try {
                  const move = playLegalBoardMove(fen, { from: sourceSquare, to: targetSquare });
                  setPlayed((current) => [...current, { fen: move.fenAfter, san: move.san }]);
                  return true;
                } catch {
                  return false;
                }
              },
            }} />

          </div>
          <div className="board-card-dock">
            <div className="home-board-transport">
              <button type="button" disabled={played.length === 0 || !interactive} onClick={() => setPlayed([])}>Reset</button>
              <button type="button" disabled={played.length === 0 || !interactive} onClick={() => setPlayed((current) => current.slice(0, -1))}>Undo</button>
            </div>
            {played.length > 0 && interactive ? (
              <button type="button" className="text-button home-open-lab" disabled={opening} onClick={() => void openPosition()}>
                {opening ? "Opening…" : "Open in Engine Lab →"}
              </button>
            ) : null}
            <figcaption className="board-card-foot">{
              !preview.hasInput
                ? played.length === 0
                  ? "Starting position · plain board, no engine running"
                  : `Position · after ${playedLine(played)}`
                : !preview.previewable
                  ? "Could not preview this input"
                  : preview.kind === "fen" ? "This position · plain board, no engine running" : "Opening position of the pasted game · plain board, no engine running"
            }</figcaption>
          </div>
        </figure>

        <p className="product-help-link"><Link href="/help">Help, capabilities and data privacy →</Link></p>
      </div>
    </main>
  );
}

function HomeAccounts({ games }: { games: readonly SyncedGame[] }) {
  const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
  useEffect(() => {
    void listPlatformAccounts().then(setAccounts);
  }, []);

  const chesscom = accounts?.find((account) => account.provider === "chesscom");
  const lichess = accounts?.find((account) => account.provider === "lichess");
  const chesscomCount = games.filter((game) => game.external.provider === "chesscom").length;
  const lichessCount = games.filter((game) => game.external.provider === "lichess").length;

  return (
    <section className="home-accounts instrument-panel">
      <div className="panel-heading">
        <h2>Connected accounts</h2>
        <Link className="text-button" href="/settings#connected-accounts">Manage</Link>
      </div>
      <ul className="home-account-rows">
        <li>
          <span>Chess.com</span>
          <strong>{chesscom ? chesscom.username : "Not connected"}</strong>
          <em>{chesscom ? `${chesscomCount} ${chesscomCount === 1 ? "game" : "games"}` : ""}</em>
        </li>
        <li>
          <span>Lichess</span>
          <strong>{lichess ? lichess.username : "Not connected"}</strong>
          <em>{lichess ? `${lichessCount} ${lichessCount === 1 ? "game" : "games"}` : ""}</em>
        </li>
      </ul>
    </section>
  );
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
    <section className="home-continue instrument-panel">
      <div className="panel-heading">
        <h2>Continue</h2>
        {records.length > 0 ? <Link className="text-button" href="/history">View all →</Link> : null}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading saved games…</p> : rows.length === 0 ? (
        <div className="recent-empty">Imported and synced games will wait here.</div>
      ) : (
        <div className="continue-grid">
          {rows.map((row) => row.kind === "review" ? (
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
      )}
    </section>
  );
}
