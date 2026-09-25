"use client";

import Link from "next/link";
import { DeskEmptyState } from "./desk-empty-state";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { TrainingQueueItemV3, UiLanguage } from "@chess-review/shared";
import { ProviderMark } from "@chess-review/ui";
import { subscribeLocalData } from "../lib/browser-storage";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { useUiLanguage } from "../hooks/use-ui-language";
import { listTrainingQueue } from "../lib/training-queue";
import { masterySummary } from "../lib/training-mastery";
import { StatsStudyPanel } from "./advanced-study/stats-study-panel";

const RESULT_RANK: Record<string, number> = { win: 0, loss: 1, draw: 2 };

type StatsCopy = {
  win: string;
  loss: string;
  draw: string;
  practiceLoadError: string;
  kicker: string;
  heading: string;
  openLibrary: string;
  retryLoading: string;
  preparing: (completed: number, total: number) => string;
  loadingLibrary: string;
  emptyTitle: string;
  emptyBody: string;
  importGame: string;
  inventory: string;
  collection: string;
  libraryTotals: string;
  records: string;
  analyzed: string;
  synced: string;
  pending: string;
  overlapNote: string;
  growth: string;
  practiceMastery: string;
  openPractice: string;
  loadingPractice: string;
  mastered: string;
  masteredDetail: string;
  due: string;
  dueDetail: string;
  inProgress: string;
  inProgressDetail: string;
  inventoryDetail: string;
  theCollection: string;
  collectionAria: string;
  sourcesAndResults: string;
  scope: string;
  reviewRecords: (n: number) => string;
  syncedGames: (n: number) => string;
  whereGamesBegin: string;
  recordsCount: (n: number) => string;
  syncedGamesCount: (n: number) => string;
  manual: string;
  results: string;
  accountPerspective: string;
  notRecorded: string;
  timeControls: string;
  savedMetadata: string;
};

