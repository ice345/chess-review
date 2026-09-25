"use client";

import Link from "next/link";
import type { StudyWeaknessKind, UiLanguage } from "@chess-review/shared";
import { ProviderMark, QualityIcon, phaseLabel, qualityLabel } from "@chess-review/ui";
import { decisionReviewHref, trainingQueueItemId } from "../../lib/training-queue";
import { useStatsStudy } from "../../hooks/use-stats-study";
import { useUiLanguage } from "../../hooks/use-ui-language";
import { trainingTitle } from "../training-queue-panel";
import { HistoryAnalysisControls, HistoryJobsPanel } from "./history-jobs";
import { ScopeFilters } from "./scope-filters";
import { NAV_GROUPS, formatted, type StudyTab } from "./study-helpers";

type StatsCopy = {
  yourGame: string;
  howYouPlay: string;
  loading: string;
  analyzeToSee: string;
  loadingPlayer: string;
  analyseImported: string;
  unanalyzed: (n: number, total: number) => string;
  viewsAria: string;
  navGroup: Record<"analysis" | "improvement" | "data", string>;
  navTab: Record<Exclude<StudyTab, "middlegame" | "endgame">, string>;
  playerProfile: string;
  objectiveProfile: string;
  viewRatingForm: string;
  currentRating: string;
  recentRange: (low: number, high: number) => string;
  noPlatformRating: string;
  form: string;
  accuracyTrend: (avg: string) => string;
  nextTarget: string;
  stabilize: (a: number, b: number) => string;
  buildSample: string;
  analysisCoverage: string;
  noGamesInScope: string;
  currentConfidence: (rate: string, conf: string) => string;
  estimatedPerformance: (rating: number, n: number | undefined) => string;
  strongestPhase: string;
  primaryImprovement: string;
  movesCount: (n: number) => string;
  averageMoveAccuracy: string;
  advantagesPreservedPct: (n: number) => string;
  decisionErrors: (rate: string) => string;
  errorsRate: (rate: string) => string;
  focusNow: string;
  openPlan: string;
  plyRef: (san: string, ply: number) => string;
  keepCollecting: string;
  highlights: string;
  viewHighlights: string;
  brilliant: string;
  critical: string;
  comebacks: string;
  cleanConversions: string;
  games: string;
  accuracyPerGame: string;
  coverage: string;
  resultLegend: string;
  wWin: string;
  dDraw: string;
  lLoss: string;
  chartAria: string;
  pointAria: (title: string, result: string, accuracy: string) => string;
  resultWin: string;
  resultDraw: string;
  resultLoss: string;
  unknownResult: string;
  ratingForm: string;
  ratingIntro: string;
  noRatingEvidence: string;
  noRecentRange: string;
  gamesConfidence: (n: number, conf: string) => string;
  estimatedRecent: string;
  matchedSample: (n: number) => string;
  score: string;
  accuracyValue: (n: string) => string;
  needLargerSample: string;
  openings: string;
  openingsIntro: string;
  noOpenings: string;
  gamesWdl: (games: number, w: number, d: number, l: number) => string;
  accuracy: string;
  recent: string;
  winPercentLoss: string;
  errors: string;
  showMoreOpenings: string;
  endgameIntro: string;
  middlegameIntro: string;
  decisionQuality: string;
  moves: string;
  errorRate: string;
  averageWinPercentLoss: string;
  decisionErrorsLabel: string;
  recentForm: string;
  averageMoveAccuracyLabel: string;
  recentAverageMoveAccuracy: string;
  accuracyMean: (moves: number, games: number) => string;
  conversion: string;
  advantages: string;
  advantagesPreserved: string;
  defensiveHolds: string;
  missedWinsMates: string;
  opportunities: string;
  missedOpportunities: string;
  review: string;
  winPercent: (n: string) => string;
  mistakes: string;
  mistakesIntro: string;
  noErrors: string;
  showMoreMistakes: string;
  highlightsIntro: string;
  noHighlights: string;
  noneInPopulation: string;
  openInReview: string;
  viewMoreCritical: string;
  highlightKind: Record<"comeback" | "save" | "clean-conversion" | "best-game", string>;
  accuracyHighlight: (n: string) => string;
  open: string;
  plan: string;
  planIntro: string;
  noWeakness: string;
  ofGames: (rate: string) => string;
  confidenceWord: (level: string) => string;
  inQueue: string;
  addToQueue: string;
  weaknessDescription: Record<StudyWeaknessKind, string>;
  eligible: string;
  current: string;
  stale: string;
  failed: string;
  currentFrac: (a: number, e: number) => string;
  staleFailed: (stale: number, failed: number) => string;
  coverageEmpty: string;
  coveragePartial: string;
  coverageComplete: (analyzed: number, eligible: number) => string;
  coverageExcluded: (n: number) => string;
  coverageOpeningNote: string;
  localCache: (mb: string) => string;
  accountScope: string;
  allAccounts: string;
  selectedAccount: string;
  confidence: Record<"low" | "medium" | "high", string>;
  trend: Record<"improving" | "stable" | "worsening", string>;
};

