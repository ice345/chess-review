"use client";

import type { StudyReportFiltersV2 } from "@chess-review/analysis";
import type { UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../../hooks/use-ui-language";

type ScopeCopy = {
  scope: string;
  hideScope: string;
  changeScope: string;
  filtersLabel: string;
  source: string;
  allSources: string;
  timeControl: string;
  allTimeControls: string;
  rated: string;
  allGames: string;
  ratedOnly: string;
  casual: string;
  color: string;
  bothColors: string;
  white: string;
  black: string;
  opening: string;
  allOpenings: string;
  minimumSample: string;
  games: (n: number) => string;
  from: string;
  to: string;
  allPlatforms: string;
  dateRange: string;
  scopeGames: (n: number) => string;
};

const COPY: Record<UiLanguage, ScopeCopy> = {
  en: {
    scope: "Scope",
    hideScope: "Hide scope",
    changeScope: "Change scope",
    filtersLabel: "Study population filters",
    source: "Source",
    allSources: "All sources",
    timeControl: "Time control",
    allTimeControls: "All time controls",
    rated: "Rated",
    allGames: "All games",
    ratedOnly: "Rated",
    casual: "Casual",
    color: "Color",
    bothColors: "Both colors",
    white: "White",
    black: "Black",
    opening: "Opening",
    allOpenings: "All openings",
    minimumSample: "Minimum sample",
    games: (n) => `${n} game${n === 1 ? "" : "s"}`,
    from: "From",
    to: "To",
    allPlatforms: "All platforms",
    dateRange: " · Date range",
    scopeGames: (n) => `${n} games`,
  },
  "zh-CN": {
    scope: "范围",
    hideScope: "隐藏范围",
    changeScope: "更改范围",
    filtersLabel: "统计范围筛选",
    source: "来源",
    allSources: "全部来源",
    timeControl: "时间控制",
    allTimeControls: "全部时限",
    rated: "计分",
    allGames: "全部对局",
    ratedOnly: "计分",
    casual: "休闲",
    color: "颜色",
    bothColors: "双方",
    white: "白方",
    black: "黑方",
    opening: "开局",
    allOpenings: "全部开局",
    minimumSample: "最小样本",
    games: (n) => `${n} 盘对局`,
    from: "从",
    to: "到",
    allPlatforms: "全部平台",
    dateRange: " · 日期范围",
    scopeGames: (n) => `${n} 盘对局`,
  },
};

function scopeLabel(filters: StudyReportFiltersV2, gameCount: number, copy: ScopeCopy): string {
  const provider = filters.providers.length === 0
    ? copy.allPlatforms
    : filters.providers.map((value) => value === "chesscom" ? "Chess.com" : "Lichess").join(" + ");
  const time = filters.timeClasses.length === 0 ? copy.allTimeControls : filters.timeClasses.join(" + ");
  const color = filters.playerColors.length === 0
    ? copy.bothColors
    : filters.playerColors.map((value) => value === "white" ? copy.white : copy.black).join(" + ");
  const rated = filters.rated === "all" ? copy.allGames : filters.rated === "rated" ? copy.ratedOnly : copy.casual;
  const dates = filters.dateFrom || filters.dateTo ? copy.dateRange : "";
  return provider + " · " + time + " · " + rated + " · " + color + dates + " · " + copy.scopeGames(gameCount);
}

function ScopeFilters({
  filters,
  setFilters,
  timeClasses,
  openingOptions,
  gameCount,
  open,
  onToggle,
}: {
  filters: StudyReportFiltersV2;
  setFilters: (filters: StudyReportFiltersV2) => void;
  timeClasses: string[];
  openingOptions: Array<{ key: string; label: string }>;
  gameCount: number;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const copy = COPY[useUiLanguage()];
  return <details className="study-scope" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
    <summary><span>{copy.scope}</span><strong>{scopeLabel(filters, gameCount, copy)}</strong><span className="study-scope-change">{open ? copy.hideScope : copy.changeScope}</span></summary>
    <div className="study-filters" aria-label={copy.filtersLabel}>
    <label><span>{copy.source}</span><select value={filters.providers[0] ?? "all"} onChange={(event) => setFilters({ ...filters, providers: event.target.value === "all" ? [] : [event.target.value as "chesscom" | "lichess"] })}><option value="all">{copy.allSources}</option><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select></label>
    <label><span>{copy.timeControl}</span><select value={filters.timeClasses[0] ?? "all"} onChange={(event) => setFilters({ ...filters, timeClasses: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">{copy.allTimeControls}</option>{timeClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>{copy.rated}</span><select value={filters.rated} onChange={(event) => setFilters({ ...filters, rated: event.target.value as StudyReportFiltersV2["rated"] })}><option value="all">{copy.allGames}</option><option value="rated">{copy.ratedOnly}</option><option value="casual">{copy.casual}</option></select></label>
    <label><span>{copy.color}</span><select value={filters.playerColors[0] ?? "all"} onChange={(event) => setFilters({ ...filters, playerColors: event.target.value === "all" ? [] : [event.target.value as "white" | "black"] })}><option value="all">{copy.bothColors}</option><option value="white">{copy.white}</option><option value="black">{copy.black}</option></select></label>
    <label><span>{copy.opening}</span><select value={filters.openingKeys[0] ?? "all"} disabled={openingOptions.length === 0} onChange={(event) => setFilters({ ...filters, openingKeys: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">{copy.allOpenings}</option>{openingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    <label><span>{copy.minimumSample}</span><select value={filters.minimumSampleSize} onChange={(event) => setFilters({ ...filters, minimumSampleSize: Number(event.target.value) })}>{[1, 2, 3, 5, 10].map((value) => <option key={value} value={value}>{copy.games(value)}</option>)}</select></label>
    <label><span>{copy.from}</span><input type="date" value={filters.dateFrom?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateFrom = `${event.target.value}T00:00:00.000Z`; else delete next.dateFrom; setFilters(next); }} /></label>
    <label><span>{copy.to}</span><input type="date" value={filters.dateTo?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateTo = `${event.target.value}T23:59:59.999Z`; else delete next.dateTo; setFilters(next); }} /></label>
    </div>
  </details>;
}

export { ScopeFilters };
