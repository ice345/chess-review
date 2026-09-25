"use client";

import Link from "next/link";
import { DeskEmptyState } from "./desk-empty-state";
import { PlatformHeading } from "./platform-heading";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { ExternalPlatform, SyncedGame, UiLanguage } from "@chess-review/shared";
import { deleteReviewRecord } from "../lib/local-data";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { useUiLanguage } from "../hooks/use-ui-language";
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

type HistoryCopy = {
  filterAll: string;
  filterManual: string;
  analyzed: string;
  waiting: string;
  anyResult: string;
  win: string;
  loss: string;
  draw: string;
  undated: string;
  game: string;
  analyze: string;
  open: string;
  white: string;
  black: string;
  whiteLetter: string;
  blackLetter: string;
  playedAsWhite: string;
  playedAsBlack: string;
  preparing: string;
  analyzeArrow: string;
  openArrow: string;
  delete: string;
  rowAriaLabel: (mark: string, title: string, action: string) => string;
  unableToOpen: string;
  deleteConfirm: string;
  unableToDelete: string;
  chapterSaved: string;
  chapterCabinet: string;
  titleSaved: string;
  titleCabinet: string;
  importAGame: string;
  retryLoading: string;
  libraryViews: string;
  allGames: string;
  savedReviews: string;
  statsArrow: string;
  historySummary: string;
  allRecords: string;
  pending: string;
  sourceManual: (n: number) => string;
  sourceChesscom: (n: number) => string;
  sourceLichess: (n: number) => string;
  libraryFilters: string;
  searchPlayers: string;
  searchPlaceholder: string;
  source: string;
  status: string;
  result: string;
  timeControl: string;
  anyTime: string;
  preparingSaved: (completed: number, total: number) => string;
  loadingHistory: string;
  noMatching: string;
  tryAnother: string;
  clearFilters: string;
  emptyTitle: string;
  importAGameArrow: string;
  emptyBody: string;
  focusDay: (day: string, month: string, n: number) => string;
  loadMore: (n: number, shown: number, total: number) => string;
  monthsWithGames: string;
};

const COPY: Record<UiLanguage, HistoryCopy> = {
  en: {
    filterAll: "All",
    filterManual: "Manual",
    analyzed: "Analyzed",
    waiting: "Waiting",
    anyResult: "Any result",
    win: "Win",
    loss: "Loss",
    draw: "Draw",
    undated: "Undated",
    game: "Game",
    analyze: "Analyze",
    open: "Open",
    white: "White",
    black: "Black",
    whiteLetter: "W",
    blackLetter: "B",
    playedAsWhite: "Played as White",
    playedAsBlack: "Played as Black",
    preparing: "Preparing…",
    analyzeArrow: "Analyze →",
    openArrow: "Open →",
    delete: "Delete",
    rowAriaLabel: (mark, title, action) => `${mark}: ${title}. ${action}`,
    unableToOpen: "Unable to open this game. Try again.",
    deleteConfirm: "Delete this review and its training references? Imported source games remain available. Background work will pause.",
    unableToDelete: "Unable to delete this review. Try again.",
    chapterSaved: "Library / Saved reviews",
    chapterCabinet: "Library / Score cabinet",
    titleSaved: "Pick up where you left off.",
    titleCabinet: "A quiet cabinet of games.",
    importAGame: "Import a game",
    retryLoading: "Retry loading games",
    libraryViews: "Library views",
    allGames: "All games",
    savedReviews: "Saved reviews",
    statsArrow: "Stats →",
    historySummary: "History summary",
    allRecords: "All records",
    pending: "Pending",
    sourceManual: (n) => `${n} Manual`,
    sourceChesscom: (n) => `${n} Chess.com`,
    sourceLichess: (n) => `${n} Lichess`,
    libraryFilters: "Library filters",
    searchPlayers: "Search players or events",
    searchPlaceholder: "Search a player, opening, or event",
    source: "Source",
    status: "Status",
    result: "Result",
    timeControl: "Time control",
    anyTime: "Any time",
    preparingSaved: (completed, total) => `Preparing saved games… ${completed} / ${total}. This one-time update keeps future visits fast.`,
    loadingHistory: "Loading history…",
    noMatching: "No matching games",
    tryAnother: "Try another player, source or result.",
    clearFilters: "Clear filters",
    emptyTitle: "Your first game belongs here.",
    importAGameArrow: "Import a game →",
    emptyBody: "Bring a PGN or a saved position to your desk. Your games and notes will stay together in this browser.",
    focusDay: (day, month, n) => `Focus ${day} ${month}, ${n} ${n === 1 ? "game" : "games"}`,
    loadMore: (n, shown, total) => `Load ${n} more in this month · ${shown} of ${total}`,
    monthsWithGames: "Months with games",
  },
  "zh-CN": {
    filterAll: "全部",
    filterManual: "手动",
    analyzed: "已分析",
    waiting: "等待",
    anyResult: "任意结果",
    win: "胜",
    loss: "负",
    draw: "和",
    undated: "无日期",
    game: "对局",
    analyze: "分析",
    open: "打开",
    white: "白方",
    black: "黑方",
    whiteLetter: "白",
    blackLetter: "黑",
    playedAsWhite: "执白",
    playedAsBlack: "执黑",
    preparing: "准备中…",
    analyzeArrow: "分析 →",
    openArrow: "打开 →",
    delete: "删除",
    rowAriaLabel: (mark, title, action) => `${mark}：${title}。${action}`,
    unableToOpen: "无法打开这盘对局。请再试一次。",
    deleteConfirm: "删除这次复盘及其训练引用？已导入的源对局仍可用。后台工作将暂停。",
    unableToDelete: "无法删除这次复盘。请再试一次。",
    chapterSaved: "棋库 / 已保存的复盘",
    chapterCabinet: "棋库 / 棋谱柜",
    titleSaved: "从上次停下的地方继续。",
    titleCabinet: "一柜安静的对局。",
    importAGame: "导入对局",
    retryLoading: "重新加载对局",
    libraryViews: "棋库视图",
    allGames: "全部对局",
    savedReviews: "已保存的复盘",
    statsArrow: "统计 →",
    historySummary: "历史摘要",
    allRecords: "全部记录",
    pending: "待处理",
    sourceManual: (n) => `${n} 手动`,
    sourceChesscom: (n) => `${n} Chess.com`,
    sourceLichess: (n) => `${n} Lichess`,
    libraryFilters: "棋库筛选",
    searchPlayers: "搜索棋手或赛事",
    searchPlaceholder: "搜索棋手、开局或赛事",
    source: "来源",
    status: "状态",
    result: "结果",
    timeControl: "时间控制",
    anyTime: "任意时间",
    preparingSaved: (completed, total) => `正在准备已保存的对局… ${completed} / ${total}。这是一次性更新，之后访问会更快。`,
    loadingHistory: "正在加载历史…",
    noMatching: "没有匹配的对局",
    tryAnother: "试试其他棋手、来源或结果。",
    clearFilters: "清除筛选",
    emptyTitle: "你的第一盘对局属于这里。",
    importAGameArrow: "导入对局 →",
    emptyBody: "把 PGN 或已保存的局面带到你的桌上。对局和笔记会一起留在本浏览器中。",
    focusDay: (day, month, n) => `聚焦 ${month} ${day} 日，${n} 盘对局`,
    loadMore: (n, shown, total) => `本月再加载 ${n} 条 · ${shown} / ${total}`,
    monthsWithGames: "有对局的月份",
  },
};

