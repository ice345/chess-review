"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExternalPlatform, SyncedGame } from "@chess-review/shared";
import { AppHeader } from "./app-header";
import { listSyncedGames } from "../lib/platform-library";
import { buildReviewRecordFromSyncedGame, listReviewRecords, saveReviewRecord, type ReviewRecord } from "../lib/review-library";

type ProviderFilter = "all" | "manual" | ExternalPlatform;
type AnalysisFilter = "all" | "reviewed" | "not-reviewed";
const LIBRARY_PAGE_SIZE = 60;

function syncedGameExternalKey(external: NonNullable<SyncedGame["external"]>): string {
  return `${external.provider}:${external.accountId}:${external.externalGameId}`;
}

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
  const [visibleCount, setVisibleCount] = useState(LIBRARY_PAGE_SIZE);
  const preparing = useRef<string | null>(null);

  useEffect(() => {
    void Promise.all([listReviewRecords(), listSyncedGames()]).then(([nextRecords, nextGames]) => {
      setRecords(nextRecords);
      setGames(nextGames);
    }).catch(() => { setRecords([]); setGames([]); });
  }, []);

  const timeClasses = useMemo(() => [...new Set((games ?? []).map((game) => game.timeClass).filter((value): value is string => Boolean(value)))].sort(), [games]);
  const syncedByExternalKey = new Map((games ?? []).map((game) => [syncedGameExternalKey(game.external), game]));
  const reviewedRecords = (records ?? []).filter((record) => {
    const recordProvider: ProviderFilter = record.external?.provider ?? "manual";
    const linkedGame = record.external ? syncedByExternalKey.get(syncedGameExternalKey(record.external)) : undefined;
    return (record.external === undefined || linkedGame === undefined || linkedGame.analyzed === true)
      && (provider === "all" || provider === recordProvider)
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
  const libraryEntries = [
    ...pendingGames.map((game) => ({ kind: "pending" as const, date: game.playedAt, game })),
    ...reviewedRecords.map((record) => ({ kind: "review" as const, date: record.updatedAt, record })),
  ].sort((left, right) => right.date.localeCompare(left.date));
  const visibleEntries = libraryEntries.slice(0, visibleCount);
  const reviewedCount = (records ?? []).filter((record) => {
    if (!record.external) return true;
    return syncedByExternalKey.get(syncedGameExternalKey(record.external))?.analyzed === true;
  }).length;
  const pendingCount = (games ?? []).filter((game) => !game.analyzed).length;
  const chesscomCount = (games ?? []).filter((game) => game.external.provider === "chesscom").length;
  const lichessCount = (games ?? []).filter((game) => game.external.provider === "lichess").length;

  useEffect(() => setVisibleCount(LIBRARY_PAGE_SIZE), [analysisState, provider, query, result, timeClass]);

  async function review(game: SyncedGame) {
    if (preparing.current) return;
    preparing.current = game.id;
    setWorking(game.id);
    try {
      const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game));
      window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(`/review/${record.id}`);
    } finally {
      preparing.current = null;
      setWorking(null);
    }
  }

  const loading = records === null || games === null;
  const empty = !loading && libraryEntries.length === 0;

  return (
    <main className="page-scroll utility-page">
      <AppHeader />
      <section className="utility-heading"><h1>Games and reviews</h1></section>
      <section className="history-summary" aria-label="History summary">
        <article className="wash-card"><span>All games</span><strong>{games?.length ?? 0}</strong></article>
        <article className="wash-card" data-wash="sage"><span>Reviewed</span><strong>{reviewedCount}</strong></article>
        <article className="wash-card" data-wash="pink"><span>Pending</span><strong>{pendingCount}</strong></article>
        <article className="wash-card" data-wash="cream"><span>Sources</span><strong>{chesscomCount + lichessCount > 0 ? `${chesscomCount} Chess.com · ${lichessCount} Lichess` : "Manual"}</strong></article>
      </section>
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
          {visibleEntries.map((entry) => entry.kind === "pending" ? <article className="history-game ink-row pending" key={entry.game.id}>
            <span className="record-kind">{entry.game.external.provider === "chesscom" ? "CHESS.COM" : "LICHESS"}</span>
            <span><strong>{entry.game.white.username} vs {entry.game.black.username}</strong><small>{entry.game.timeClass ?? "game"} · waiting for review</small></span>
            <time>{new Date(entry.game.playedAt).toLocaleDateString()}</time>
            <button type="button" className="text-button" disabled={working !== null} onClick={() => void review(entry.game)}>{working === entry.game.id ? "Preparing…" : "Analyze →"}</button>
          </article> : <Link className="ink-row" href={entry.record.kind === "pgn" ? `/review/${entry.record.id}` : `/review/${entry.record.id}/engine`} key={entry.record.id}>
            <span className="record-kind">{entry.record.external?.provider === "chesscom" ? "CHESS.COM" : entry.record.external?.provider === "lichess" ? "LICHESS" : entry.record.kind.toUpperCase()}</span>
            <span><strong>{entry.record.title}</strong><small>{entry.record.subtitle}</small></span>
            <time>{new Date(entry.record.updatedAt).toLocaleDateString()}</time>
            <em>Open →</em>
          </Link>)}
          {visibleCount < libraryEntries.length && <button type="button" className="secondary library-load-more" onClick={() => setVisibleCount((count) => count + LIBRARY_PAGE_SIZE)}>Load {Math.min(LIBRARY_PAGE_SIZE, libraryEntries.length - visibleCount)} more · {visibleCount} of {libraryEntries.length}</button>}
        </>}
      </section>
    </main>
  );
}