const COPY: Record<UiLanguage, StatsCopy> = {
  en: {
    yourGame: "Your game",
    howYouPlay: "How you play, from the games this browser has analyzed.",
    loading: "Loading…",
    analyzeToSee: "Analyze a game to see how you play.",
    loadingPlayer: "Loading selected player…",
    analyseImported: "Analyse imported games",
    unanalyzed: (n, total) => `${n} of ${total} imported games in this scope have no objective analysis yet.`,
    viewsAria: "Your game views",
    navGroup: { analysis: "Analysis", improvement: "Improvement", data: "Data" },
    navTab: {
      overview: "Overview",
      ratings: "Rating",
      openings: "Openings",
      mistakes: "Mistakes",
      highlights: "Highlights",
      plan: "Plan",
      coverage: "Coverage",
    },
    playerProfile: "Player profile",
    objectiveProfile: "Objective analysis profile",
    viewRatingForm: "View rating & form →",
    currentRating: "Current observed rating",
    recentRange: (low, high) => `Recent range ${low}–${high}`,
    noPlatformRating: "No platform rating in this scope",
    form: "Form",
    accuracyTrend: (avg) => `Accuracy trend · ${avg} average per game`,
    nextTarget: "Next meaningful target",
    stabilize: (a, b) => `Stabilize ${a} · then ${b}`,
    buildSample: "Build a larger rated sample",
    analysisCoverage: "Analysis coverage",
    noGamesInScope: "No games in this scope",
    currentConfidence: (rate, conf) => `${rate} current · ${conf} confidence`,
    estimatedPerformance: (rating, n) => `Estimated recent performance ${rating} from ${n} games with both opponent rating and result.`,
    strongestPhase: "Strongest phase",
    primaryImprovement: "Primary improvement area",
    movesCount: (n) => `${n} moves`,
    averageMoveAccuracy: " · average move Accuracy",
    advantagesPreservedPct: (n) => `${n}% advantages preserved`,
    decisionErrors: (rate) => `${rate} decision errors`,
    errorsRate: (rate) => `${rate} errors`,
    focusNow: "Focus now",
    openPlan: "Open plan →",
    plyRef: (san, ply) => `${san} · ply ${ply}`,
    keepCollecting: "Keep collecting analyzed games to establish a reliable training focus.",
    highlights: "Highlights",
    viewHighlights: "View Highlights →",
    brilliant: "Brilliant",
    critical: "Critical",
    comebacks: "Comebacks",
    cleanConversions: "Clean conversions",
    games: "Games",
    accuracyPerGame: "Accuracy per game",
    coverage: "Coverage",
    resultLegend: "Result under each bar: ",
    wWin: "W win",
    dDraw: "D draw",
    lLoss: "L loss",
    chartAria: "Accuracy by game, with win, draw, or loss under each bar",
    pointAria: (title, result, accuracy) => `${title}, ${result}, Accuracy ${accuracy}`,
    resultWin: "win",
    resultDraw: "draw",
    resultLoss: "loss",
    unknownResult: "unknown result",
    ratingForm: "Rating & Form",
    ratingIntro: "Platform rating and time controls stay separate. Performance is an estimate, never derived from Accuracy.",
    noRatingEvidence: "No rating evidence in this population.",
    noRecentRange: "No recent range",
    gamesConfidence: (n, conf) => `${n} games · ${conf} confidence`,
    estimatedRecent: "Estimated recent performance",
    matchedSample: (n) => `Matched sample ${n}`,
    score: "Score",
    accuracyValue: (n) => `Accuracy ${n}`,
    needLargerSample: "Need a larger rated sample",
    openings: "Openings",
    openingsIntro: "What you play, and how well you play it.",
    noOpenings: "No recognized openings.",
    gamesWdl: (games, w, d, l) => `${games} games · ${w}W ${d}D ${l}L`,
    accuracy: "Accuracy",
    recent: "Recent",
    winPercentLoss: "Win% loss",
    errors: "Errors",
    showMoreOpenings: "Show more openings",
    endgameIntro: "How well you convert and defend late positions. No tablebase claims.",
    middlegameIntro: "How good your decisions are after the opening.",
    decisionQuality: "Decision quality",
    moves: "Moves",
    errorRate: "Error rate",
    averageWinPercentLoss: "Average Win% loss",
    decisionErrorsLabel: "Decision errors",
    recentForm: "Recent form",
    averageMoveAccuracyLabel: "Average move Accuracy",
    recentAverageMoveAccuracy: "Recent average move Accuracy",
    accuracyMean: (moves, games) => `Arithmetic mean of ${moves} moves from ${games} games. Review shows the canonical single-game phase Accuracy, which is a different measure.`,
    conversion: "Conversion",
    advantages: "Advantages",
    advantagesPreserved: "Advantages preserved",
    defensiveHolds: "Defensive holds",
    missedWinsMates: "Missed wins / mates",
    opportunities: "Opportunities",
    missedOpportunities: "Missed opportunities",
    review: "Review →",
    winPercent: (n) => `−${n} Win%`,
    mistakes: "Mistakes",
    mistakesIntro: "Which decisions deserve review.",
    noErrors: "No errors in this population.",
    showMoreMistakes: "Show more mistakes",
    highlightsIntro: "Notable chess moments, grouped by kind.",
    noHighlights: "No verified highlights in this population.",
    noneInPopulation: "None in this population.",
    openInReview: "Open in Review →",
    viewMoreCritical: "View more critical moments",
    highlightKind: {
      comeback: "comeback",
      save: "save",
      "clean-conversion": "clean conversion",
      "best-game": "best game",
    },
    accuracyHighlight: (n) => `${n} Accuracy`,
    open: "Open →",
    plan: "Plan",
    planIntro: "Ranked from measurable source positions.",
    noWeakness: "No recurring weakness has enough evidence yet.",
    ofGames: (rate) => `${rate} of games`,
    confidenceWord: (level) => `${level} confidence`,
    inQueue: "In queue",
    addToQueue: "Add to queue",
    weaknessDescription: {
      "opening-decisions": "Repeated objective errors in opening positions.",
      "middlegame-decisions": "Repeated objective errors in middlegame positions.",
      "endgame-decisions": "Repeated objective errors after the structural endgame boundary.",
      "missed-opportunities": "Repeated verified missed-win or missed-mate evidence.",
    },
    eligible: "Eligible",
    current: "Current",
    stale: "Stale",
    failed: "Failed",
    currentFrac: (a, e) => `${a}/${e} current`,
    staleFailed: (stale, failed) => `${stale} stale · ${failed} failed`,
    coverageEmpty: "No imported games match this scope yet, so there is nothing to cover.",
    coveragePartial: "This report is partial. Conclusions use only current compatible analyses.",
    coverageComplete: (analyzed, eligible) => `This filtered population has complete current analysis coverage: ${analyzed} of ${eligible} games.`,
    coverageExcluded: (n) => ` ${n} provider game${n === 1 ? "" : "s"} with invalid PGN ${n === 1 ? "is" : "are"} excluded and do not keep this range incomplete.`,
    coverageOpeningNote: " Opening is known only for current analyses, so coverage remains based on the broader synced scope.",
    localCache: (mb) => ` Local objective cache: ${mb} MB.`,
    accountScope: "Account scope",
    allAccounts: "All connected accounts",
    selectedAccount: "Selected account",
    confidence: { low: "low", medium: "medium", high: "high" },
    trend: { improving: "improving", stable: "stable", worsening: "worsening" },
  },
  "zh-CN": {
    yourGame: "你的棋",
    howYouPlay: "根据此浏览器已分析的对局，看你怎么下棋。",
    loading: "加载中…",
    analyzeToSee: "分析一盘对局，看看你怎么下棋。",
    loadingPlayer: "正在加载所选棋手…",
    analyseImported: "分析已导入的对局",
    unanalyzed: (n, total) => `此范围内 ${total} 盘已导入对局中，有 ${n} 盘尚未完成客观分析。`,
    viewsAria: "你的棋局视图",
    navGroup: { analysis: "分析", improvement: "提升", data: "数据" },
    navTab: {
      overview: "总览",
      ratings: "等级分",
      openings: "开局",
      mistakes: "失误",
      highlights: "亮点",
      plan: "计划",
      coverage: "覆盖",
    },
    playerProfile: "棋手档案",
    objectiveProfile: "客观分析档案",
    viewRatingForm: "查看等级分与状态 →",
    currentRating: "当前观察到的等级分",
    recentRange: (low, high) => `近期区间 ${low}–${high}`,
    noPlatformRating: "此范围内没有平台等级分",
    form: "状态",
    accuracyTrend: (avg) => `准确率趋势 · 每盘平均 ${avg}`,
    nextTarget: "下一个有意义的目标",
    stabilize: (a, b) => `先稳住 ${a} · 再冲 ${b}`,
    buildSample: "积累更多计分样本",
    analysisCoverage: "分析覆盖",
    noGamesInScope: "此范围内没有对局",
    currentConfidence: (rate, conf) => `${rate} 当前 · ${conf}把握`,
    estimatedPerformance: (rating, n) => `根据 ${n} 盘同时有对手等级分和结果的对局，估计近期表现为 ${rating}。`,
    strongestPhase: "最强阶段",
    primaryImprovement: "主要改进方向",
    movesCount: (n) => `${n} 着`,
    averageMoveAccuracy: " · 平均着法准确率",
    advantagesPreservedPct: (n) => `保住优势 ${n}%`,
    decisionErrors: (rate) => `${rate} 决定错误`,
    errorsRate: (rate) => `${rate} 错误`,
    focusNow: "现在的重点",
    openPlan: "打开计划 →",
    plyRef: (san, ply) => `${san} · 半回合 ${ply}`,
    keepCollecting: "继续收集已分析的对局，才能形成可靠的训练重点。",
    highlights: "亮点",
    viewHighlights: "查看亮点 →",
    brilliant: "精彩",
    critical: "关键",
    comebacks: "逆转",
    cleanConversions: "干净兑现",
    games: "对局",
    accuracyPerGame: "每盘准确率",
    coverage: "覆盖",
    resultLegend: "每根柱下的结果：",
    wWin: "W 胜",
    dDraw: "D 和",
    lLoss: "L 负",
    chartAria: "按对局的准确率，柱下为胜、和或负",
    pointAria: (title, result, accuracy) => `${title}，${result}，准确率 ${accuracy}`,
    resultWin: "胜",
    resultDraw: "和",
    resultLoss: "负",
    unknownResult: "未知结果",
    ratingForm: "等级分与状态",
    ratingIntro: "平台等级分和时限分开统计。表现分是估计，从不由准确率推导。",
    noRatingEvidence: "此范围内没有等级分证据。",
    noRecentRange: "没有近期区间",
    gamesConfidence: (n, conf) => `${n} 盘对局 · ${conf}把握`,
    estimatedRecent: "估计的近期表现",
    matchedSample: (n) => `匹配样本 ${n}`,
    score: "得分",
    accuracyValue: (n) => `准确率 ${n}`,
    needLargerSample: "需要更大的计分样本",
    openings: "开局",
    openingsIntro: "你下什么，以及下得怎样。",
    noOpenings: "没有识别出的开局。",
    gamesWdl: (games, w, d, l) => `${games} 盘 · ${w}胜 ${d}和 ${l}负`,
    accuracy: "准确率",
    recent: "近期",
    winPercentLoss: "胜率损失",
    errors: "错误",
    showMoreOpenings: "显示更多开局",
    endgameIntro: "残局中你兑现和防守得怎样。不做残局库断言。",
    middlegameIntro: "开局之后，你的决定质量如何。",
    decisionQuality: "决定质量",
    moves: "着法",
    errorRate: "错误率",
    averageWinPercentLoss: "平均胜率损失",
    decisionErrorsLabel: "决定错误",
    recentForm: "近期状态",
    averageMoveAccuracyLabel: "平均着法准确率",
    recentAverageMoveAccuracy: "近期平均着法准确率",
    accuracyMean: (moves, games) => `${games} 盘对局中 ${moves} 着的算术平均。复盘显示的是单局阶段准确率，那是另一种度量。`,
    conversion: "兑现",
    advantages: "优势",
    advantagesPreserved: "保住的优势",
    defensiveHolds: "守住的局面",
    missedWinsMates: "错过的胜机 / 杀棋",
    opportunities: "机会",
    missedOpportunities: "错过的机会",
    review: "复盘 →",
    winPercent: (n) => `−${n} 胜率`,
    mistakes: "失误",
    mistakesIntro: "哪些决定值得复盘。",
    noErrors: "此范围内没有错误。",
    showMoreMistakes: "显示更多失误",
    highlightsIntro: "按种类分组的显著棋局瞬间。",
    noHighlights: "此范围内没有已验证的亮点。",
    noneInPopulation: "此范围内没有。",
    openInReview: "在复盘中打开 →",
    viewMoreCritical: "查看更多关键瞬间",
    highlightKind: {
      comeback: "逆转",
      save: "挽回",
      "clean-conversion": "干净兑现",
      "best-game": "最佳对局",
    },
    accuracyHighlight: (n) => `${n} 准确率`,
    open: "打开 →",
    plan: "计划",
    planIntro: "按可计量的源局面排序。",
    noWeakness: "还没有足够证据的反复弱点。",
    ofGames: (rate) => `占对局 ${rate}`,
    confidenceWord: (level) => `${level}把握`,
    inQueue: "已在队列",
    addToQueue: "加入队列",
    weaknessDescription: {
      "opening-decisions": "开局局面中反复出现的客观错误。",
      "middlegame-decisions": "中局局面中反复出现的客观错误。",
      "endgame-decisions": "进入结构性残局之后反复出现的客观错误。",
      "missed-opportunities": "反复出现、已验证的错过胜机或错过杀棋证据。",
    },
    eligible: "符合条件",
    current: "当前",
    stale: "过期",
    failed: "失败",
    currentFrac: (a, e) => `${a}/${e} 当前`,
    staleFailed: (stale, failed) => `${stale} 过期 · ${failed} 失败`,
    coverageEmpty: "还没有已导入对局符合此范围，因此没有可覆盖的内容。",
    coveragePartial: "这份报告是部分的。结论只使用当前兼容的分析。",
    coverageComplete: (analyzed, eligible) => `此筛选范围的当前分析覆盖完整：${analyzed} / ${eligible} 盘对局。`,
    coverageExcluded: (n) => ` ${n} 盘平台对局因 PGN 无效被排除，不会让此范围保持不完整。`,
    coverageOpeningNote: " 开局只对当前分析可知，因此覆盖仍基于更宽的同步范围。",
    localCache: (mb) => ` 本地客观缓存：${mb} MB。`,
    accountScope: "账号范围",
    allAccounts: "全部已连接账号",
    selectedAccount: "所选账号",
    confidence: { low: "低", medium: "中", high: "高" },
    trend: { improving: "在进步", stable: "稳定", worsening: "在退步" },
  },
};

