"use client";

import Link from "next/link";
import { DeskEmptyState } from "./desk-empty-state";
import { PlatformHeading } from "./platform-heading";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { ExternalPlatform, SyncedGame } from "@chess-review/shared";
import { deleteReviewRecord } from "../lib/local-data";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { providerKindFor } from "../lib/provider-kind";
import { buildReviewRecordFromSyncedGame, saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { SourceChip } from "./source-chip";

type ProviderFilter = "all" | "manual" | ExternalPlatform;
type AnalysisFilter = "all" | "reviewed" | "not-reviewed";
type LibraryEntry =
  | { kind: "pending"; date: string; game: SyncedGame }
  | { kind: "review"; date: string; record: ReviewRecord };
type SideColor = "white" | "black";

const LIBRARY_PAGE_SIZE = 60;
const SOURCE_CHIPS: Array<{ id: ProviderFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "chesscom", label: "Chess.com" },
  { id: "lichess", label: "Lichess" },
  { id: "manual", label: "Manual" },
];
const STATUS_CHIPS: Array<{ id: AnalysisFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "reviewed", label: "Analyzed" },
  { id: "not-reviewed", label: "Waiting" },
];
const RESULT_CHIPS = [
  { id: "all", label: "Any result" },
  { id: "win", label: "Win" },
  { id: "loss", label: "Loss" },
  { id: "draw", label: "Draw" },
] as const;

function monthHeading(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function monthKey(heading: string): string {
  return `month-${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "undated"}`;
}

function monthIndexLabel(heading: string): string {
  const match = heading.match(/^(\w+)\s+(\d{4})$/);
  if (!match) return heading;
  return `${match[1]!.slice(0, 3)} ’${match[2]!.slice(2)}`;
}

/** Concert-programme movement numbers for month groups. */
function romanNumeral(value: number): string {
  const glyphs: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = value;
  let result = "";
  for (const [amount, glyph] of glyphs) {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  }
  return result;
}

function dayParts(iso: string): { key: string; label: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { key: "undated", label: "—" };
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    label: String(date.getDate()),
  };
}

function groupByMonth(entries: LibraryEntry[]): Array<{ heading: string; key: string; entries: LibraryEntry[] }> {
  const groups: Array<{ heading: string; key: string; entries: LibraryEntry[] }> = [];
  for (const entry of entries) {
    const heading = monthHeading(entry.date);
    const last = groups.at(-1);
    if (last?.heading === heading) last.entries.push(entry);
    else groups.push({ heading, key: monthKey(heading), entries: [entry] });
  }
  return groups;
}

function groupByDay(entries: LibraryEntry[]): Array<{ key: string; label: string; entries: LibraryEntry[] }> {
  const groups: Array<{ key: string; label: string; entries: LibraryEntry[] }> = [];
  for (const entry of entries) {
    const day = dayParts(entry.date);
    const last = groups.at(-1);
    if (last?.key === day.key) last.entries.push(entry);
    else groups.push({ key: day.key, label: day.label, entries: [entry] });
  }
  return groups;
}

function resultMark(result: string | undefined): string {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  if (result === "draw" || result === "1/2-1/2") return "Draw";
  if (result === "1-0") return "1-0";
  if (result === "0-1") return "0-1";
  return "";
}

function pgnResultFromRecord(record: ReviewRecord): string | undefined {
  if (record.pgnResult === "1-0" || record.pgnResult === "0-1" || record.pgnResult === "1/2-1/2") return record.pgnResult;
  const pgn = record.originalPgn ?? record.input;
  const match = /\[Result\s+"\s*(1-0|0-1|1\/2-1\/2)\s*"\]/i.exec(pgn);
  return match?.[1];
}

function entryResult(entry: LibraryEntry): string | undefined {
  if (entry.kind === "pending") return entry.game[entry.game.accountColor].result;
  return entry.record.sourceResult ?? pgnResultFromRecord(entry.record);
}

function entrySide(entry: LibraryEntry): SideColor | undefined {
  if (entry.kind === "pending") return entry.game.accountColor;
  return entry.record.preferredOrientation;
}

function entryTitle(entry: LibraryEntry): string {
  if (entry.kind === "pending") return `${entry.game.white.username} vs ${entry.game.black.username}`;
  return entry.record.title;
}

const TIME_CLASS_RE = /^(blitz|rapid|bullet|daily|classical|correspondence)$/i;

