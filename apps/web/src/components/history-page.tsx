"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExternalPlatform, SyncedGame } from "@chess-review/shared";
import { deleteReviewRecord } from "../lib/local-data";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { buildReviewRecordFromSyncedGame, saveReviewRecord, type ReviewRecord } from "../lib/review-library";

type ProviderFilter = "all" | "manual" | ExternalPlatform;
type AnalysisFilter = "all" | "reviewed" | "not-reviewed";
type LibraryEntry =
  | { kind: "pending"; date: string; game: SyncedGame }
  | { kind: "review"; date: string; record: ReviewRecord };
const LIBRARY_PAGE_SIZE = 60;

function syncedGameExternalKey(external: NonNullable<SyncedGame["external"]>): string {
  return `${external.provider}:${external.accountId}:${external.externalGameId}`;
}

function entryProvider(entry: LibraryEntry): ProviderFilter {
  if (entry.kind === "pending") return entry.game.external.provider;
  return entry.record.external?.provider ?? "manual";
}

function historyFilterLabel(
  provider: ProviderFilter,
  analysisState: AnalysisFilter,
  timeClass: string,
  result: string,
  query: string,
  gameCount: number,
): string {
  const source = provider === "all" ? "All sources" : provider === "manual" ? "Manual import" : provider === "chesscom" ? "Chess.com" : "Lichess";
  const status = analysisState === "all" ? "All" : analysisState === "reviewed" ? "Analyzed" : "Not analyzed";
  const time = timeClass === "all" ? "All time controls" : timeClass;
  const outcome = result === "all" ? "All results" : result === "win" ? "Win" : result === "loss" ? "Loss" : "Draw";
  const search = query.trim() ? " · Search" : "";
  return `${source} · ${status} · ${time} · ${outcome}${search} · ${gameCount} games`;
}