function monthHeading(iso: string, undated: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undated;
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

function groupByMonth(entries: LibraryEntry[], undated: string): Array<{ heading: string; key: string; entries: LibraryEntry[] }> {
  const groups: Array<{ heading: string; key: string; entries: LibraryEntry[] }> = [];
  for (const entry of entries) {
    const heading = monthHeading(entry.date, undated);
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

function resultMark(result: string | undefined, copy: HistoryCopy): string {
  if (result === "win") return copy.win;
  if (result === "loss") return copy.loss;
  if (result === "draw" || result === "1/2-1/2") return copy.draw;
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


function entryStatus(entry: LibraryEntry, analyzedLabel: string | undefined, waiting: string): string {
  if (entry.kind === "pending") return waiting;
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
  const copy = COPY[useUiLanguage()];
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
      aria-label={copy.rowAriaLabel(resultMark(result, copy) || copy.game, entryTitle(entry), entry.kind === "pending" ? copy.analyze : copy.open)}
      onClick={onRowActivate}
      onKeyDown={onRowActivate}
    >
      <span className="library-score-bar" aria-hidden="true" />
      {listFen ? <MiniFenThumb fen={listFen} /> : null}
      <span className="library-score-marks">
        {resultMark(result, copy) ? <span className="library-score-result" data-result={result}>{resultMark(result, copy)}</span> : null}
        {side ? (
          <span
            className="library-score-side"
            data-side={side}
            title={side === "white" ? copy.white : copy.black}
            aria-label={side === "white" ? copy.playedAsWhite : copy.playedAsBlack}
          >
            {side === "white" ? copy.whiteLetter : copy.blackLetter}
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
        {entryStatus(entry, statusLabel, copy.waiting) ? <span className="library-score-status">{entryStatus(entry, statusLabel, copy.waiting)}</span> : null}
        <time dateTime={dateIso}>{new Date(dateIso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</time>
      </span>
      {entry.kind === "pending" ? (
        <button type="button" className="text-button library-score-open" disabled={busy} onClick={() => onAnalyze(entry.game)}>
          {working === rowId ? copy.preparing : copy.analyzeArrow}
        </button>
      ) : (
        <span className="library-score-actions">
          <Link className="library-score-open" href={reviewOpenHref(entry.record)} onClick={(event) => event.stopPropagation()}>{copy.openArrow}</Link>
          <button
            type="button"
            className="text-button danger"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(entry.record);
            }}
          >
            {copy.delete}
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
  const copy = COPY[useUiLanguage()];
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
  const indexMonths = useMemo(() => groupByMonth(libraryEntries, copy.undated), [libraryEntries, copy.undated]);
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
    manualCount > 0 ? copy.sourceManual(manualCount) : null,
    chesscomCount > 0 ? copy.sourceChesscom(chesscomCount) : null,
    lichessCount > 0 ? copy.sourceLichess(lichessCount) : null,
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
      setActionError(error instanceof Error ? error.message : copy.unableToOpen);
    } finally {
      preparing.current = null;
      setWorking(null);
    }
  }

  function removeReview(record: ReviewRecord) {
    if (!window.confirm(copy.deleteConfirm)) return;
    setWorking(record.id);
    setActionError(null);
    void deleteReviewRecord(record.id).then(() => window.location.reload()).catch((error) => {
      setActionError(error instanceof Error ? error.message : copy.unableToDelete);
      setWorking(null);
    });
  }

  const loading = refreshing && !snapshot;
  const empty = !loading && !libraryError && libraryEntries.length === 0;
  const showMonthIndex = indexMonths.length > 1;

  return (
    <main className="page-scroll utility-page library-page">
      <PlatformHeading
        chapter={savedOnly ? copy.chapterSaved : copy.chapterCabinet}
        title={savedOnly ? copy.titleSaved : copy.titleCabinet}
        actions={<Link className="primary-link" href="/import">{copy.importAGame}</Link>}
      />
      {(libraryError || actionError) && (
        <p className="error" role="alert">
          {actionError ?? libraryError}{" "}
          <button type="button" className="text-button" disabled={refreshing} onClick={() => { setActionError(null); void refresh(); }}>{copy.retryLoading}</button>
        </p>
      )}
      <nav className="library-views" aria-label={copy.libraryViews}>
        <Link href="/history" aria-current={!savedOnly ? "page" : undefined}>{copy.allGames}</Link>
        <Link href="/review" aria-current={savedOnly ? "page" : undefined}>{copy.savedReviews}</Link>
        <Link href="/stats">{copy.statsArrow}</Link>
      </nav>
      <section className={`history-list library-sheet${showMonthIndex ? " has-month-index" : ""}`}>
        {snapshot && (
          <p className="history-summary study-ink-stats" aria-label={copy.historySummary}>
            <span><strong>{libraryEntries.length}</strong> {copy.allRecords}</span>
            <span><strong>{listedAnalyzed}</strong> {copy.analyzed}</span>
            <span><strong>{listedPending}</strong> {copy.pending}</span>
            <span><strong>{sourceLabel}</strong></span>
          </p>
        )}
        <div className="library-toolbar" aria-label={copy.libraryFilters}>
          <label className="library-search">
            <span className="sr-only">{copy.searchPlayers}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
          </label>
          <div className="library-chip-stack">
            <ChipRow label={copy.source} value={provider} options={[{ id: "all", label: copy.filterAll }, { id: "chesscom", label: "Chess.com" }, { id: "lichess", label: "Lichess" }, { id: "manual", label: copy.filterManual }]} onChange={(id) => setProvider(id as ProviderFilter)} />
            <ChipRow label={copy.status} value={analysisState} options={[{ id: "all", label: copy.filterAll }, { id: "reviewed", label: copy.analyzed }, { id: "not-reviewed", label: copy.waiting }]} onChange={(id) => setAnalysisState(id as AnalysisFilter)} />
            <ChipRow label={copy.result} value={result} options={[{ id: "all", label: copy.anyResult }, { id: "win", label: copy.win }, { id: "loss", label: copy.loss }, { id: "draw", label: copy.draw }]} onChange={setResult} />
            {timeClasses.length > 0 && (
              <ChipRow
                label={copy.timeControl}
                value={timeClass}
                options={[{ id: "all", label: copy.anyTime }, ...timeClasses.map((value) => ({ id: value, label: value.slice(0, 1).toUpperCase() + value.slice(1) }))]}
                onChange={setTimeClass}
              />
            )}
          </div>
        </div>
        {loading ? (
          <p className="utility-empty" role="status">
            {indexing
              ? copy.preparingSaved(indexing.completed, indexing.total)
              : copy.loadingHistory}
          </p>
        ) : empty ? (
          snapshot?.records.length || snapshot?.games.length ? (
            <div className="utility-empty">
              <strong>{copy.noMatching}</strong>
              <span>{copy.tryAnother}</span>
              <button type="button" className="secondary" onClick={() => { setQuery(""); setProvider("all"); setAnalysisState("all"); setTimeClass("all"); setResult("all"); }}>{copy.clearFilters}</button>
            </div>
          ) : (
            <DeskEmptyState title={copy.emptyTitle} actions={<Link className="primary-link" href="/import">{copy.importAGameArrow}</Link>}>
              {copy.emptyBody}
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
                            aria-label={copy.focusDay(day.label, activeMonth.heading, day.entries.length)}
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
                  {copy.loadMore(Math.min(LIBRARY_PAGE_SIZE, monthEntries.length - withinMonthVisible), withinMonthVisible, monthEntries.length)}
                </button>
              ) : null}
            </div>
            {showMonthIndex ? (
              <nav className="library-month-index" aria-label={copy.monthsWithGames}>
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
