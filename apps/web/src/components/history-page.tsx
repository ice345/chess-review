"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ExternalPlatform, SyncedGame } from "@chess-review/shared";
import { AppHeader } from "./app-header";
import { listSyncedGames, markSyncedGameAnalyzed } from "../lib/platform-library";
import { buildReviewRecordFromSyncedGame, listReviewRecords, saveReviewRecord, type ReviewRecord } from "../lib/review-library";

type ProviderFilter = "all" | "manual" | ExternalPlatform;
type AnalysisFilter = "all" | "reviewed" | "not-reviewed";

export function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<ReviewRecord[] | null>(null);
  const [games, setGames] = useState<SyncedGame[] | null>(null);
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [analysisState, setAnalysisState] = useState<AnalysisFilter>("all");
  const [timeClass, setTimeClass] = useState("all");
  const [result, setResult] = useState("all");
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listReviewRecords(), listSyncedGames()]).then(([nextRecords, nextGames]) => {
      setRecords(nextRecords);
      setGames(nextGames);
    }).catch(() => { setRecords([]); setGames([]); });
  }, []);

  const timeClasses = useMemo(() => [...new Set((games ?? []).map((game) => game.timeClass).filter((value): value is string => Boolean(value)))].sort(), [games]);
  const reviewedRecords = (records ?? []).filter((record) => {
    const recordProvider: ProviderFilter = record.external?.provider ?? "manual";
    return (provider === "all" || provider === recordProvider)
      && analysisState !== "not-reviewed"
      && (timeClass === "all" || record.sourceTimeClass === timeClass)
      && (result === "all" || record.sourceResult === result)
      && `${record.title} ${record.subtitle}`.toLowerCase().includes(query.toLowerCase());
  });
  const pendingGames = (games ?? []).filter((game) => !game.analyzed).filter((game) => {
    return (provider === "all" || provider === game.external.provider)
      && analysisState !== "reviewed"
      && (timeClass === "all" || game.timeClass === timeClass)
      && (result === "all" || game[game.accountColor].result === result)
      && `${game.white.username} ${game.black.username}`.toLowerCase().includes(query.toLowerCase());
  });

  async function review(game: SyncedGame) {
    setWorking(game.id);
    try {
      const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game));
      await markSyncedGameAnalyzed(game.id, record.id);
      window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(`/review/${record.id}`);
    } finally {
      setWorking(null);
    }
  }

  const loading = records === null || games === null;
  const empty = !loading && reviewedRecords.length === 0 && pendingGames.length === 0;

  return (
    <main className="page-scroll utility-page">
      <AppHeader />
      <section className="utility-heading"><span className="kicker">Your library</span><h1>Games and reviews</h1><p>Synced games stay lightweight until you choose to analyze them.</p></section>
      <section className="history-filters" aria-label="History filters">
        <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Player or event" /></label>
        <label><span>Source</span><select value={provider} onChange={(event) => setProvider(event.target.value as ProviderFilter)}><option value="all">All sources</option><option value="manual">Manual import</option><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select></label>
        <label><span>Status</span><select value={analysisState} onChange={(event) => setAnalysisState(event.target.value as AnalysisFilter)}><option value="all">All</option><option value="reviewed">Reviewed</option><option value="not-reviewed">Not reviewed</option></select></label>
        <label><span>Time control</span><select value={timeClass} onChange={(event) => setTimeClass(event.target.value)}><option value="all">All</option>{timeClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Result</span><select value={result} onChange={(event) => setResult(event.target.value)}><option value="all">All results</option><option value="win">Win</option><option value="loss">Loss</option><option value="draw">Draw</option></select></label>
      </section>
      <section className="history-list">
        {loading ? <p className="utility-empty">Loading history…</p> : empty ? (
          <div className="utility-empty"><strong>No matching games</strong><span>Change the filters or connect an account.</span><Link href="/">Return home →</Link></div>
        ) : <>
          {pendingGames.map((game) => <article className="history-game pending" key={game.id}>
            <span className="record-kind">{game.external.provider === "chesscom" ? "CHESS.COM" : "LICHESS"}</span>
            <span><strong>{game.white.username} vs {game.black.username}</strong><small>{game.timeClass ?? "game"} · waiting for review</small></span>
            <time>{new Date(game.playedAt).toLocaleDateString()}</time>
            <button className="text-button" disabled={working !== null} onClick={() => void review(game)}>{working === game.id ? "Preparing…" : "Analyze →"}</button>
          </article>)}
          {reviewedRecords.map((record) => <Link href={record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`} key={record.id}>
            <span className="record-kind">{record.external?.provider === "chesscom" ? "CHESS.COM" : record.external?.provider === "lichess" ? "LICHESS" : record.kind.toUpperCase()}</span>
            <span><strong>{record.title}</strong><small>{record.subtitle}</small></span>
            <time>{new Date(record.updatedAt).toLocaleDateString()}</time>
            <em>Open →</em>
          </Link>)}
        </>}
      </section>
    </main>
  );
}
