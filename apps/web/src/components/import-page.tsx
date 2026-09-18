"use client";

import type { SyncedGame } from "@chess-review/shared";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { applySyncedAnalysisPolicy } from "../lib/auto-analysis";
import type { PlatformSyncMode } from "../lib/platform-sync";
import { ConnectedAccounts } from "./connected-accounts";
import { ImportForm } from "./import-desk";
import { SyncedGamesPanel } from "./synced-games-panel";


/**
 * The import desk. The landing page keeps a compact copy of the same form beside
 * the board preview; this route gives the three sources — paste, file, account —
 * the room the reference draws for them, and keeps the account tools out of the
 * landing page's aside.
 */
export function ImportPage() {
  const { snapshot, error, loading, refresh } = useLibrarySnapshot();
  const records = snapshot?.records ?? [];
  const games = snapshot?.games ?? [];

  async function applySyncPolicy(games: SyncedGame[], mode: PlatformSyncMode, complete?: boolean) {
    await applySyncedAnalysisPolicy(games, mode, complete);
    refresh();
  }

  return (
    <main className="page-scroll import-page">
      <section className="page-head head-instrument">

        <p className="page-kicker">Open Chess Review</p>
        <h1 className="page-display">Bring your games in.</h1>
        <p className="page-lede">
          Paste a PGN, open a file, or pull recent games from a connected account. Importing only saves
          the game; analysis starts when you ask for it, on this machine.
        </p>
        <p className="page-steps">
          <span data-step="current">Import</span><span>Key moment</span><span>Practice</span><span>Evidence</span><span>Keep</span>
        </p>
      </section>

      <section className="import-stage">
        <div className="import-stage-main">
          <ImportForm latestReview={records[0]} />
          {error && <p className="error" role="alert">{error} <button type="button" className="text-button" disabled={loading} onClick={() => void refresh()}>Retry loading games</button></p>}
        </div>
        <div className="import-stage-aside">
          <ConnectedAccounts compact onGamesUpdated={applySyncPolicy} />
          <SyncedGamesPanel games={games} records={records} statuses={snapshot?.statuses} limit={5} onOpened={refresh} />
        </div>
      </section>
    </main>
  );
}
