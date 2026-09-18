"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { Icon, type IconName } from "@chess-review/ui";
import { subscribeLocalData } from "../lib/browser-storage";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { listTrainingQueue } from "../lib/training-queue";
import { masterySummary } from "../lib/training-mastery";

const RESULT_LABEL: Record<string, string> = { win: "Win", loss: "Loss", draw: "Draw" };
const RESULT_RANK: Record<string, number> = { win: 0, loss: 1, draw: 2 };

function StatRow({ icon, label, value }: { icon: IconName; label: string; value: number | string }) {
  return (
    <div className="stats-row">
      <Icon name={icon} />
      <strong>{label}</strong>
      <span className="stats-row-meta">{value}</span>
    </div>
  );
}

export function StatsPage() {
  const { snapshot, error: libraryError, loading: refreshing, indexing, refresh } = useLibrarySnapshot();
  const [queue, setQueue] = useState<TrainingQueueItemV3[] | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const loading = refreshing && !snapshot;
  const empty = !loading && !libraryError && (snapshot?.records.length ?? 0) === 0;

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
    let manual = 0;
    let chesscom = 0;
    let lichess = 0;
    const timeClasses = new Map<string, number>();
    const results = new Map<string, number>();
    for (const record of records) {
      if (statuses.get(record.id)?.analyzed) analysed += 1;
      else if (record.kind === "pgn") pending += 1;
      const provider = record.external?.provider ?? "manual";
      if (provider === "chesscom") chesscom += 1;
      else if (provider === "lichess") lichess += 1;
      else manual += 1;
      if (record.sourceTimeClass) {
        timeClasses.set(record.sourceTimeClass, (timeClasses.get(record.sourceTimeClass) ?? 0) + 1);
      }
      if (record.sourceResult) {
        results.set(record.sourceResult, (results.get(record.sourceResult) ?? 0) + 1);
      }
    }
    return {
      records: records.length,
      games: games.length,
      analysed,
      pending,
      manual,
      chesscom,
      lichess,
      timeClasses: [...timeClasses.entries()].sort(([left], [right]) => left.localeCompare(right)),
      results: [...results.entries()].sort(([left], [right]) => (RESULT_RANK[left] ?? 3) - (RESULT_RANK[right] ?? 3) || left.localeCompare(right)),
    };
  }, [snapshot]);

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
      <section className="page-head">
        <span className="page-kicker">Open Chess Review</span>
        <h1 className="page-display">What the library says.</h1>
        <p className="page-lede">Counts from what this browser has saved.</p>
      </section>
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
          <section className="stats-panel paper-panel">
            <h2>Nothing to summarise yet</h2>
            <p className="stats-panel-note">Import a game to start a library.</p>
            <div className="stats-empty-links">
              <Link href="/import">Import a game</Link>
              <Link href="/">Home</Link>
            </div>
          </section>
        ) : figures ? (
          <>
            <section className="stats-panel paper-panel">
              <h2>Library</h2>
              <div className="stats-rows">
                <StatRow icon="library" label="Records" value={figures.records} />
                <StatRow icon="book" label="Games" value={figures.games} />
                <StatRow icon="review" label="Analyzed" value={figures.analysed} />
                <StatRow icon="question" label="Pending" value={figures.pending} />
              </div>
            </section>
            <section className="stats-panel paper-panel">
              <h2>Sources</h2>
              <div className="stats-rows">
                <StatRow icon="import" label="Manual" value={figures.manual} />
                <StatRow icon="import" label="Chess.com" value={figures.chesscom} />
                <StatRow icon="import" label="Lichess" value={figures.lichess} />
              </div>
              {figures.timeClasses.length > 0 && (
                <div className="stats-group">
                  <h3>Time class</h3>
                  <div className="stats-rows">
                    {figures.timeClasses.map(([value, count]) => (
                      <StatRow key={value} icon="moves" label={value.slice(0, 1).toUpperCase() + value.slice(1)} value={count} />
                    ))}
                  </div>
                </div>
              )}
              {figures.results.length > 0 && (
                <div className="stats-group">
                  <h3>Result</h3>
                  <div className="stats-rows">
                    {figures.results.map(([value, count]) => (
                      <StatRow key={value} icon="stats" label={RESULT_LABEL[value] ?? value} value={count} />
                    ))}
                  </div>
                </div>
              )}
            </section>
            <section className="stats-panel paper-panel">
              <h2>Practice</h2>
              {queueError ? (
                <p className="error" role="alert">{queueError}</p>
              ) : practice === null ? (
                <p className="stats-status" role="status">Loading practice…</p>
              ) : (
                <div className="stats-rows">
                  <StatRow icon="practice" label="Mastered" value={practice.mastered} />
                  <StatRow icon="evidence" label="Due" value={practice.due} />
                  <StatRow icon="book" label="In progress" value={practice.inProgress} />
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