/** Opening / ECO / event as the quiet kicker. Time control stays in meta, not here. */
function entryAnchor(entry: LibraryEntry): string {
  if (entry.kind === "pending") return "";
  const parts = entry.record.subtitle.split(" · ").map((part) => part.trim()).filter(Boolean);
  const eventLike = parts.find((part) => (
    !/^\d+\s+pl(?:y|ies)$/i.test(part)
    && !/^\d{4}\./.test(part)
    && !TIME_CLASS_RE.test(part)
  ));
  return eventLike ?? "";
}

function entryTimeClass(entry: LibraryEntry): string | undefined {
  const raw = entry.kind === "pending" ? entry.game.timeClass : entry.record.sourceTimeClass;
  if (!raw) return undefined;
  return raw.slice(0, 1).toUpperCase() + raw.slice(1);
}


function entryStatus(entry: LibraryEntry, analyzedLabel: string | undefined): string {
  if (entry.kind === "pending") return "Waiting";
  return analyzedLabel ?? "";
}

function syncedGameExternalKey(external: NonNullable<SyncedGame["external"]>): string {
  return `${external.provider}:${external.accountId}:${external.externalGameId}`;
}

function entryProvider(entry: LibraryEntry): ProviderFilter {
  if (entry.kind === "pending") return entry.game.external.provider;
  return entry.record.external?.provider ?? "manual";
}

function ChipRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="library-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          className="library-chip"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function reviewOpenHref(record: ReviewRecord): string {
  return record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`;
}

/**
 * Cheap list thumb only when the record itself carries a position study FEN.
 * Synced games and PGN reviews do not expose a distinctive board without parsing
 * the full score — colour bar alone is the programme mark.
 */
function entryListFen(entry: LibraryEntry): string | null {
  if (entry.kind !== "review" || entry.record.kind !== "fen") return null;
  const fen = entry.record.initialFen?.trim();
  return fen ? fen : null;
}

function ScoreRow({
  entry,
  statusLabel,
  working,
  onAnalyze,
  onDelete,
  onOpenReview,
}: {
  entry: LibraryEntry;
  statusLabel: string | undefined;
  working: string | null;
  onAnalyze: (game: SyncedGame) => void;
  onDelete: (record: ReviewRecord) => void;
  onOpenReview: (href: string) => void;
}) {
  const result = entryResult(entry) ?? "";
  const side = entrySide(entry);
  const dateIso = entry.kind === "pending" ? entry.game.playedAt : entry.record.updatedAt;
  const rowId = entry.kind === "pending" ? entry.game.id : entry.record.id;
  const listFen = entryListFen(entry);
  const busy = working !== null;

  function openRow() {
    if (busy) return;
    if (entry.kind === "pending") onAnalyze(entry.game);
    else onOpenReview(reviewOpenHref(entry.record));
  }

  function onRowActivate(event: MouseEvent | KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    if ("key" in event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
    }
    openRow();
  }

  return (
    <article
      className={`library-score${entry.kind === "pending" ? " pending" : ""}${listFen ? " has-thumb" : ""}`}
      data-result={result || undefined}
      data-side={side}
      role="link"
      tabIndex={0}
      aria-label={`${resultMark(result) || "Game"}: ${entryTitle(entry)}. ${entry.kind === "pending" ? "Analyze" : "Open"}`}
      onClick={onRowActivate}
      onKeyDown={onRowActivate}
    >
      <span className="library-score-bar" aria-hidden="true" />
      {listFen ? <MiniFenThumb fen={listFen} /> : null}
      <span className="library-score-marks">
        {resultMark(result) ? <span className="library-score-result" data-result={result}>{resultMark(result)}</span> : null}
        {side ? (
          <span
            className="library-score-side"
            data-side={side}
            title={side === "white" ? "White" : "Black"}
            aria-label={side === "white" ? "Played as White" : "Played as Black"}
          >
            {side === "white" ? "W" : "B"}
          </span>
        ) : null}
      </span>
      <span className="library-score-copy">
        <strong>{entryTitle(entry)}</strong>
        {entryAnchor(entry) ? <small className="library-score-anchor">{entryAnchor(entry)}</small> : null}
      </span>
      <span className="library-score-meta">
        <SourceChip provider={entry.kind === "pending" ? providerKindFor({ external: entry.game.external }) : providerKindFor(entry.record)} />
        {entryTimeClass(entry) ? <span className="library-score-time">{entryTimeClass(entry)}</span> : null}
        {entryStatus(entry, statusLabel) ? <span className="library-score-status">{entryStatus(entry, statusLabel)}</span> : null}
        <time dateTime={dateIso}>{new Date(dateIso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</time>
      </span>
      {entry.kind === "pending" ? (
        <button type="button" className="text-button library-score-open" disabled={busy} onClick={() => onAnalyze(entry.game)}>
          {working === rowId ? "Preparing…" : "Analyze →"}
        </button>
      ) : (
        <span className="library-score-actions">
          <Link className="library-score-open" href={reviewOpenHref(entry.record)} onClick={(event) => event.stopPropagation()}>Open →</Link>
          <button
            type="button"
            className="text-button danger"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(entry.record);
            }}
          >
            Delete
          </button>
        </span>
      )}
    </article>
  );
}

const FEN_PIECES: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function MiniFenThumb({ fen }: { fen: string }) {
  const placement = fen.split(/\s+/)[0] ?? "";
  const ranks = placement.split("/");
  if (ranks.length !== 8) return null;
  const squares: Array<{ dark: boolean; glyph: string }> = [];
  for (let rank = 0; rank < 8; rank += 1) {
    const row = ranks[rank] ?? "";
    let file = 0;
    for (const ch of row) {
      if (file >= 8) break;
      if (ch >= "1" && ch <= "8") {
        const empty = Number(ch);
        for (let i = 0; i < empty && file < 8; i += 1, file += 1) {
          squares.push({ dark: (rank + file) % 2 === 1, glyph: "" });
        }
      } else {
        squares.push({ dark: (rank + file) % 2 === 1, glyph: FEN_PIECES[ch] ?? "" });
        file += 1;
      }
    }
    while (file < 8) {
      squares.push({ dark: (rank + file) % 2 === 1, glyph: "" });
      file += 1;
    }
  }
  return (
    <span className="library-score-thumb" aria-hidden="true">
      {squares.map((square, index) => (
        <span key={index} className={square.dark ? "dark" : "light"}>{square.glyph}</span>
      ))}
    </span>
  );
}

export function HistoryPage({ savedOnly = false }: { savedOnly?: boolean }) {
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
  /** Primary nav: which month's programme is on the cabinet. */
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  /** Optional day focus within the active month (dim siblings). */
  const [focusedDayKey, setFocusedDayKey] = useState<string | null>(null);
  /** Within-month fallback only — never the way to reach other months. */
  const [withinMonthVisible, setWithinMonthVisible] = useState(LIBRARY_PAGE_SIZE);
  const preparing = useRef<string | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const timeClasses = useMemo(
    () => [...new Set((games ?? []).map((game) => game.timeClass).filter((value): value is string => Boolean(value)))].sort(),
    [games],
  );
  const recordsBySource = new Map(
    (records ?? []).flatMap((record) => (record.external ? [[syncedGameExternalKey(record.external), record] as const] : [])),
  );
  const reviewedRecords = (records ?? []).filter((record) => {
    const recordProvider: ProviderFilter = record.external?.provider ?? "manual";
    const analyzed = snapshot?.statuses.get(record.id)?.analyzed === true;
    return (analysisState === "all" || (analysisState === "reviewed" ? analyzed : !analyzed && record.kind === "pgn"))
      && (provider === "all" || provider === recordProvider)
      && (timeClass === "all" || record.sourceTimeClass === timeClass)
      && (result === "all" || record.sourceResult === result)
      && `${record.title} ${record.subtitle}`.toLowerCase().includes(query.toLowerCase());
  });
  const pendingGames = (savedOnly ? [] : games ?? [])
    .filter((game) => !recordsBySource.has(syncedGameExternalKey(game.external)))
    .filter((game) => (
      (provider === "all" || provider === game.external.provider)
      && analysisState !== "reviewed"
      && (timeClass === "all" || game.timeClass === timeClass)
      && (result === "all" || game[game.accountColor].result === result)
      && `${game.white.username} ${game.black.username}`.toLowerCase().includes(query.toLowerCase())
    ));
  const libraryEntries: LibraryEntry[] = [
    ...pendingGames.map((game) => ({ kind: "pending" as const, date: game.playedAt, game })),
    ...reviewedRecords.map((record) => ({ kind: "review" as const, date: record.updatedAt, record })),
  ].sort((left, right) => right.date.localeCompare(left.date));
  const indexMonths = useMemo(() => groupByMonth(libraryEntries), [libraryEntries]);
  const activeMonth = useMemo(() => {
    if (indexMonths.length === 0) return null;
    return indexMonths.find((group) => group.key === selectedMonthKey) ?? indexMonths[0]!;
  }, [indexMonths, selectedMonthKey]);
  const monthEntries = activeMonth?.entries ?? [];
  const visibleMonthEntries = monthEntries.slice(0, withinMonthVisible);
  const dayGroups = useMemo(() => groupByDay(visibleMonthEntries), [visibleMonthEntries]);
  const activeMonthIndex = activeMonth
    ? Math.max(0, indexMonths.findIndex((group) => group.key === activeMonth.key))
    : 0;
  const listedAnalyzed = libraryEntries.filter((entry) => entry.kind === "review" && snapshot?.statuses.get(entry.record.id)?.analyzed).length;
  const listedPending = libraryEntries.filter((entry) => entry.kind === "pending" || (entry.record.kind === "pgn" && !snapshot?.statuses.get(entry.record.id)?.analyzed)).length;
  const manualCount = libraryEntries.filter((entry) => entryProvider(entry) === "manual").length;
  const chesscomCount = libraryEntries.filter((entry) => entryProvider(entry) === "chesscom").length;
  const lichessCount = libraryEntries.filter((entry) => entryProvider(entry) === "lichess").length;
  const sourceLabel = [
    manualCount > 0 ? `${manualCount} Manual` : null,
    chesscomCount > 0 ? `${chesscomCount} Chess.com` : null,
    lichessCount > 0 ? `${lichessCount} Lichess` : null,
  ].filter((value): value is string => value !== null).join(" · ") || "—";

  // Keep selection on a real month when filters or data change.
  useEffect(() => {
    if (indexMonths.length === 0) {
      setSelectedMonthKey(null);
      return;
    }
    if (!selectedMonthKey || !indexMonths.some((group) => group.key === selectedMonthKey)) {
      setSelectedMonthKey(indexMonths[0]!.key);
    }
  }, [indexMonths, selectedMonthKey]);

  useEffect(() => {
    setWithinMonthVisible(LIBRARY_PAGE_SIZE);
    setFocusedDayKey(null);
  }, [selectedMonthKey, analysisState, provider, query, result, timeClass]);

  function selectMonth(key: string) {
    if (key === selectedMonthKey) {
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSelectedMonthKey(key);
    setFocusedDayKey(null);
    setWithinMonthVisible(LIBRARY_PAGE_SIZE);
    // Scroll after React paints the new month.
    requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function focusDay(dayKey: string) {
    setFocusedDayKey((current) => (current === dayKey ? null : dayKey));
    const node = document.getElementById(`library-day-${dayKey}`);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function analyze(game: SyncedGame) {
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

  function removeReview(record: ReviewRecord) {
    if (!window.confirm("Delete this review and its training references? Imported source games remain available. Background work will pause.")) return;
    setWorking(record.id);
    setActionError(null);
    void deleteReviewRecord(record.id).then(() => window.location.reload()).catch((error) => {
      setActionError(error instanceof Error ? error.message : "Unable to delete this review. Try again.");
      setWorking(null);
    });
  }

  const loading = refreshing && !snapshot;
  const empty = !loading && !libraryError && libraryEntries.length === 0;
  const showMonthIndex = indexMonths.length > 1;

  return (
    <main className="page-scroll utility-page library-page">
      <PlatformHeading
        chapter={savedOnly ? "Library / Saved reviews" : "Library / Score cabinet"}
        title={savedOnly ? "Pick up where you left off." : "A quiet cabinet of games."}
        actions={<Link className="primary-link" href="/import">Import a game</Link>}
      />
      {(libraryError || actionError) && (
        <p className="error" role="alert">
          {actionError ?? libraryError}{" "}
          <button type="button" className="text-button" disabled={refreshing} onClick={() => { setActionError(null); void refresh(); }}>Retry loading games</button>
        </p>
      )}
      <nav className="library-views" aria-label="Library views">
        <Link href="/history" aria-current={!savedOnly ? "page" : undefined}>All games</Link>
        <Link href="/review" aria-current={savedOnly ? "page" : undefined}>Saved reviews</Link>
        <Link href="/stats">Stats →</Link>
      </nav>
      <section className={`history-list library-sheet${showMonthIndex ? " has-month-index" : ""}`}>
        {snapshot && (
          <p className="history-summary study-ink-stats" aria-label="History summary">
            <span><strong>{libraryEntries.length}</strong> All records</span>
            <span><strong>{listedAnalyzed}</strong> Analyzed</span>
            <span><strong>{listedPending}</strong> Pending</span>
            <span><strong>{sourceLabel}</strong></span>
          </p>
        )}
        <div className="library-toolbar" aria-label="Library filters">
          <label className="library-search">
            <span className="sr-only">Search players or events</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a player, opening, or event" />
          </label>
          <div className="library-chip-stack">
            <ChipRow label="Source" value={provider} options={SOURCE_CHIPS} onChange={(id) => setProvider(id as ProviderFilter)} />
            <ChipRow label="Status" value={analysisState} options={STATUS_CHIPS} onChange={(id) => setAnalysisState(id as AnalysisFilter)} />
            <ChipRow label="Result" value={result} options={RESULT_CHIPS} onChange={setResult} />
            {timeClasses.length > 0 && (
              <ChipRow
                label="Time control"
                value={timeClass}
                options={[{ id: "all", label: "Any time" }, ...timeClasses.map((value) => ({ id: value, label: value.slice(0, 1).toUpperCase() + value.slice(1) }))]}
                onChange={setTimeClass}
              />
            )}
          </div>
        </div>
        {loading ? (
          <p className="utility-empty" role="status">
            {indexing
              ? `Preparing saved games… ${indexing.completed} / ${indexing.total}. This one-time update keeps future visits fast.`
              : "Loading history…"}
          </p>
        ) : empty ? (
          snapshot?.records.length || snapshot?.games.length ? (
            <div className="utility-empty">
              <strong>No matching games</strong>
              <span>Try another player, source or result.</span>
              <button type="button" className="secondary" onClick={() => { setQuery(""); setProvider("all"); setAnalysisState("all"); setTimeClass("all"); setResult("all"); }}>Clear filters</button>
            </div>
          ) : (
            <DeskEmptyState title="Your first game belongs here." actions={<Link className="primary-link" href="/import">Import a game →</Link>}>
              Bring a PGN or a saved position to your desk. Your games and notes will stay together in this browser.
            </DeskEmptyState>
          )
        ) : (
          <div className="library-cabinet">
            <div className="library-cabinet-list" ref={listTopRef}>
              {activeMonth ? (
                <section
                  className={`library-month${focusedDayKey ? " has-day-focus" : ""}`}
                  key={activeMonth.key}
                  id={activeMonth.key}
                  data-month={activeMonth.key}
                >
                  <header className="library-month-head">
                    <span className="library-movement" aria-hidden="true">{romanNumeral(activeMonthIndex + 1)}</span>
                    <h2>{activeMonth.heading}</h2>
                    <span className="library-month-count">{activeMonth.entries.length}</span>
                  </header>
                  {dayGroups.map((day) => {
                    const dayFocused = focusedDayKey === day.key;
                    const dayDimmed = Boolean(focusedDayKey) && !dayFocused;
                    return (
                      <div
                        key={day.key}
                        id={`library-day-${day.key}`}
                        className={`library-day-block${dayFocused ? " is-focused" : ""}${dayDimmed ? " is-dimmed" : ""}`}
                      >
                        <div className="library-day">
                          <button
                            type="button"
                            className="library-day-label"
                            aria-pressed={dayFocused}
                            aria-label={`Focus ${day.label} ${activeMonth.heading}, ${day.entries.length} ${day.entries.length === 1 ? "game" : "games"}`}
                            onClick={() => focusDay(day.key)}
                          >
                            {day.label}
                          </button>
                          <span className="library-day-rule" aria-hidden="true" />
                        </div>
                        {day.entries.map((entry) => {
                          const rowKey = entry.kind === "pending" ? entry.game.id : entry.record.id;
                          return (
                            <ScoreRow
                              key={rowKey}
                              entry={entry}
                              statusLabel={entry.kind === "review" ? snapshot?.statuses.get(entry.record.id)?.label : undefined}
                              working={working}
                              onAnalyze={(game) => void analyze(game)}
                              onDelete={removeReview}
                              onOpenReview={(href) => router.push(href)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </section>
              ) : null}
              {withinMonthVisible < monthEntries.length ? (
                <button
                  type="button"
                  className="text-button library-load-more"
                  onClick={() => setWithinMonthVisible((count) => count + LIBRARY_PAGE_SIZE)}
                >
                  Load {Math.min(LIBRARY_PAGE_SIZE, monthEntries.length - withinMonthVisible)} more in this month · {withinMonthVisible} of {monthEntries.length}
                </button>
              ) : null}
            </div>
            {showMonthIndex ? (
              <nav className="library-month-index" aria-label="Months with games">
                {indexMonths.map((group) => {
                  const current = group.key === (activeMonth?.key ?? selectedMonthKey);
                  return (
                    <button
                      type="button"
                      key={group.key}
                      className="library-month-index-item"
                      aria-current={current ? "true" : undefined}
                      onClick={() => selectMonth(group.key)}
                    >
                      <span className="library-month-index-label">{monthIndexLabel(group.heading)}</span>
                      <span className="library-month-index-count">{group.entries.length}</span>
                    </button>
                  );
                })}
              </nav>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
