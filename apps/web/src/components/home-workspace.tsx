"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "./app-header";
import { ConnectedAccounts } from "./connected-accounts";
import {
  buildReviewRecord,
  listReviewRecords,
  saveReviewRecord,
  type ReviewRecord,
  type ReviewRecordKind,
  buildReviewRecordFromSyncedGame,
} from "../lib/review-library";
import { listSyncedGames, markSyncedGameAnalyzed } from "../lib/platform-library";
import type { SyncedGame } from "@chess-review/shared";
import { loadAppSettings } from "../lib/app-settings";
import { autoAnalyzeSyncedGames } from "../lib/auto-analysis";
import { BlueBishopMark } from "@chess-review/ui";

const SAMPLE_PGN = `[Event "Open Review Sample"]
[White "Ada"]
[Black "Mikhail"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5
7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 *`;

export function HomeWorkspace() {
  const router = useRouter();
  const [kind, setKind] = useState<ReviewRecordKind>("pgn");
  const [input, setInput] = useState("");
  const [recent, setRecent] = useState<ReviewRecord[]>([]);
  const [syncedGames, setSyncedGames] = useState<SyncedGame[]>([]);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  function refreshLibrary() {
    void listReviewRecords().then((records) => setRecent(records.slice(0, 3))).catch(() => undefined);
    void listSyncedGames().then((games) => setSyncedGames(games.slice(0, 6))).catch(() => undefined);
  }

  useEffect(() => { refreshLibrary(); }, []);

  async function openReview(value = input) {
    if (status === "saving") return;
    setStatus("saving");
    setError(null);
    try {
      const record = await saveReviewRecord(await buildReviewRecord(kind, value));
      if (record.kind === "pgn") window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to import this chess record.");
      setStatus("idle");
    }
  }

  function loadExample() {
    setKind("pgn");
    setInput(SAMPLE_PGN);
    setError(null);
  }

  async function openSyncedGame(game: SyncedGame) {
    setStatus("saving");
    setError(null);
    try {
      const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game));
      await markSyncedGameAnalyzed(game.id, record.id);
      window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(`/review/${record.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to open synced game.");
      setStatus("idle");
    }
  }

  async function applySyncAnalysisPolicy(games: SyncedGame[]) {
    const settings = loadAppSettings();
    const selected = games.slice(0, settings.autoAnalyzeImported);
    if (selected.length > 0) await autoAnalyzeSyncedGames(selected, { depth: settings.reviewDepth, multiPv: settings.reviewMultiPv });
    refreshLibrary();
  }

  return (
    <main className="page-scroll home-page">
      <AppHeader />
      <section className="home-hero">
        <div className="home-copy">
          <div className="home-chess-identity" aria-hidden="true">
            <BlueBishopMark size={78} decorative />
            <span><b>Position by position</b><small>Stockfish · Maia · grounded Coach</small></span>
          </div>
          <span className="kicker">Open Chess Review</span>
          <h1>Review a chess game.<br /><em>See what mattered.</em></h1>
          <p>Import a PGN or position, explore the board, compare objective and human choices, and turn critical moves into lessons.</p>
        </div>

        <form
          className="import-card"
          aria-labelledby="import-title"
          onSubmit={(event) => {
            event.preventDefault();
            void openReview();
          }}
        >
          <div className="import-heading"><span className="kicker">New review</span><h2 id="import-title">Bring in a game</h2></div>
          <div className="source-tabs" role="group" aria-label="Import source">
            <button type="button" aria-pressed={kind === "pgn"} className={kind === "pgn" ? "active" : ""} onClick={() => setKind("pgn")}>PGN</button>
            <button type="button" aria-pressed={kind === "fen"} className={kind === "fen" ? "active" : ""} onClick={() => setKind("fen")}>FEN</button>
            <Link href="/settings#chesscom-link" aria-label="Connect Chess.com in Settings">Chess.com</Link>
            <Link href="/settings#lichess-link" aria-label="Connect Lichess in Settings">Lichess</Link>
          </div>
          <label className="import-field">
            <span>{kind === "pgn" ? "Paste a complete PGN" : "Paste an explicit FEN"}</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={kind === "pgn" ? "[Event \"My game\"]\n\n1. e4 e5 2. Nf3 …" : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
              spellCheck={false}
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="primary import-submit" disabled={status === "saving" || input.trim() === ""}>
            {status === "saving" ? "Preparing review…" : kind === "pgn" ? "Analyze game →" : "Open Engine Lab →"}
          </button>
          <button type="button" className="text-action" onClick={loadExample}>Load example game</button>
          <small className="import-note">Game and analysis records stay in this browser unless you explicitly choose a cloud coach provider.</small>
        </form>
      </section>

      <ConnectedAccounts compact onGamesUpdated={applySyncAnalysisPolicy} />

      {syncedGames.length > 0 && <section className="synced-games-section">
        <div><span className="kicker">From your accounts</span><h2>Recent games</h2><p>Syncing does not spend engine time. Choose a game when you are ready.</p></div>
        <div className="synced-game-grid">{syncedGames.map((game) => <article key={game.id}>
          <span className={`platform-label ${game.external.provider}`}>{game.external.provider === "chesscom" ? "Chess.com" : "Lichess"}</span>
          <strong>{game.white.username} <i>vs</i> {game.black.username}</strong>
          <small>{game.timeClass ?? "game"} · {new Date(game.playedAt).toLocaleDateString()}</small>
          {game.analyzed && game.analysisId ? <Link href={`/review/${game.analysisId}`}>Open review →</Link> : <button className="text-button" disabled={status === "saving"} onClick={() => void openSyncedGame(game)}>Analyze this game →</button>}
        </article>)}</div>
      </section>}

      <section className="recent-section">
        <div><span className="kicker">Continue learning</span><h2>Recent reviews</h2></div>
        {recent.length === 0 ? (
          <div className="recent-empty">Your imported games will appear here.</div>
        ) : (
          <div className="recent-grid">
            {recent.map((record) => (
              <Link href={record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`} key={record.id}>
                <span>{record.kind.toUpperCase()}</span><strong>{record.title}</strong><small>{record.subtitle}</small><em>Open →</em>
              </Link>
            ))}
          </div>
        )}
        {recent.length > 0 && <Link className="view-history" href="/history">View all history →</Link>}
      </section>
    </main>
  );
}