function confLabel(copy: StatsCopy, value: string | undefined): string {
  if (value === "low" || value === "medium" || value === "high") return copy.confidence[value];
  return value ?? copy.confidence.low;
}

/** Stats Growth band: ratings / openings / mistakes inventory≠growth report. */
export function StatsStudyPanel() {
  const language = useUiLanguage();
  const copy = COPY[language];
  const study = useStatsStudy();
  const {
    player,
    accounts,
    syncedGames,
    filters,
    setFilters,
    scopeOpen,
    setScopeOpen,
    activeTab,
    selectView,
    listLimit,
    setListLimit,
    freshness,
    setFreshness,
    jobAccountScope,
    setJobAccountScope,
    cacheBytes,
    workingItem,
    jobWorking,
    notice,
    timeClasses,
    openingOptions,
    selectedAccountIds,
    eligibleSynced,
    historyJobGroups,
    startHistoryAnalysis,
    controlJob,
    removeHistoryRun,
    clearFinishedRuns,
    addWeakness,
    loading,
    analysisStatus,
    scopeGameCount,
    report,
    queueIds,
    playerSelect,
    showStudyReport,
    showRunHistory,
    canAnalyzeHistory,
    unanalyzedEligibleCount,
    summaries,
    primaryRating,
    observedPhases,
    strongestPhase,
    needsWorkPhase,
    highlightCounts,
    brilliantMoves,
    criticalMoves,
  } = study;

  return (
    <section className="study-report-section" aria-labelledby="stats-your-game-title">
      <header className="study-report-heading">
        <div>
          <h2 id="stats-your-game-title">{copy.yourGame}</h2>
          <p>{copy.howYouPlay}</p>
        </div>
        {playerSelect}
      </header>
      {analysisStatus && <p className="study-analysis-status" role="status">{analysisStatus}</p>}
      {notice && <p className="study-notice" role="status">{notice}</p>}
      {loading ? <section className="study-empty">{copy.loading}</section> : (summaries?.length ?? 0) === 0 ? (
        <section className="study-empty">{copy.analyzeToSee}</section>
      ) : player === null ? (
        <section className="study-empty">{copy.loadingPlayer}</section>
      ) : !showStudyReport ? (showRunHistory || canAnalyzeHistory ? <section className="study-runs-only">
        {canAnalyzeHistory && <>
          <div className="history-analysis-heading"><span>{copy.analyseImported}</span></div>
          <p className="quiet-empty">{copy.unanalyzed(unanalyzedEligibleCount, eligibleSynced.length)}</p>
          <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={() => startHistoryAnalysis(player?.accountId ? [player.accountId] : selectedAccountIds)} /></div>
        </>}
        {showRunHistory && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}
      </section> : null) : <>
      <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} gameCount={scopeGameCount} open={scopeOpen} onToggle={setScopeOpen} />
      <div className="study-notebook-body">
      <nav className="study-nav study-nav-quiet" aria-label={copy.viewsAria}>
        {NAV_GROUPS.map((group) => <div key={group.id} className="study-nav-group">{group.id !== "overview" ? <p className="study-nav-label">{copy.navGroup[group.id as "analysis" | "improvement" | "data"]}</p> : <p className="study-nav-label study-nav-label-spacer" aria-hidden="true"> </p>}<div className="study-nav-tabs">{group.tabs.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => selectView(tab.id)}>{tab.id === "middlegame" || tab.id === "endgame" ? phaseLabel(tab.id, language) : copy.navTab[tab.id as Exclude<StudyTab, "middlegame" | "endgame">]}</button>)}</div></div>)}
      </nav>
      {!player || !report ? <section className="study-empty">{copy.loadingPlayer}</section> : <div className="study-sections">
        {activeTab === "overview" && <section className="study-overview" id="player-profile">
          <article className="study-paper study-profile">
            <header className="study-profile-heading">
              <div>
                <span className="eyebrow">{copy.playerProfile}</span>
                <h2>{player.name}</h2>
                <p className="study-profile-source">
                  {primaryRating ? (
                    <>
                      <ProviderMark provider={primaryRating.provider} decorative />
                      {primaryRating.provider === "chesscom" ? "Chess.com" : "Lichess"} · {primaryRating.timeClass}
                    </>
                  ) : copy.objectiveProfile}
                </p>
              </div>
              <button type="button" className="text-button" onClick={() => selectView("ratings")}>{copy.viewRatingForm}</button>
            </header>
            <dl className="study-profile-facts">
              <div><dt>{copy.currentRating}</dt><dd>{primaryRating?.currentRating ?? "—"}</dd><small>{primaryRating?.recentRange ? copy.recentRange(primaryRating.recentRange.low, primaryRating.recentRange.high) : copy.noPlatformRating}</small></div>
              <div><dt>{copy.form}</dt><dd>{report.overview.summary.accuracyChange === undefined ? "—" : `${report.overview.summary.accuracyChange >= 0 ? "+" : ""}${report.overview.summary.accuracyChange.toFixed(1)}`}</dd><small>{copy.accuracyTrend(formatted(report.overview.summary.averageAccuracy))}</small></div>
              <div><dt>{copy.nextTarget}</dt><dd>{primaryRating?.stabilizeTarget ?? primaryRating?.nextTarget ?? "—"}</dd><small>{primaryRating?.stabilizeTarget && primaryRating.nextTarget ? copy.stabilize(primaryRating.stabilizeTarget, primaryRating.nextTarget) : copy.buildSample}</small></div>
              <div><dt>{copy.analysisCoverage}</dt><dd>{report.coverage.state === "empty" ? "—" : `${report.coverage.analyzedGames}/${report.coverage.eligibleGames}`}</dd><small>{report.coverage.state === "empty" ? copy.noGamesInScope : copy.currentConfidence(formatted(report.coverage.coverageRate, "%"), confLabel(copy, primaryRating?.confidence))}</small></div>
            </dl>
            {primaryRating?.performanceRating !== undefined && <p className="study-profile-note">{copy.estimatedPerformance(primaryRating.performanceRating, primaryRating.performanceSampleSize)}</p>}
          </article>
          {observedPhases.length > 0 && <div className="study-phase-row">
            {observedPhases.map(({ phase, profile }) => {
              const strongest = observedPhases.length > 1 && strongestPhase?.phase === phase;
              const focus = observedPhases.length > 1 && needsWorkPhase?.phase === phase && !strongest;
              const wash = phase === "opening" ? "mist" : phase === "middlegame" ? "pink" : "sage";
              const conversion = profile.advantageOpportunities > 0 ? Math.round((100 * profile.advantagePreserved) / profile.advantageOpportunities) : undefined;
              const detail = phase === "endgame" && conversion !== undefined
                ? copy.advantagesPreservedPct(conversion)
                : phase === "middlegame"
                  ? copy.decisionErrors(formatted(profile.errorRate, "%"))
                  : copy.errorsRate(formatted(profile.errorRate, "%"));
              return <article key={phase} className="study-wash" data-wash={wash}><span className="eyebrow">{phaseLabel(phase, language)}</span><strong>{formatted(profile.averageAccuracy)}</strong><small>{strongest ? copy.strongestPhase : focus ? copy.primaryImprovement : copy.movesCount(profile.moveCount)}{copy.averageMoveAccuracy}</small><p>{detail}</p></article>;
            })}
          </div>}
          <article className="study-paper study-focus">
            <header><span className="eyebrow">{copy.focusNow}</span><button type="button" className="text-button" onClick={() => selectView("plan")}>{copy.openPlan}</button></header>
            {report.trainingPlan.length > 0 ? <ol>{report.trainingPlan.slice(0, 3).map((item) => <li key={item.weaknessKind}><strong>{item.title}</strong><small>{item.rationale}</small>{item.evidence[0] && <Link href={decisionReviewHref(item.evidence[0])}>{copy.plyRef(item.evidence[0].san, item.evidence[0].ply)}</Link>}</li>)}</ol> : <p>{copy.keepCollecting}</p>}
          </article>
          <article className="study-highlights-summary">
            <header><span className="eyebrow">{copy.highlights}</span><button type="button" className="text-button" onClick={() => selectView("highlights")}>{copy.viewHighlights}</button></header>
            <p><span><strong>{highlightCounts?.brilliant ?? 0}</strong> {copy.brilliant}</span><span><strong>{highlightCounts?.critical ?? 0}</strong> {copy.critical}</span><span><strong>{highlightCounts?.comebacks ?? 0}</strong> {copy.comebacks}</span><span><strong>{highlightCounts?.conversions ?? 0}</strong> {copy.cleanConversions}</span></p>
          </article>
          <div className="study-form-summary">
            <div className="study-form-heading">
              <p className="study-ink-stats">
                <span><strong>{report.overview.summary.gameCount}</strong> {copy.games}</span>
                <span><strong>{formatted(report.overview.summary.averageAccuracy)}</strong> {copy.accuracyPerGame}</span>
                <span><strong>{report.coverage.state === "empty" ? "—" : formatted(report.coverage.coverageRate, "%")}</strong> {copy.coverage}</span>
              </p>
              <p className="study-trend-legend">{copy.resultLegend}<span data-result="win">{copy.wWin}</span><span data-result="draw">{copy.dDraw}</span><span data-result="loss">{copy.lLoss}</span></p>
            </div>
            <ol className="study-trend-chart" aria-label={copy.chartAria}>{report.overview.games.slice(-18).map((point) => <li key={point.gameId} data-result={point.result}><span className="trend-track"><i style={{ height: `${Math.max(2, point.accuracy ?? 0)}%` }} /></span><Link href={`/review/${point.gameId}`} aria-label={copy.pointAria(point.title, point.result === "win" ? copy.resultWin : point.result === "draw" ? copy.resultDraw : point.result === "loss" ? copy.resultLoss : copy.unknownResult, formatted(point.accuracy))}>{point.result === "win" ? "W" : point.result === "draw" ? "D" : point.result === "loss" ? "L" : ""}</Link></li>)}</ol>
          </div>
        </section>}

        {activeTab === "ratings" && <section id="rating-form"><header className="study-section-heading"><h2>{copy.ratingForm}</h2><small>{copy.ratingIntro}</small></header>{report.ratings.length === 0 ? <p className="study-section-empty">{copy.noRatingEvidence}</p> : report.ratings.map((band) => <article key={band.key} className="study-paper study-rating-band"><span className="eyebrow">{band.provider === "chesscom" ? "Chess.com" : "Lichess"} · {band.timeClass}</span><strong className="study-rating-primary">{band.currentRating ?? "—"}</strong><p>{band.recentRange ? copy.recentRange(band.recentRange.low, band.recentRange.high) : copy.noRecentRange} · {copy.gamesConfidence(band.sampleSize, confLabel(copy, band.confidence))}</p><dl className="study-profile-facts"><div><dt>{copy.estimatedRecent}</dt><dd>{band.performanceRating ?? "—"}</dd><small>{copy.matchedSample(band.performanceSampleSize)}</small></div><div><dt>{copy.score}</dt><dd>{formatted(report.overview.scoreRate, "%")}</dd><small>{copy.accuracyValue(formatted(report.overview.summary.averageAccuracy))}</small></div><div><dt>{copy.nextTarget}</dt><dd>{band.stabilizeTarget ?? band.nextTarget ?? "—"}</dd><small>{band.stabilizeTarget && band.nextTarget ? copy.stabilize(band.stabilizeTarget, band.nextTarget) : copy.needLargerSample}</small></div></dl></article>)}</section>}

        {activeTab === "openings" && <section id="openings"><header className="study-section-heading"><h2>{copy.openings}</h2><small>{copy.openingsIntro}</small></header>{report.openings.length === 0 ? <p className="study-section-empty">{copy.noOpenings}</p> : <><div className="repertoire-list">{report.openings.slice(0, listLimit).map((opening) => <article key={opening.key}><span className={`repertoire-color ${opening.color}`}>{opening.color === "white" ? "W" : "B"}</span><div><small>{opening.eco} · {formatted(opening.share, "%")}</small><strong>{opening.name}</strong>{opening.variation && <span>{opening.variation}</span>}<span>{copy.gamesWdl(opening.gameCount, opening.wins, opening.draws, opening.losses)}</span></div><dl><div><dt>{copy.accuracy}</dt><dd>{formatted(opening.averageAccuracy)}</dd></div><div><dt>{copy.recent}</dt><dd>{formatted(opening.recentAccuracy)}</dd></div><div><dt>{copy.winPercentLoss}</dt><dd>{formatted(opening.averageWinPercentLoss)}</dd></div><div><dt>{copy.errors}</dt><dd>{formatted(opening.errorRate, "%")}</dd></div></dl><div className="training-sources">{opening.problemPositions.slice(0, 3).map((item) => <Link key={`${item.gameId}:${item.ply}`} href={decisionReviewHref(item)}>{copy.plyRef(item.san, item.ply)}</Link>)}</div></article>)}</div>{report.openings.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>{copy.showMoreOpenings}</button>}</>}</section>}

        {(activeTab === "middlegame" || activeTab === "endgame") && (() => {
          const phase = report.phases[activeTab];
          const endgame = activeTab === "endgame";
          const evidence = report.mistakes.filter((item) => item.phase === activeTab).slice(0, 8);
          return <section id={activeTab}><header className="study-section-heading"><h2>{phaseLabel(activeTab, language)}</h2><small>{endgame ? copy.endgameIntro : copy.middlegameIntro}</small></header>
            <div className="study-metric-groups">
              <section className="study-wash" data-wash="mist"><h3>{copy.decisionQuality}</h3><dl><div><dt>{copy.moves}</dt><dd>{phase.moveCount}</dd></div><div><dt>{copy.errorRate}</dt><dd>{formatted(phase.errorRate, "%")}</dd></div><div><dt>{copy.averageWinPercentLoss}</dt><dd>{formatted(phase.averageWinPercentLoss)}</dd></div>{!endgame && <div><dt>{copy.decisionErrorsLabel}</dt><dd>{phase.errorCount}</dd></div>}</dl></section>
              <section className="study-wash" data-wash="cream"><h3>{copy.recentForm}</h3><dl><div><dt>{copy.averageMoveAccuracyLabel}</dt><dd>{formatted(phase.averageAccuracy)}</dd></div><div><dt>{copy.recentAverageMoveAccuracy}</dt><dd>{formatted(phase.recentAccuracy)}</dd></div></dl><small>{copy.accuracyMean(phase.accuracyMetric.sampleMoves, phase.accuracyMetric.sampleGames)}</small></section>
              <section className="study-wash" data-wash="sage"><h3>{endgame ? copy.conversion : copy.advantages}</h3><dl><div><dt>{copy.advantagesPreserved}</dt><dd>{phase.advantagePreserved}/{phase.advantageOpportunities}</dd></div>{endgame && <div><dt>{copy.defensiveHolds}</dt><dd>{phase.defensiveHolds}/{phase.defensivePositions}</dd></div>}</dl></section>
              <section className="study-wash" data-wash="pink"><h3>{endgame ? copy.missedWinsMates : copy.opportunities}</h3><dl><div><dt>{copy.missedOpportunities}</dt><dd>{phase.missedOpportunities}</dd></div></dl>{evidence.length > 0 && <ul className="study-evidence-list">{evidence.map((item) => <li key={`${item.gameId}:${item.ply}`}><QualityIcon classification={item.classification} size={20} language={language} /><span><strong title={item.san}>{item.san}</strong><small>{copy.winPercent(item.winPercentLoss.toFixed(1))}</small></span><Link href={decisionReviewHref(item)}>{copy.review}</Link></li>)}</ul>}</section>
            </div>
          </section>;
        })()}

        {activeTab === "mistakes" && <section id="mistakes"><header className="study-section-heading"><h2>{copy.mistakes}</h2><small>{copy.mistakesIntro}</small></header>{report.mistakes.length === 0 ? <p className="study-section-empty">{copy.noErrors}</p> : <><ul className="study-evidence-list">{report.mistakes.slice(0, listLimit).map((item) => <li key={`${item.gameId}:${item.ply}`}><QualityIcon classification={item.classification} size={22} language={language} /><span><strong title={item.san}>{item.san} · {qualityLabel(item.classification, language)}</strong><small>{phaseLabel(item.phase, language)} · {copy.winPercent(item.winPercentLoss.toFixed(1))} · {new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={decisionReviewHref(item)}>{copy.review}</Link></li>)}</ul>{report.mistakes.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>{copy.showMoreMistakes}</button>}</>}</section>}

        {activeTab === "highlights" && <section id="highlights"><header className="study-section-heading"><h2>{copy.highlights}</h2><small>{copy.highlightsIntro}</small></header>{report.specialMoves.length + report.gameHighlights.length === 0 ? <p className="study-section-empty">{copy.noHighlights}</p> : <div className="study-highlight-groups">
          <section data-kind="brilliant"><h3>{copy.brilliant} <small>{brilliantMoves.length}</small></h3>{brilliantMoves.length === 0 ? <p className="study-section-empty">{copy.noneInPopulation}</p> : <ul className="study-highlight-cards">{brilliantMoves.slice(0, 6).map((item) => <li key={`${item.gameId}:${item.ply}`} className="study-highlight-card" data-kind="brilliant"><QualityIcon classification="brilliant" size={22} language={language} /><span><strong>{item.san}</strong><small>{new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>{copy.openInReview}</Link></li>)}</ul>}</section>
          <section data-kind="critical"><h3>{copy.critical} <small>{criticalMoves.length}</small></h3>{criticalMoves.length === 0 ? <p className="study-section-empty">{copy.noneInPopulation}</p> : <ul className="study-highlight-cards">{criticalMoves.slice(0, listLimit).map((item) => <li key={`${item.gameId}:${item.ply}`} className="study-highlight-card" data-kind="critical"><QualityIcon classification="great" size={22} language={language} /><span><strong>{item.san}</strong><small>{new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>{copy.openInReview}</Link></li>)}</ul>}{criticalMoves.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>{copy.viewMoreCritical}</button>}</section>
          {(["comeback", "save", "clean-conversion", "best-game"] as const).map((kind) => {
            const items = report.gameHighlights.filter((item) => item.kind === kind);
            if (items.length === 0) return null;
            return <section key={kind} data-kind={kind}><h3>{copy.highlightKind[kind]} <small>{items.length}</small></h3><ul className="study-highlight-cards">{items.slice(0, 6).map((item) => <li key={`${item.kind}:${item.gameId}`} className="study-highlight-card" data-kind={kind}><span><strong>{item.title}</strong><small>{item.accuracy === undefined ? "" : copy.accuracyHighlight(item.accuracy.toFixed(1))}</small></span><Link href={item.referencePly ? `/review/${item.gameId}/moves?ply=${item.referencePly}` : `/review/${item.gameId}`}>{copy.open}</Link></li>)}</ul></section>;
          })}
        </div>}</section>}

        {activeTab === "plan" && <section id="training-plan"><header className="study-section-heading"><h2>{copy.plan}</h2><small>{copy.planIntro}</small></header>{report.trainingPlan.length === 0 ? <p className="study-section-empty">{copy.noWeakness}</p> : <div className="weakness-grid">{report.weaknesses.map((weakness, index) => { const itemId = trainingQueueItemId(player.key, weakness.kind); return <article key={weakness.kind}><div className="weakness-head"><span className="weakness-priority">{index + 1}</span><div><strong>{trainingTitle(weakness.kind, language)}</strong><p>{copy.weaknessDescription[weakness.kind]}</p></div></div><div className="weakness-metrics"><span>{copy.ofGames(formatted(weakness.frequency, "%"))}</span><span>{copy.confidenceWord(confLabel(copy, weakness.confidence))}</span><span>{copy.trend[weakness.trend]}</span></div><ul>{weakness.evidence.slice(0, 5).map((item) => <li key={`${item.gameId}:${item.ply}`}><span><strong title={item.san}>{item.san}</strong><small>{phaseLabel(item.phase, language)} · {copy.winPercent(item.winPercentLoss.toFixed(1))}</small></span><Link href={decisionReviewHref(item)}>{copy.review}</Link></li>)}</ul><button type="button" className="text-button" disabled={queueIds.has(itemId) || workingItem !== null} onClick={() => void addWeakness(weakness)}>{queueIds.has(itemId) ? copy.inQueue : copy.addToQueue}</button></article>; })}</div>}

        </section>}

        {activeTab === "coverage" && <section id="coverage"><header className="study-section-heading"><h2>{copy.coverage}</h2><small>{report.algorithmVersion} · {report.objectiveAlgorithmVersion}</small></header><div className="study-metrics"><article><span>{copy.eligible}</span><strong>{report.coverage.eligibleGames}</strong></article><article><span>{copy.current}</span><strong>{report.coverage.analyzedGames}</strong><small>{formatted(report.coverage.coverageRate, "%")}</small></article><article><span>{copy.stale}</span><strong>{report.coverage.staleGames}</strong></article><article><span>{copy.failed}</span><strong>{report.coverage.failedGames}</strong></article></div>{report.coverage.providers && report.coverage.providers.length > 0 && <div className="coverage-provider-grid">{report.coverage.providers.map((item) => <article key={item.provider}><strong>{item.provider === "chesscom" ? "Chess.com" : "Lichess"}</strong><span>{copy.currentFrac(item.analyzedGames, item.eligibleGames)}</span><small>{copy.staleFailed(item.staleGames, item.failedGames)}</small></article>)}</div>}<p className="study-section-empty">{report.coverage.state === "empty" ? copy.coverageEmpty : report.coverage.partial ? copy.coveragePartial : copy.coverageComplete(report.coverage.analyzedGames, report.coverage.eligibleGames)}{report.coverage.excludedGames > 0 ? copy.coverageExcluded(report.coverage.excludedGames) : ""}{filters.openingKeys.length > 0 ? copy.coverageOpeningNote : ""}{copy.localCache((cacheBytes / 1024 / 1024).toFixed(1))}</p>
          {accounts.length > 0 && <div className="history-analysis-controls"><label><span>{copy.accountScope}</span><select value={jobAccountScope} onChange={(event) => setJobAccountScope(event.target.value as "selected" | "all")}><option value="all">{copy.allAccounts}</option><option value="selected" disabled={!player.accountId}>{copy.selectedAccount}</option></select></label><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={startHistoryAnalysis} /></div>}
          <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />
        </section>}
      </div>}
        </div>
      </>}
    </section>
  );
}
