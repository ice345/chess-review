"use client";

import type { StudyReportFiltersV2 } from "@chess-review/analysis";
import { scopeLabel } from "./study-helpers";

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
  return <details className="study-scope" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
    <summary><span>Scope</span><strong>{scopeLabel(filters, gameCount)}</strong><span className="study-scope-change">{open ? "Hide scope" : "Change scope"}</span></summary>
    <div className="study-filters" aria-label="Study population filters">
    <label><span>Source</span><select value={filters.providers[0] ?? "all"} onChange={(event) => setFilters({ ...filters, providers: event.target.value === "all" ? [] : [event.target.value as "chesscom" | "lichess"] })}><option value="all">All sources</option><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select></label>
    <label><span>Time control</span><select value={filters.timeClasses[0] ?? "all"} onChange={(event) => setFilters({ ...filters, timeClasses: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">All time controls</option>{timeClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>Rated</span><select value={filters.rated} onChange={(event) => setFilters({ ...filters, rated: event.target.value as StudyReportFiltersV2["rated"] })}><option value="all">All games</option><option value="rated">Rated</option><option value="casual">Casual</option></select></label>
    <label><span>Color</span><select value={filters.playerColors[0] ?? "all"} onChange={(event) => setFilters({ ...filters, playerColors: event.target.value === "all" ? [] : [event.target.value as "white" | "black"] })}><option value="all">Both colors</option><option value="white">White</option><option value="black">Black</option></select></label>
    <label><span>Opening</span><select value={filters.openingKeys[0] ?? "all"} disabled={openingOptions.length === 0} onChange={(event) => setFilters({ ...filters, openingKeys: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">All openings</option>{openingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    <label><span>Minimum sample</span><select value={filters.minimumSampleSize} onChange={(event) => setFilters({ ...filters, minimumSampleSize: Number(event.target.value) })}>{[1, 2, 3, 5, 10].map((value) => <option key={value} value={value}>{value} game{value === 1 ? "" : "s"}</option>)}</select></label>
    <label><span>From</span><input type="date" value={filters.dateFrom?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateFrom = `${event.target.value}T00:00:00.000Z`; else delete next.dateFrom; setFilters(next); }} /></label>
    <label><span>To</span><input type="date" value={filters.dateTo?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateTo = `${event.target.value}T23:59:59.999Z`; else delete next.dateTo; setFilters(next); }} /></label>
    </div>
  </details>;
}

export { ScopeFilters };
