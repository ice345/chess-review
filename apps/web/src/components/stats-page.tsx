"use client";

import Link from "next/link";
import { DeskEmptyState } from "./desk-empty-state";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { ProviderMark } from "@chess-review/ui";
import { subscribeLocalData } from "../lib/browser-storage";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { listTrainingQueue } from "../lib/training-queue";
import { masterySummary } from "../lib/training-mastery";
import { StatsStudyPanel } from "./advanced-study/stats-study-panel";

const RESULT_LABEL: Record<string, string> = { win: "Win", loss: "Loss", draw: "Draw" };
const RESULT_RANK: Record<string, number> = { win: 0, loss: 1, draw: 2 };

function StatRow({ mark, label, value, total }: { mark?: ReactNode; label: string; value: number; total?: number }) {
  return <div className="stats-distribution-row">
    <div className="stats-row-label">{mark}<span>{label}</span><strong>{value}</strong></div>
    {total !== undefined && total > 0 && <div className="stats-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, value / total * 100)}%` }} /></div>}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="stats-metric"><dt>{label}</dt><dd>{value}</dd><p>{detail}</p></div>;
}


export function StatsPage() {
  const { snapshot, error: libraryError, loading: refreshing, indexing, refresh } = useLibrarySnapshot();
  const [distributionScope, setDistributionScope] = useState<"records" | "synced">("records");
  const [queue, setQueue] = useState<TrainingQueueItemV3[] | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const loading = refreshing && !snapshot;
  const empty = !loading && !libraryError && (snapshot?.records.length ?? 0) === 0 && (snapshot?.games.length ?? 0) === 0;

  useEffect(() => {
    let active = true;
    const load = () => {
      void listTrainingQueue()
        .then((items) => {
          if (!active) return;
          setQueue(items);
          setQueueError(null);
        })
        .catch((cause) => {
          if (!active) return;
          setQueueError(cause instanceof Error ? cause.message : "Unable to load practice.");
        });
    };
    load();
    const unsubscribe = subscribeLocalData(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const figures = useMemo(() => {
    if (!snapshot) return null;
    const { records, games, statuses } = snapshot;
    let analysed = 0;
    let pending = 0;
    for (const record of records) {
      if (statuses.get(record.id)?.analyzed) analysed += 1;
      else if (record.kind === "pgn") pending += 1;
    }
    return {
      records: records.length,
      games: games.length,
      analysed,
      pending,
    };
  }, [snapshot]);

  const distribution = useMemo(() => {
    if (!snapshot) return null;
    const items = distributionScope === "synced"
      ? snapshot.games.map((game) => ({ provider: game.external.provider, time: game.timeClass, result: game[game.accountColor].result }))
      : snapshot.records.map((record) => ({ provider: record.external?.provider ?? "manual", time: record.sourceTimeClass, result: record.sourceResult }));
    const sources = { manual: 0, chesscom: 0, lichess: 0 };
    const times = new Map<string, number>();
    const results = new Map<string, number>([["win", 0], ["loss", 0], ["draw", 0]]);
    for (const item of items) {
      if (item.provider === "chesscom") sources.chesscom++;
      else if (item.provider === "lichess") sources.lichess++;
      else sources.manual++;
      if (item.time) times.set(item.time, (times.get(item.time) ?? 0) + 1);
      if (item.result) results.set(item.result, (results.get(item.result) ?? 0) + 1);
    }
    return { ...sources, total: items.length,
      timeClasses: [...times.entries()].sort(([a], [b]) => a.localeCompare(b)),
      results: [...results.entries()].sort(([a], [b]) => (RESULT_RANK[a] ?? 3) - (RESULT_RANK[b] ?? 3) || a.localeCompare(b)),
    };
  }, [snapshot, distributionScope]);

  const practice = useMemo(() => {
    if (!queue) return null;
    const now = new Date();
    let mastered = 0;
    let due = 0;
    let inProgress = 0;
    for (const item of queue) {
      const summary = masterySummary(item, now);
      mastered += summary.mastered;
      due += summary.due;
      inProgress += Math.max(summary.reviewed - summary.mastered, 0);
    }
    return { mastered, due, inProgress };
  }, [queue]);

  return (
    <main className="page-scroll stats-page">
      <header className="stats-heading head-archive">
        <div>
          <p className="page-kicker">Stats / Growth archive</p>
          <h1>Every game leaves a trace.</h1>
        </div>
        <Link className="text-button" href="/history">Open library →</Link>
      </header>
      <div className="stats-stage">
        {libraryError && (
          <p className="error" role="alert">
            {libraryError}{" "}
            <button type="button" className="text-button" disabled={refreshing} onClick={() => void refresh()}>
              Retry loading games
            </button>
          </p>
        )}
        {loading ? (
          <p className="stats-status" role="status">
            {indexing
              ? `Preparing saved games… ${indexing.completed} / ${indexing.total}. This one-time update keeps future visits fast.`
              : "Loading library…"}
          </p>
        ) : empty ? (
          <div className="stats-empty"><DeskEmptyState title="A little history starts with one game." actions={<Link className="primary-link" href="/import">Import a game →</Link>}>Library and practice counts will appear here as you save games and study positions.</DeskEmptyState></div>
        ) : figures && distribution ? (
          <div className="stats-dashboard">
            <section className="stats-inventory" aria-labelledby="stats-inventory-title">
              <div className="stats-band-head">
                <p className="stats-band-kicker">Inventory</p>
                <h2 id="stats-inventory-title">Collection</h2>
              </div>
              <p className="stats-identity" aria-label="Library totals">
                <span><strong>{figures.records}</strong> records</span>
                <span><strong>{figures.analysed}</strong> analyzed</span>
                <span><strong>{figures.games}</strong> synced</span>
                <span><strong>{figures.pending}</strong> pending</span>
              </p>
              <p className="stats-panel-note">Records and synced games overlap; they are not added together. Synced games include games not yet opened for review.</p>
            </section>
            <section className="stats-growth" aria-labelledby="stats-your-game-title">
              <div className="stats-band-head">
                <p className="stats-band-kicker">Growth</p>
              </div>
              <StatsStudyPanel />
              <section className="stats-practice" aria-labelledby="stats-practice-title">
                <div className="stats-section-head"><h2 id="stats-practice-title">Practice mastery</h2><Link className="text-button" href="/training">Open practice →</Link></div>
                {queueError ? <p className="error" role="alert">{queueError}</p> : practice === null ? <p className="stats-status" role="status">Loading practice…</p> : <dl className="stats-metrics stats-practice-metrics">
                  <Metric label="Mastered" value={practice.mastered} detail="Positions meeting mastery criteria" />
                  <Metric label="Due" value={practice.due} detail="Positions scheduled for review" />
                  <Metric label="In progress" value={practice.inProgress} detail="Reviewed, not yet mastered" />
                </dl>}
              </section>
            </section>
            <section className="stats-inventory-detail" aria-labelledby="stats-collection-title">
              <div className="stats-band-head">
                <p className="stats-band-kicker">Inventory detail</p>
                <h2 id="stats-collection-title">The collection</h2>
              </div>
              <section className="stats-collection" aria-label="The collection">
                <div className="stats-section-head">
                  <h2>Sources and results</h2>
                  <label className="stats-filter">Scope
                    <select value={distributionScope} onChange={(event) => setDistributionScope(event.target.value as "records" | "synced")}>
                      <option value="records">Review records ({figures.records})</option>
                      <option value="synced">Synced games ({figures.games})</option>
                    </select>
                  </label>
                </div>
                <section className="stats-sources" aria-labelledby="stats-sources-title">
                  <div className="stats-section-head"><h2 id="stats-sources-title">Where games begin</h2><span>{distribution.total} {distributionScope === "records" ? "records" : "synced games"}</span></div>
                  <div className="stats-source-grid">
                    <StatRow mark={<ProviderMark provider="manual" size={20} decorative />} label="Manual" value={distribution.manual} total={distribution.total} />
                    <StatRow mark={<ProviderMark provider="chesscom" size={20} decorative />} label="Chess.com" value={distribution.chesscom} total={distribution.total} />
                    <StatRow mark={<ProviderMark provider="lichess" size={20} decorative />} label="Lichess" value={distribution.lichess} total={distribution.total} />
                  </div>
                </section>
                <div className="stats-distributions">
                  <section className="stats-distribution" aria-labelledby="stats-results-title">
                    <div className="stats-section-head"><h2 id="stats-results-title">Results</h2><span>Account perspective</span></div>
                    {distribution.results.map(([value, count]) => <StatRow key={value} label={RESULT_LABEL[value] ?? value} value={count} total={distribution.total} />)}
                    <StatRow label="Not recorded" value={Math.max(0, distribution.total - distribution.results.reduce((sum, [, count]) => sum + count, 0))} total={distribution.total} />
                  </section>
                  <section className="stats-distribution" aria-labelledby="stats-time-title">
                    <div className="stats-section-head"><h2 id="stats-time-title">Time controls</h2><span>Saved metadata</span></div>
                    {distribution.timeClasses.map(([value, count]) => <StatRow key={value} label={value.slice(0, 1).toUpperCase() + value.slice(1)} value={count} total={distribution.total} />)}
                    <StatRow label="Not recorded" value={Math.max(0, distribution.total - distribution.timeClasses.reduce((sum, [, count]) => sum + count, 0))} total={distribution.total} />
                  </section>
                </div>
              </section>
            </section>
          </div>
        ) : null}

      </div>
    </main>
  );
}
