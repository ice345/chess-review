"use client";

import Link from "next/link";
import { PlatformHeading } from "./platform-heading";
import type { SyncedGame } from "@chess-review/shared";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { applySyncedAnalysisPolicy } from "../lib/auto-analysis";
import type { PlatformSyncMode } from "../lib/platform-sync";
import { ConnectedAccounts } from "./connected-accounts";
import { ImportForm } from "./import-desk";
import { SyncedGamesPanel } from "./synced-games-panel";


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
      <PlatformHeading chapter="Import / Begin a review" title="Bring a game to your desk." actions={<Link className="text-button" href="/history">Open library →</Link>}>Paste a game, open a file, or connect a public account.</PlatformHeading>
      <section className="import-workspace">
        <aside className="import-guide"><p className="page-kicker">A place to begin</p><h2>One game.<br />A clearer understanding.</h2><ol><li>Choose your source</li><li>Check the game or position</li><li>Open your workspace</li></ol><p>PGN opens a full game review. FEN opens a position in Engine Lab.</p><Link className="text-button" href="/help">Import help →</Link></aside>
        <div className="import-source-sheet">
          <ImportForm latestReview={records[0]} surface="embedded" accountContent={<><ConnectedAccounts compact onGamesUpdated={applySyncPolicy} /><SyncedGamesPanel games={games} records={records} statuses={snapshot?.statuses} limit={5} onOpened={refresh} /></>} />
          {error && <p className="error" role="alert">{error} <button type="button" className="text-button" disabled={loading} onClick={() => void refresh()}>Retry loading games</button></p>}
        </div>
      </section>
    </main>
  );
}