export function HistoryPage() {
  const router = useRouter();
  const { snapshot, error: libraryError, loading: refreshing, indexing, refresh } = useLibrarySnapshot();
  const records = snapshot?.records ?? null;
  const games = snapshot?.games ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [analysisState, setAnalysisState] = useState<AnalysisFilter>("all");
  const [timeClass, setTimeClass] = useState("all");
  const [result, setResult] = useState("all");
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(LIBRARY_PAGE_SIZE);
  const [filterOpen, setFilterOpen] = useState(false);
  const preparing = useRef<string | null>(null);

  const timeClasses = useMemo(() => [...new Set((games ?? []).map((game) => game.timeClass).filter((value): value is string => Boolean(value)))].sort(), [games]);
  const recordsBySource = new Map((records ?? []).flatMap((record) => record.external ? [[syncedGameExternalKey(record.external), record] as const] : []));
  const reviewedRecords = (records ?? []).filter((record) => {
    const recordProvider: ProviderFilter = record.external?.provider ?? "manual";
    const analyzed = snapshot?.statuses.get(record.id)?.analyzed === true;
    return (analysisState === "all" || (analysisState === "reviewed" ? analyzed : !analyzed && record.kind === "pgn"))
      && (provider === "all" || provider === recordProvider)
      && (timeClass === "all" || record.sourceTimeClass === timeClass)
      && (result === "all" || record.sourceResult === result)
      && `${record.title} ${record.subtitle}`.toLowerCase().includes(query.toLowerCase());
  });
  const pendingGames = (games ?? []).filter((game) => !recordsBySource.has(syncedGameExternalKey(game.external))).filter((game) => {
    return (provider === "all" || provider === game.external.provider)
      && analysisState !== "reviewed"
      && (timeClass === "all" || game.timeClass === timeClass)
      && (result === "all" || game[game.accountColor].result === result)
      && `${game.white.username} ${game.black.username}`.toLowerCase().includes(query.toLowerCase());
  });
  const libraryEntries: LibraryEntry[] = [
    ...pendingGames.map((game) => ({ kind: "pending" as const, date: game.playedAt, game })),
    ...reviewedRecords.map((record) => ({ kind: "review" as const, date: record.updatedAt, record })),
  ].sort((left, right) => right.date.localeCompare(left.date));
  const visibleEntries = libraryEntries.slice(0, visibleCount);
  const listedAnalyzed = libraryEntries.filter((entry) => entry.kind === "review" && snapshot?.statuses.get(entry.record.id)?.analyzed).length;
  const listedPending = libraryEntries.filter((entry) => entry.kind === "pending" || entry.record.kind === "pgn" && !snapshot?.statuses.get(entry.record.id)?.analyzed).length;
  const manualCount = libraryEntries.filter((entry) => entryProvider(entry) === "manual").length;
  const chesscomCount = libraryEntries.filter((entry) => entryProvider(entry) === "chesscom").length;
  const lichessCount = libraryEntries.filter((entry) => entryProvider(entry) === "lichess").length;
  const sourceLabel = [
    manualCount > 0 ? `${manualCount} Manual` : null,
    chesscomCount > 0 ? `${chesscomCount} Chess.com` : null,
    lichessCount > 0 ? `${lichessCount} Lichess` : null,
  ].filter((value): value is string => value !== null).join(" · ") || "—";

  useEffect(() => setVisibleCount(LIBRARY_PAGE_SIZE), [analysisState, provider, query, result, timeClass]);

  async function review(game: SyncedGame) {
    if (preparing.current) return;
    preparing.current = game.id;
    setWorking(game.id);
    setActionError(null);
    try {
      const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game), { restoreDeleted: true });
      window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(`/review/${record.id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to open this game. Try again.");
    } finally {
      preparing.current = null;
      setWorking(null);
    }
  }

  const loading = refreshing && !snapshot;
  const empty = !loading && !libraryError && libraryEntries.length === 0;

  return (
    <main className="page-scroll utility-page">
      <section className="page-head head-instrument">

        <p className="page-kicker">Open Chess Review</p>
        <h1 className="page-display">Games and reviews</h1>
        <p className="page-lede">Everything you have imported, and the reviews built from it. Filter it down, open one, or remove something you no longer need.</p>
      </section>
      {(libraryError || actionError) && <p className="error" role="alert">{actionError ?? libraryError} <button type="button" className="text-button" disabled={refreshing} onClick={() => { setActionError(null); void refresh(); }}>Retry loading games</button></p>}
      {/* The panel holds the summary, the filters and the rows: one surface, the
          way the reference groups a list, instead of loose rows on the room. */}
      <section className="history-list paper-panel">
        {snapshot && <p className="history-summary study-ink-stats" aria-label="History summary">
          <span><strong>{libraryEntries.length}</strong> All records</span>
          <span><strong>{listedAnalyzed}</strong> Analyzed</span>
          <span><strong>{listedPending}</strong> Pending</span>
          <span><strong>{sourceLabel}</strong> Sources</span>
        </p>}
        <details className="study-scope history-scope" open={filterOpen} onToggle={(event) => setFilterOpen(event.currentTarget.open)}>
          <summary>
            <span>Filter</span>
            <strong>{historyFilterLabel(provider, analysisState, timeClass, result, query, libraryEntries.length)}</strong>
            <span className="study-scope-change">{filterOpen ? "Hide filters" : "Change filters"}</span>
          </summary>
          <div className="history-filters" aria-label="History filters">
            <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Player or event" /></label>
            <label><span>Source</span><select value={provider} onChange={(event) => setProvider(event.target.value as ProviderFilter)}><option value="all">All sources</option><option value="manual">Manual import</option><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select></label>
            <label><span>Status</span><select value={analysisState} onChange={(event) => setAnalysisState(event.target.value as AnalysisFilter)}><option value="all">All</option><option value="reviewed">Analyzed</option><option value="not-reviewed">Not analyzed</option></select></label>
            <label><span>Time control</span><select value={timeClass} onChange={(event) => setTimeClass(event.target.value)}><option value="all">All</option>{timeClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Result</span><select value={result} onChange={(event) => setResult(event.target.value)}><option value="all">All results</option><option value="win">Win</option><option value="loss">Loss</option><option value="draw">Draw</option></select></label>
          </div>
        </details>
        {loading ? <p className="utility-empty" role="status">{indexing ? `Preparing saved games… ${indexing.completed} / ${indexing.total}. This one-time update keeps future visits fast.` : "Loading history…"}</p> : empty ? (
          <div className="utility-empty"><strong>{snapshot?.records.length || snapshot?.games.length ? "No matching games" : "No saved games yet"}</strong><span>{snapshot?.records.length || snapshot?.games.length ? "Change the filters to see other games." : "Import a PGN or connect an account to get started."}</span><Link href="/">Return home →</Link></div>
        ) : <>
          {visibleEntries.map((entry) => entry.kind === "pending" ? <article className="history-game ink-row pending" key={entry.game.id}>
            <span className="record-kind">{entry.game.external.provider === "chesscom" ? "CHESS.COM" : "LICHESS"}</span>
            <span><strong>{entry.game.white.username} vs {entry.game.black.username}</strong><small>{entry.game.timeClass ?? "game"} · waiting for review</small></span>
            <time>{new Date(entry.game.playedAt).toLocaleDateString()}</time>
            <button type="button" className="text-button" disabled={working !== null} onClick={() => void review(entry.game)}>{working === entry.game.id ? "Preparing…" : "Analyze →"}</button>
          </article> : <article className="ink-row" key={entry.record.id}>
            <span className="record-kind">{entry.record.external?.provider === "chesscom" ? "CHESS.COM" : entry.record.external?.provider === "lichess" ? "LICHESS" : entry.record.kind.toUpperCase()}</span>
            <span><strong>{entry.record.title}</strong><small>{entry.record.subtitle} · {snapshot?.statuses.get(entry.record.id)?.label}</small></span>
            <time>{new Date(entry.record.updatedAt).toLocaleDateString()}</time>
            <Link href={entry.record.kind === "pgn" ? `/review/${entry.record.id}` : `/review/${entry.record.id}/engine`}>Open →</Link>
            <button type="button" className="text-button danger" disabled={working !== null} onClick={() => {
              if (!window.confirm("Delete this review and its training references? Imported source games remain available. Background work will pause.")) return;
              setWorking(entry.record.id);
              setActionError(null);
              void deleteReviewRecord(entry.record.id).then(() => window.location.reload()).catch((error) => {
                setActionError(error instanceof Error ? error.message : "Unable to delete this review. Try again.");
                setWorking(null);
              });
            }}>Delete</button>
          </article>)}
          {visibleCount < libraryEntries.length && <button type="button" className="secondary library-load-more" onClick={() => setVisibleCount((count) => count + LIBRARY_PAGE_SIZE)}>Load {Math.min(LIBRARY_PAGE_SIZE, libraryEntries.length - visibleCount)} more · {visibleCount} of {libraryEntries.length}</button>}
        </>}
      </section>
    </main>
  );
}