const COPY: Record<UiLanguage, StatsCopy> = {
  en: {
    win: "Win",
    loss: "Loss",
    draw: "Draw",
    practiceLoadError: "Unable to load practice.",
    kicker: "Stats / Growth archive",
    heading: "Every game leaves a trace.",
    openLibrary: "Open library →",
    retryLoading: "Retry loading games",
    preparing: (completed, total) => `Preparing saved games… ${completed} / ${total}. This one-time update keeps future visits fast.`,
    loadingLibrary: "Loading library…",
    emptyTitle: "A little history starts with one game.",
    emptyBody: "Library and practice counts will appear here as you save games and study positions.",
    importGame: "Import a game →",
    inventory: "Inventory",
    collection: "Collection",
    libraryTotals: "Library totals",
    records: "records",
    analyzed: "analyzed",
    synced: "synced",
    pending: "pending",
    overlapNote: "Records and synced games overlap; they are not added together. Synced games include games not yet opened for review.",
    growth: "Growth",
    practiceMastery: "Practice mastery",
    openPractice: "Open practice →",
    loadingPractice: "Loading practice…",
    mastered: "Mastered",
    masteredDetail: "Positions meeting mastery criteria",
    due: "Due",
    dueDetail: "Positions scheduled for review",
    inProgress: "In progress",
    inProgressDetail: "Reviewed, not yet mastered",
    inventoryDetail: "Inventory detail",
    theCollection: "The collection",
    collectionAria: "The collection",
    sourcesAndResults: "Sources and results",
    scope: "Scope",
    reviewRecords: (n) => `Review records (${n})`,
    syncedGames: (n) => `Synced games (${n})`,
    whereGamesBegin: "Where games begin",
    recordsCount: (n) => `${n} records`,
    syncedGamesCount: (n) => `${n} synced games`,
    manual: "Manual",
    results: "Results",
    accountPerspective: "Account perspective",
    notRecorded: "Not recorded",
    timeControls: "Time controls",
    savedMetadata: "Saved metadata",
  },
  "zh-CN": {
    win: "胜",
    loss: "负",
    draw: "和",
    practiceLoadError: "无法加载训练。",
    kicker: "统计 / 成长档案",
    heading: "每盘对局都会留下痕迹。",
    openLibrary: "打开棋库 →",
    retryLoading: "重新加载对局",
    preparing: (completed, total) => `正在准备已保存的对局… ${completed} / ${total}。这一次更新会让以后的访问更快。`,
    loadingLibrary: "正在加载棋库…",
    emptyTitle: "一点历史，从一盘对局开始。",
    emptyBody: "当你保存对局、研究局面时，棋库和训练的计数会出现在这里。",
    importGame: "导入对局 →",
    inventory: "库存",
    collection: "收藏",
    libraryTotals: "棋库合计",
    records: "条记录",
    analyzed: "已分析",
    synced: "已同步",
    pending: "待处理",
    overlapNote: "记录与已同步对局会重叠，不能相加。已同步对局也包括尚未打开复盘的对局。",
    growth: "成长",
    practiceMastery: "训练掌握",
    openPractice: "打开训练 →",
    loadingPractice: "正在加载训练…",
    mastered: "已掌握",
    masteredDetail: "达到掌握标准的局面",
    due: "到期",
    dueDetail: "已安排复习的局面",
    inProgress: "进行中",
    inProgressDetail: "已复习，尚未掌握",
    inventoryDetail: "库存明细",
    theCollection: "收藏内容",
    collectionAria: "收藏内容",
    sourcesAndResults: "来源与结果",
    scope: "范围",
    reviewRecords: (n) => `复盘记录（${n}）`,
    syncedGames: (n) => `已同步对局（${n}）`,
    whereGamesBegin: "对局从哪里来",
    recordsCount: (n) => `${n} 条记录`,
    syncedGamesCount: (n) => `${n} 盘已同步对局`,
    manual: "手动",
    results: "结果",
    accountPerspective: "账号视角",
    notRecorded: "未记录",
    timeControls: "时间控制",
    savedMetadata: "已保存的元数据",
  },
};

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
  const copy = COPY[useUiLanguage()];
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
          setQueueError(cause instanceof Error ? cause.message : copy.practiceLoadError);
        });
    };
    load();
    const unsubscribe = subscribeLocalData(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [copy.practiceLoadError]);

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
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.heading}</h1>
        </div>
        <Link className="text-button" href="/history">{copy.openLibrary}</Link>
      </header>
      <div className="stats-stage">
        {libraryError && (
          <p className="error" role="alert">
            {libraryError}{" "}
            <button type="button" className="text-button" disabled={refreshing} onClick={() => void refresh()}>
              {copy.retryLoading}
            </button>
          </p>
        )}
        {loading ? (
          <p className="stats-status" role="status">
            {indexing
              ? copy.preparing(indexing.completed, indexing.total)
              : copy.loadingLibrary}
          </p>
        ) : empty ? (
          <div className="stats-empty"><DeskEmptyState title={copy.emptyTitle} actions={<Link className="primary-link" href="/import">{copy.importGame}</Link>}>{copy.emptyBody}</DeskEmptyState></div>
        ) : figures && distribution ? (
          <div className="stats-dashboard">
            <section className="stats-inventory" aria-labelledby="stats-inventory-title">
              <div className="stats-band-head">
                <p className="stats-band-kicker">{copy.inventory}</p>
                <h2 id="stats-inventory-title">{copy.collection}</h2>
              </div>
              <p className="stats-identity" aria-label={copy.libraryTotals}>
                <span><strong>{figures.records}</strong> {copy.records}</span>
                <span><strong>{figures.analysed}</strong> {copy.analyzed}</span>
                <span><strong>{figures.games}</strong> {copy.synced}</span>
                <span><strong>{figures.pending}</strong> {copy.pending}</span>
              </p>
              <p className="stats-panel-note">{copy.overlapNote}</p>
            </section>
            <section className="stats-growth" aria-labelledby="stats-your-game-title">
              <div className="stats-band-head">
                <p className="stats-band-kicker">{copy.growth}</p>
              </div>
              <StatsStudyPanel />
              <section className="stats-practice" aria-labelledby="stats-practice-title">
                <div className="stats-section-head"><h2 id="stats-practice-title">{copy.practiceMastery}</h2><Link className="text-button" href="/training">{copy.openPractice}</Link></div>
                {queueError ? <p className="error" role="alert">{queueError}</p> : practice === null ? <p className="stats-status" role="status">{copy.loadingPractice}</p> : <dl className="stats-metrics stats-practice-metrics">
                  <Metric label={copy.mastered} value={practice.mastered} detail={copy.masteredDetail} />
                  <Metric label={copy.due} value={practice.due} detail={copy.dueDetail} />
                  <Metric label={copy.inProgress} value={practice.inProgress} detail={copy.inProgressDetail} />
                </dl>}
              </section>
            </section>
            <section className="stats-inventory-detail" aria-labelledby="stats-collection-title">
              <div className="stats-band-head">
                <p className="stats-band-kicker">{copy.inventoryDetail}</p>
                <h2 id="stats-collection-title">{copy.theCollection}</h2>
              </div>
              <section className="stats-collection" aria-label={copy.collectionAria}>
                <div className="stats-section-head">
                  <h2>{copy.sourcesAndResults}</h2>
                  <label className="stats-filter">{copy.scope}
                    <select value={distributionScope} onChange={(event) => setDistributionScope(event.target.value as "records" | "synced")}>
                      <option value="records">{copy.reviewRecords(figures.records)}</option>
                      <option value="synced">{copy.syncedGames(figures.games)}</option>
                    </select>
                  </label>
                </div>
                <section className="stats-sources" aria-labelledby="stats-sources-title">
                  <div className="stats-section-head"><h2 id="stats-sources-title">{copy.whereGamesBegin}</h2><span>{distributionScope === "records" ? copy.recordsCount(distribution.total) : copy.syncedGamesCount(distribution.total)}</span></div>
                  <div className="stats-source-grid">
                    <StatRow mark={<ProviderMark provider="manual" size={20} decorative />} label={copy.manual} value={distribution.manual} total={distribution.total} />
                    <StatRow mark={<ProviderMark provider="chesscom" size={20} decorative />} label="Chess.com" value={distribution.chesscom} total={distribution.total} />
                    <StatRow mark={<ProviderMark provider="lichess" size={20} decorative />} label="Lichess" value={distribution.lichess} total={distribution.total} />
                  </div>
                </section>
                <div className="stats-distributions">
                  <section className="stats-distribution" aria-labelledby="stats-results-title">
                    <div className="stats-section-head"><h2 id="stats-results-title">{copy.results}</h2><span>{copy.accountPerspective}</span></div>
                    {distribution.results.map(([value, count]) => <StatRow key={value} label={value === "win" ? copy.win : value === "loss" ? copy.loss : value === "draw" ? copy.draw : value} value={count} total={distribution.total} />)}
                    <StatRow label={copy.notRecorded} value={Math.max(0, distribution.total - distribution.results.reduce((sum, [, count]) => sum + count, 0))} total={distribution.total} />
                  </section>
                  <section className="stats-distribution" aria-labelledby="stats-time-title">
                    <div className="stats-section-head"><h2 id="stats-time-title">{copy.timeControls}</h2><span>{copy.savedMetadata}</span></div>
                    {distribution.timeClasses.map(([value, count]) => <StatRow key={value} label={value.slice(0, 1).toUpperCase() + value.slice(1)} value={count} total={distribution.total} />)}
                    <StatRow label={copy.notRecorded} value={Math.max(0, distribution.total - distribution.timeClasses.reduce((sum, [, count]) => sum + count, 0))} total={distribution.total} />
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
