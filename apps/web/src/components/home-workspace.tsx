"use client";

import Link from "next/link";
import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { useBoardPieces } from "../hooks/use-board-pieces";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { applySyncedAnalysisPolicy } from "../lib/auto-analysis";
import type { PlatformSyncMode } from "../lib/platform-sync";
import type { SyncedGame } from "@chess-review/shared";
import { ConnectedAccounts } from "./connected-accounts";
import { ImportForm, STARTING_FEN, type ImportPreview } from "./import-desk";
import { RecentReviewsPanel } from "./recent-reviews";
import { SyncedGamesPanel } from "./synced-games-panel";

export function HomeWorkspace() {
  const pieces = useBoardPieces();
  const [preview, setPreview] = useState<ImportPreview>({ fen: STARTING_FEN, previewable: false, kind: "pgn", hasInput: false });
  const { snapshot, error: libraryError, loading: libraryLoading, refresh: refreshLibrary } = useLibrarySnapshot();
  const recent = snapshot?.records.slice(0, 3) ?? [];
  const syncedGames = snapshot?.games.slice(0, 6) ?? [];

  async function applySyncAnalysisPolicy(games: SyncedGame[], mode: PlatformSyncMode, complete?: boolean) {
    await applySyncedAnalysisPolicy(games, mode, complete);
    refreshLibrary();
  }

  return (
    <main className="page-scroll home-page">
      <section className="page-head">
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

      {/* The aside comes first in the document so a phone reads the form before the
          board preview; the desktop grid puts the board back on the left. */}
      <section className="home-stage">
        <div className="home-aside">
          <ImportForm latestReview={recent[0]} onPreview={setPreview} />

          {libraryError && <p className="error" role="alert">{libraryError} <button type="button" className="text-button" disabled={libraryLoading} onClick={() => void refreshLibrary()}>Retry loading games</button></p>}
          <ConnectedAccounts compact onGamesUpdated={applySyncAnalysisPolicy} />
          <SyncedGamesPanel games={syncedGames} records={snapshot?.records ?? []} statuses={snapshot?.statuses} onOpened={refreshLibrary} />
          <RecentReviewsPanel records={recent} statuses={snapshot?.statuses} limit={6} viewAllHref="/history" loading={libraryLoading && !snapshot} />
        </div>

        <figure className="home-board paper-panel">
          <div className="board-card-head">
            <span className="board-card-pip" aria-hidden="true" />
            <div>
              <h2>Start from a position</h2>
              <p>Paste a PGN on the right and the board previews it.</p>
            </div>
          </div>
          <div className="home-board-frame" aria-hidden="true" inert>
            <Chessboard options={{
              position: preview.fen,
              pieces,
              allowDragging: false,
              canDragPiece: () => false,
              allowDrawingArrows: false,
              boardOrientation: "white",
              ...WINDOWLIGHT_BOARD_APPEARANCE,
            }} />
          </div>
          <figcaption className="board-card-foot">{
            !preview.hasInput
              ? "Starting position · plain board, no engine running"
              : !preview.previewable
                ? "Could not preview this input"
                : preview.kind === "fen" ? "This position · plain board, no engine running" : "Opening position of the pasted game · plain board, no engine running"
          }</figcaption>
        </figure>
      </section>

      <p className="product-help-link"><Link href="/help">Help, capabilities and data privacy →</Link></p>
      </main>
  );
}
