"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useMemo } from "react";
import { noLegalMoveTerminalStatus, replayUciLine } from "@chess-review/chess-core";
import { formatMoveNotation, type GameAnalysisV2, type UiLanguage } from "@chess-review/shared";

import { EvaluationGraph, Icon, QualityIcon, qualityLabel, phaseLabel, type IconName } from "@chess-review/ui";
import { CoachPanel } from "./coach-panel";
import { AnalysisLensPanel } from "./review/analysis-lens-panel";
import { CurrentMoveVerdict } from "./review/current-move-verdict";
import { runDiagnosticsLine, runDiagnosticsText } from "../lib/run-diagnostics-copy";
import { criticalMomentPlies } from "../lib/critical-moment-navigation";
import { KeyMomentNavigation } from "./review/key-moment-navigation";
import { OpeningExplorerPanel } from "./review/opening-explorer-panel";
import { TablebasePanel } from "./review/tablebase-panel";
import { ReviewMoves, ReviewOverview } from "./review-presentation";
import { useWithheldPly } from "./review-session-state";
import { displayPgnComment, importedAnnotations } from "../lib/imported-annotations";
import { annotationsLabel, baselineOnlyCaveat, engineChoiceLabel, moveEvidenceSentence, sacrificeLabel, verificationLabel, winningChancesLabel } from "../lib/move-evidence-copy";
import { useReviewRuntime } from "./review-runtime";
import { formatEngineScore } from "../lib/review-format";
import { selectedBranchNode } from "../lib/analysis-branch";
import { useReviewStore } from "../store/review-store";
import { stockfishCandidateIdentity } from "../lib/board-analysis-arrows";
import { RetroPractice } from "./retro-practice";
import { useUiLanguage } from "../hooks/use-ui-language";

type RouteCopy = {
  engineLinesMeta: (version: string, depth: number) => string;
  fenUnavailable: string;
  runFirst: string;
  fenBody: string;
  pgnBody: string;
  openEngineLab: string;
  positionsProgress: (completed: number, total: string | number) => string;
  cancel: string;
  analyzeGame: string;
  branchBanner: (rootPly: number, selected: number, total: number) => string;
  accuracy: (value: string) => string;
  classifying: string;
  retryMoveQuality: string;
  returnToGame: string;
  continuationsAria: string;
  candidateAria: (rank: number, uci: string) => string;
  unknown: string;
  explore: string;
  checkmate: string;
  stalemate: string;
  noContinuation: (kind: string) => string;
  analyzingPosition: string;
  candidatesAppear: string;
  engineLines: string;
  retry: string;
  wholeGame: string;
  evalTimeline: string;
  timelineHint: string;
  objectiveReview: string;
  oneThing: string;
  review: string;
  startMoment: string;
  walkThrough: string;
  lede: string;
  theMoment: string;
  whyMatters: (move: string) => string;
  nextStepAria: string;
  exploreMoves: string;
  studyGame: string;
  momentDetails: string;
  nearbyMoves: string;
  beforeAfter: (before: number, after: number) => string;
  allMoves: (count: number) => string;
  movesQuality: string;
  moveCount: (count: number) => string;
  gameSummary: string;
  summaryMeta: string;
  moveExplorer: string;
  filtersAria: string;
  filterAll: string;
  filterKey: string;
  filterErrors: string;
  showEngineAnswer: string;
  evidenceSummary: string;
  engine: string;
  winningChances: string;
  search: string;
  sacrifice: string;
  ruledOut: string;
  internals: string;
  noExclusion: string;
  exclusions: (list: string) => string;
  evidenceMeta: (annotations: string, phase: string, accuracy: string) => string;
  annotationsLead: (labels: string) => string;
  aiCoach: string;
  depth: string;
  engineLabLines: string;
  analyzingPositionBtn: string;
  analyzeCurrent: string;
  cancelGameReview: string;
  reanalyze: string;
  runDiagnostics: string;
  dropped: (count: number) => string;
  copyDiagnostics: string;
  diagnosticsCopied: string;
  copyFailed: string;
  engineLabel: string;
  engineValue: string;
  cache: string;
  loadedIdb: string;
  inMemory: string;
  noAnalysis: string;
  score: string;
  divider: string;
  dividerValue: (middle: string, end: string) => string;
  practiceHidden: string;
  candidatesAria: string;
  runCurrent: string;
  engineLab: string;
  engineTab: string;
  explorerTab: string;
  tablebaseTab: string;
};

const COPY: Record<UiLanguage, RouteCopy> = {
  en: {
    engineLinesMeta: (version, depth) => `${version} \u00b7 depth ${depth}`,
    fenUnavailable: "Game facts are not available for a FEN study",
    runFirst: "Run the objective review first",
    fenBody: "Use Engine Lab for this explicit position. PGN history is required for Move Quality, Accuracy, Maia move review and Study.",
    pgnBody: "Stockfish will build the canonical facts that every other section consumes.",
    openEngineLab: "Open Engine Lab \u2192",
    positionsProgress: (completed, total) => `${completed}/${total} positions`,
    cancel: "Cancel",
    analyzeGame: "Analyze game",
    branchBanner: (rootPly, selected, total) => `Analysis branch \u00b7 root ply ${rootPly} \u00b7 ${selected}/${total}`,
    accuracy: (value) => `Accuracy ${value}`,
    classifying: "Stockfish is classifying this move\u2026",
    retryMoveQuality: "Retry Move Quality",
    returnToGame: "Return to game ",
    continuationsAria: "Stockfish continuations",
    candidateAria: (rank, uci) => `Stockfish candidate #${rank} ${uci}`,
    unknown: "unknown",
    explore: "Explore \u2192",
    checkmate: "Checkmate",
    stalemate: "Stalemate",
    noContinuation: (kind) => `${kind} \u00b7 no legal continuation.`,
    analyzingPosition: "Analyzing this position\u2026",
    candidatesAppear: "Stockfish candidates appear here when this position is analyzed.",
    engineLines: "Engine lines",
    retry: "Retry",
    wholeGame: "The whole game",
    evalTimeline: "Evaluation timeline",
    timelineHint: "Select a point to inspect that move and return to the canonical game",
    objectiveReview: "Objective review",
    oneThing: "One thing at a time",
    review: "Review",
    startMoment: "Start with the first moment that mattered.",
    walkThrough: "Walk through your game",
    lede: "The review stops at each key moment, asks what you would play, and only then shows the evidence.",
    theMoment: "The moment",
    whyMatters: (move) => `Why does ${move} matter?`,
    nextStepAria: "Review next step",
    exploreMoves: "Explore moves \u2192",
    studyGame: "Study this game \u2192",
    momentDetails: "Moment details",
    nearbyMoves: "Nearby moves",
    beforeAfter: (before, after) => `${before} before \u00b7 ${after} after`,
    allMoves: (count) => `All ${count} moves, filters and evidence \u2192`,
    movesQuality: "Moves, quality and accuracy",
    moveCount: (count) => `${count} ${count === 1 ? "move" : "moves"}`,
    gameSummary: "Game summary and timeline",
    summaryMeta: "Accuracy \u00b7 phases \u00b7 key moments",
    moveExplorer: "Move explorer",
    filtersAria: "Move filters",
    filterAll: "All",
    filterKey: "Key",
    filterErrors: "Errors",
    showEngineAnswer: "Show the engine\u2019s answer on the board",
    evidenceSummary: "Evidence behind this label",
    engine: "Engine",
    winningChances: "Winning chances",
    search: "Search",
    sacrifice: "Sacrifice",
    ruledOut: "Ruled out",
    internals: "Classification internals",
    noExclusion: "No exclusion was recorded.",
    exclusions: (list) => `Exclusions: ${list}`,
    evidenceMeta: (annotations, phase, accuracy) => `${annotations}${phase} \u00b7 Accuracy ${accuracy}`,
    annotationsLead: (labels) => `Annotations \u00b7 ${labels} \u00b7 `,
    aiCoach: "AI coach",
    depth: "Depth",
    engineLabLines: "Engine Lab lines",
    analyzingPositionBtn: "Analyzing position\u2026",
    analyzeCurrent: "Analyze current position",
    cancelGameReview: "Cancel game review",
    reanalyze: "Re-analyze full game",
    runDiagnostics: "Run diagnostics",
    dropped: (count) => ` \u00b7 ${count} earlier event(s) dropped`,
    copyDiagnostics: "Copy diagnostics",
    diagnosticsCopied: "Diagnostics copied",
    copyFailed: "Could not copy. The timeline above can be selected by hand.",
    engineLabel: "Engine",
    engineValue: "Stockfish 18 WASM",
    cache: "Cache",
    loadedIdb: "Loaded from IndexedDB",
    inMemory: "Analysis in memory",
    noAnalysis: "No game analysis",
    score: "Score",
    divider: "Divider",
    dividerValue: (middle, end) => `middle ${middle} \u00b7 end ${end}`,
    practiceHidden: "Engine lines are hidden while you solve this position. Answer on the board, view the solution, or skip.",
    candidatesAria: "Stockfish candidates",
    runCurrent: "Run the current-position engine to inspect raw MultiPV.",
    engineLab: "Engine Lab",
    engineTab: "Engine",
    explorerTab: "Explorer",
    tablebaseTab: "Tablebase",
  },
  "zh-CN": {
    engineLinesMeta: (version, depth) => `${version} · 深度 ${depth}`,
    fenUnavailable: "FEN 研究没有对局事实",
    runFirst: "请先运行客观复盘",
    fenBody: "此显式局面请使用引擎实验室。着法质量、准确率、Maia 着法审视和学习需要 PGN 历史。",
    pgnBody: "Stockfish 会生成其他分区都依赖的规范事实。",
    openEngineLab: "打开引擎实验室 →",
    positionsProgress: (completed, total) => `${completed}/${total} 个局面`,
    cancel: "取消",
    analyzeGame: "分析对局",
    branchBanner: (rootPly, selected, total) => `分析分支 · 根半回合 ${rootPly} · ${selected}/${total}`,
    accuracy: (value) => `准确率 ${value}`,
    classifying: "Stockfish 正在给这步分类…",
    retryMoveQuality: "重试着法质量",
    returnToGame: "返回对局 ",
    continuationsAria: "Stockfish 后续变化",
    candidateAria: (rank, uci) => `Stockfish 候选 #${rank} ${uci}`,
    unknown: "未知",
    explore: "探索 →",
    checkmate: "将杀",
    stalemate: "逼和",
    noContinuation: (kind) => `${kind} · 没有合法后续。`,
    analyzingPosition: "正在分析此局面…",
    candidatesAppear: "分析此局面后，这里会显示 Stockfish 候选着。",
    engineLines: "引擎变化",
    retry: "重试",
    wholeGame: "整局",
    evalTimeline: "评分时间线",
    timelineHint: "选择一个点以查看该着，并回到规范对局",
    objectiveReview: "客观复盘",
    oneThing: "一次只做一件事",
    review: "复盘",
    startMoment: "从第一个真正重要的节点开始。",
    walkThrough: "逐步回放你的对局",
    lede: "复盘会在每个关键节点停下，先问你会怎么走，然后再给出证据。",
    theMoment: "这一刻",
    whyMatters: (move) => `为什么 ${move} 重要？`,
    nextStepAria: "复盘下一步",
    exploreMoves: "浏览着法 →",
    studyGame: "学习本局 →",
    momentDetails: "节点详情",
    nearbyMoves: "附近着法",
    beforeAfter: (before, after) => `前 ${before} · 后 ${after}`,
    allMoves: (count) => `全部 ${count} 步着法、筛选与证据 →`,
    movesQuality: "着法、质量与准确率",
    moveCount: (count) => `${count} 步着法`,
    gameSummary: "对局摘要与时间线",
    summaryMeta: "准确率 · 阶段 · 关键节点",
    moveExplorer: "着法浏览器",
    filtersAria: "着法筛选",
    filterAll: "全部",
    filterKey: "关键",
    filterErrors: "错误",
    showEngineAnswer: "在棋盘上显示引擎答案",
    evidenceSummary: "此标签背后的证据",
    engine: "引擎",
    winningChances: "获胜机会",
    search: "搜索",
    sacrifice: "弃子",
    ruledOut: "已排除",
    internals: "分类内部信息",
    noExclusion: "未记录排除项。",
    exclusions: (list) => `排除项：${list}`,
    evidenceMeta: (annotations, phase, accuracy) => `${annotations}${phase} · 准确率 ${accuracy}`,
    annotationsLead: (labels) => `注解 \u00b7 ${labels} \u00b7 `,
    aiCoach: "AI 讲解",
    depth: "深度",
    engineLabLines: "引擎实验室变化",
    analyzingPositionBtn: "正在分析局面…",
    analyzeCurrent: "分析当前局面",
    cancelGameReview: "取消整局复盘",
    reanalyze: "重新分析整局",
    runDiagnostics: "运行诊断",
    dropped: (count) => ` · 丢弃了 ${count} 条更早的事件`,
    copyDiagnostics: "复制诊断",
    diagnosticsCopied: "诊断已复制",
    copyFailed: "无法复制。可以手动选择上方时间线。",
    engineLabel: "引擎",
    engineValue: "Stockfish 18 WASM",
    cache: "缓存",
    loadedIdb: "已从 IndexedDB 加载",
    inMemory: "分析在内存中",
    noAnalysis: "没有对局分析",
    score: "评分",
    divider: "分界",
    dividerValue: (middle, end) => `中局 ${middle} · 残局 ${end}`,
    practiceHidden: "解题时隐藏引擎变化。请在棋盘上作答、查看解答，或跳过。",
    candidatesAria: "Stockfish 候选着",
    runCurrent: "运行当前局面引擎以查看原始 MultiPV。",
    engineLab: "引擎实验室",
    engineTab: "引擎",
    explorerTab: "浏览器",
    tablebaseTab: "残局库",
  },
};


function engineLinesMeta(analysis: GameAnalysisV2 | null, copy: RouteCopy): string | null {
  if (!analysis) return null;
  const version = /stockfish/i.test(analysis.engine.stockfishVersion)
    ? analysis.engine.stockfishVersion
    : `Stockfish ${analysis.engine.stockfishVersion}`;
  return copy.engineLinesMeta(version, analysis.engine.depth);
}

function PanelRowSummary({
  icon,
  kicker,
  label,
  meta,
}: {
  icon: IconName;
  kicker?: string;
  label: string;
  meta?: string | null;
}) {
  return (
    <summary>
      <Icon name={icon} />
      <span className="review-row-copy">
        {kicker ? <span className="eyebrow">{kicker}</span> : null}
        <strong>{label}</strong>
      </span>
      {meta ? <span className="review-row-meta">{meta}</span> : null}
      <Icon className="review-row-chevron" name="chevron-right" />
    </summary>
  );
}

function AnalysisGate({ section }: { section: string }) {
  const copy = COPY[useUiLanguage()];
  const runtime = useReviewRuntime();
  return (
    <div className="analysis-gate">
      <span className="kicker">{section}</span>
      <h1>{runtime.record.kind === "fen" ? copy.fenUnavailable : copy.runFirst}</h1>
      <p>{runtime.record.kind === "fen" ? copy.fenBody : copy.pgnBody}</p>
      {runtime.record.kind === "fen" ? <Link className="primary-link" href={`/review/${runtime.gameId}/engine`}>{copy.openEngineLab}</Link> : runtime.reviewState === "running" ? (
        <div className="progress-card"><progress value={runtime.reviewProgress?.completed ?? 0} max={Math.max(1, runtime.reviewProgress?.total ?? 1)} /><span>{copy.positionsProgress(runtime.reviewProgress?.completed ?? 0, runtime.reviewProgress?.total ?? "?")}</span><button type="button" className="secondary" onClick={runtime.cancelFullGame}>{copy.cancel}</button></div>
      ) : <button type="button" className="primary" onClick={() => void runtime.analyzeFullGame()}>{copy.analyzeGame}</button>}
      {runtime.reviewError && <p className="error" role="alert">{runtime.reviewError}</p>}
    </div>
  );
}

function PositionAnalysis({ compact = false }: { compact?: boolean } = {}) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const positionFen = useReviewStore((store) => store.positionFen);
  const branch = useReviewStore((store) => store.branch);
  const returnToGame = useReviewStore((store) => store.returnToGame);
  // Mid-practice, `analysis.moves[currentPly].stockfish` is the prompt position's
  // own MultiPV root — the best move is its first line. Suppress it entirely.
  const practiceHidden = runtime.retro.locked;
  const canonical = branch || practiceHidden ? null : analysis?.moves[currentPly]?.stockfish ?? null;
  const result = practiceHidden ? null : runtime.continuationResult ?? canonical;
  const rootFen = positionFen;
  const terminal = noLegalMoveTerminalStatus(rootFen);
  const lines = result?.lines.slice(0, runtime.continuationLines) ?? [];
  const branchNode = branch ? selectedBranchNode(branch) : null;
  const branchQuality = branchNode?.moveQuality;

  const hideLens = compact && branch === null;
  return (
    <section className="position-analysis">
      {!hideLens && <AnalysisLensPanel objective={result} />}
      {branch && (
        <div className="variation-banner">
          <span>{copy.branchBanner(branch.rootPly, branch.selectedIndex, branch.activePath.length - 1)}</span>
          {branchQuality?.state === "complete" && <span className="branch-quality-result"><QualityIcon classification={branchQuality.classification} size={20} language={language} /><strong>{qualityLabel(branchQuality.classification, language)}</strong><small>{copy.accuracy(branchQuality.accuracy.toFixed(1))}</small></span>}
          {branchQuality?.state === "running" && <small>{copy.classifying}</small>}
          {branchQuality?.state === "error" && <button type="button" className="text-button" onClick={runtime.retryBranchMoveQuality}>{copy.retryMoveQuality}</button>}
          <button type="button" className="text-button" onClick={returnToGame}>{copy.returnToGame}<kbd>Esc</kbd></button>
        </div>
      )}
      {runtime.analysisMode !== "maia" && (() => {
        const list = (
          <div className="continuation-list" aria-label={copy.continuationsAria}>
            {lines.map((line) => {
              const identity = result ? stockfishCandidateIdentity(result, line) : null;
              const san = (() => {
                try {
                  return replayUciLine(rootFen, line.pv).slice(0, runtime.continuationLength).map((move) => move.san);
                } catch {
                  return line.pv.slice(0, runtime.continuationLength);
                }
              })();
              return (
                <button
                  type="button"
                  aria-label={copy.candidateAria(line.rank, line.pv[0] ?? copy.unknown)}
                  data-candidate-uci={line.pv[0]}
                  key={identity ? `${identity.fen}|${identity.rank}|${identity.pvKey}` : line.rank}
                  disabled={!identity}
                  onClick={() => identity && runtime.playContinuation(identity, result)}
                >
                  <span className="line-rank">{line.rank}</span>
                  <strong>{formatEngineScore(line.score)}</strong>
                  <span className="line-moves">{san.join(" ")}</span>
                  <code>{line.pv[0]}</code>
                  <small>{copy.explore}</small>
                </button>
              );
            })}
            {lines.length === 0 && <p className="continuation-empty">{
              terminal
                ? copy.noContinuation(terminal.kind === "checkmate" ? copy.checkmate : copy.stalemate)
                : runtime.continuationState === "running"
                  ? copy.analyzingPosition
                  : copy.candidatesAppear
            }</p>}
          </div>
        );
        // Guided Review folds the engine lines away so the first screen has one
        // job. Playing a move from a historical position is the visitor asking
        // "what happens instead?", so the answer opens with the branch rather
        // than needing a second click. `key` remounts the disclosure when the
        // branch appears or is left, which is what re-applies `open`; without it
        // React keeps the element's current open state.
        return compact
          ? (
            <details className="review-engine-lines review-panel-row" key={branch ? "branch" : "canonical"} open={branch !== null}>
              <PanelRowSummary icon="engine" label={copy.engineLines} meta={engineLinesMeta(analysis, copy)} />
              {list}
            </details>
          )
          : list;
      })()}
      {runtime.analysisMode !== "maia" && runtime.continuationError && <p className="error">{runtime.continuationError} <button type="button" className="text-button" onClick={() => void runtime.analyzeContinuations()}>{copy.retry}</button></p>}
    </section>
  );
}

function EvaluationTimeline({
  analysis,
  currentPly,
  onSelectPly,
}: {
  analysis: GameAnalysisV2;
  currentPly: number;
  onSelectPly: (ply: number) => void;
}) {
  const language = useUiLanguage();
  const copy = COPY[language];
  return (
    <details className="timeline-panel game-summary-timeline">
      <summary>
        <span className="kicker">{copy.wholeGame}</span>
        <strong>{copy.evalTimeline}</strong>
      </summary>
      <small>{copy.timelineHint}</small>
      <EvaluationGraph analysis={analysis} currentPly={currentPly} onSelectPly={onSelectPly} language={language} />
    </details>
  );
}

export function ObjectiveRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const branch = useReviewStore((store) => store.branch);
  // Hooks first: this panel mounts without an analysis and gains one later.
  const answerWithheld = useWithheldPly() !== null;
  const language = useUiLanguage();
  const copy = COPY[language];

  const keyPlies = useMemo(
    () => (analysis ? criticalMomentPlies(analysis.criticalMoments) : []),
    [analysis],
  );
  const mode: string = !analysis
    ? "gate"
    : runtime.retro.active
      ? "practice"
      : branch
        ? "branch"
        : currentPly === 0
          ? "start"
          : keyPlies.includes(currentPly)
            ? "moment"
            : "move";
  // Animate only the contextual paper. Cancelling the previous animation keeps
  // rapid mode changes responsive without remounting disclosures or the board.
  const panelRef = useRef<HTMLDivElement>(null);
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    const panel = panelRef.current;
    if (!panel || typeof panel.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = panel.animate([
      { opacity: 0, transform: "translateY(4px)" },
      { opacity: 1, transform: "none" },
    ], { duration: 240, easing: "cubic-bezier(.22, .68, .2, 1)" });
    return () => animation.cancel();
  }, [mode]);

  if (!analysis) return <div className="route-panel objective-route"><AnalysisGate section={copy.objectiveReview} /><PositionAnalysis /></div>;
  const move = branch || currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  const hasKeyMoments = analysis.criticalMoments.some((moment) => analysis.moves[moment.ply - 1]);
  const practice = runtime.retro.presentation.hideReviewChrome;
  // The start of the game is its own state: nothing has been played yet, so the panel
  // has one job and everything that describes a *current* move is background. Both
  // halves of the first screen read this one definition.
  const atStart = !branch && currentPly === 0;
  return (
    <div
      ref={panelRef}
      className="route-panel objective-route review-mode-panel paper-panel"
      data-mode={mode}
    >
      {!practice && atStart && (
        <header className="review-panel-head">
          <p className="kicker">{hasKeyMoments ? copy.oneThing : copy.review}</p>
          <h2 className="review-panel-display">
            {hasKeyMoments ? copy.startMoment : copy.walkThrough}
          </h2>
          {hasKeyMoments ? (
            <p className="review-panel-lede">
              {copy.lede}
            </p>
          ) : null}
        </header>
      )}
      {!practice && !atStart && mode === "moment" && move && (
        <header className="review-panel-head">
          <p className="kicker">{copy.theMoment}</p>
          <h2 className="review-panel-display">{copy.whyMatters(formatMoveNotation({ fenBefore: move.fenBefore, color: move.color, san: move.san }))}</h2>
          <p className="review-panel-lede">{moveEvidenceSentence(move, language)}</p>
        </header>
      )}

      {!practice && !hasKeyMoments && atStart && (
        <p className="review-next-step" role="region" aria-label={copy.nextStepAria}>
          {/* A game with no key moments still has one thing to do first: the start ply
              keeps a single primary action either way. */}
          <Link className="primary-link" href={`/review/${runtime.gameId}/moves`}>{copy.exploreMoves}</Link>
          <Link className="text-button" href={`/review/${runtime.gameId}/coach`}>{copy.studyGame}</Link>
        </p>
      )}

      {/* One guided strip, then this move, then nearby evidence. Engine lines and
          the whole-game report stay folded so the first screen has one job. */}
      {!practice && <KeyMomentNavigation analysis={analysis} />}
      {!practice && move && !answerWithheld && <CurrentMoveVerdict move={move} />}
      {mode === "moment" && !practice && !answerWithheld ? (
        <div className="key-moment-disclosure-row" aria-label={copy.momentDetails}>
          {/* Evidence lives inside CurrentMoveVerdict; Engine + Nearby share this row band. */}
          <PositionAnalysis compact />
          <details className="review-context-moves folded-block review-panel-row">
            <PanelRowSummary
              icon="moves"
              label={copy.nearbyMoves}
              meta={copy.beforeAfter(Math.min(5, currentPly), Math.min(5, Math.max(0, analysis.moves.length - currentPly)))}
            />
            <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} contextWindow={5} />
            <Link className="view-all-moments" href={`/review/${runtime.gameId}/moves`}>
              {copy.allMoves(analysis.moves.length)}
            </Link>
          </details>
        </div>
      ) : null}
      <div className={atStart ? "review-other-paths" : mode === "moment" ? "review-other-paths review-other-paths-moment" : undefined}>
      <RetroPractice analysis={analysis} foldIdle={!runtime.retro.active} />

      {!practice && mode !== "moment" && (atStart ? (
        <details className="review-context-moves folded-block review-panel-row">
          <PanelRowSummary
              icon="moves"
              label={copy.movesQuality}
              meta={copy.moveCount(analysis.moves.length)}
            />
            <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} contextWindow={5} />
            <Link className="view-all-moments" href={`/review/${runtime.gameId}/moves`}>
              {copy.allMoves(analysis.moves.length)}
            </Link>
          </details>
        ) : (
          <section className="review-context-moves" aria-label={copy.nearbyMoves}>
            <div className="review-row-static">
              <Icon name="moves" />
              <span className="review-row-copy"><strong>{copy.nearbyMoves}</strong></span>
              <span className="review-row-meta">{copy.beforeAfter(Math.min(5, currentPly), Math.min(5, Math.max(0, analysis.moves.length - currentPly)))}</span>
            </div>
            <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} contextWindow={5} />
            <Link className="view-all-moments" href={`/review/${runtime.gameId}/moves`}>
              {copy.allMoves(analysis.moves.length)}
            </Link>
        </section>
      ))}
      {mode !== "moment" && !runtime.retro.presentation.hideCoachAnswers && !answerWithheld && <PositionAnalysis compact />}
      {!practice && (
        <details className="game-summary-section review-panel-row" id="game-summary">
          <PanelRowSummary
              icon="book"
              label={copy.gameSummary}
              meta={copy.summaryMeta}
            />
          <ReviewOverview analysis={analysis} onSelectPly={runtime.navigateToPly} allMomentsHref={`/review/${runtime.gameId}/moves`} />
          <EvaluationTimeline analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} />
        </details>
      )}
      </div>
    </div>
  );
}

export function MovesRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const [filter, setFilter] = useState<"all" | "critical" | "errors">("all");
  // Hooks run before the gate returns: the panel can be mounted without an
  // analysis and gain one later, which used to change the hook count mid-life.
  const answerWithheld = useWithheldPly() !== null;
  const language = useUiLanguage();
  const copy = COPY[language];
  const move = !analysis || currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  // The author's own note for the selected move, when the PGN had one.
  const importedComment = useMemo(
    () => !analysis || move === null ? undefined : displayPgnComment(importedAnnotations(analysis)?.plies[move.ply - 1]?.comment),
    [analysis, move],
  );
  if (!analysis) return <AnalysisGate section={copy.moveExplorer} />;
  return (
    <div className="route-panel moves-route">
      <div className="move-filters" aria-label={copy.filtersAria}>{([["all", copy.filterAll], ["critical", copy.filterKey], ["errors", copy.filterErrors]] as const).map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
      <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} filter={filter} />
      {/* A withheld guided moment survives the route change, so this panel must
          keep the answer hidden here too. */}
      {move && !answerWithheld && <section className="move-evidence">
        {importedComment !== undefined && <p className="move-imported-note">{importedComment}</p>}
        <div>
          <QualityIcon classification={move.classification} size={28} language={language} />
          <span>
            <strong>{move.san} · {qualityLabel(move.classification, language)}</strong>
            <small>{copy.evidenceMeta(move.annotations.length > 0 ? copy.annotationsLead(annotationsLabel(move.annotations, language)) : "", phaseLabel(move.phase, language), move.accuracy.toFixed(1))}</small>
          </span>
        </div>
        <p className="move-evidence-sentence">{moveEvidenceSentence(move, language)}</p>
        {baselineOnlyCaveat(move, language) !== null && <p className="move-verdict-caveat">{baselineOnlyCaveat(move, language)}</p>}
        <div className="move-evidence-actions">
          <button
            type="button"
            className="text-button"
            disabled={move.stockfish.lines.length === 0 || runtime.retro.presentation.hideAnalysisExports}
            onClick={() => {
              const line = move.stockfish.lines[0];
              if (!line) return;
              const identity = stockfishCandidateIdentity(move.stockfish, line);
              if (!identity) return;
              // Show the answer on the board from the position the move was played in,
              // which is where the engine's line starts.
              runtime.pausePlayback();
              runtime.navigateToPly(move.ply - 1);
              runtime.playContinuation(identity, move.stockfish);
            }}
          >
            {copy.showEngineAnswer}
          </button>
        </div>
        <details className="move-evidence-details">
          <summary>{copy.evidenceSummary}</summary>
          <dl>
            <div><dt>{copy.engine}</dt><dd>{engineChoiceLabel(move.classificationReason, language)}</dd></div>
            <div><dt>{copy.winningChances}</dt><dd>{winningChancesLabel(move.classificationReason, language)}</dd></div>
            <div><dt>{copy.search}</dt><dd>{verificationLabel(move, language)}</dd></div>
            {sacrificeLabel(move.classificationReason, language) !== null && (
              <div><dt>{copy.sacrifice}</dt><dd>{sacrificeLabel(move.classificationReason, language)}</dd></div>
            )}
            {move.classificationReason.exclusions.length > 0 && (
              <div><dt>{copy.ruledOut}</dt><dd>{move.classificationReason.exclusions.join(", ").replaceAll("-", " ")}</dd></div>
            )}
          </dl>
          <details className="move-verdict-internals">
            <summary>{copy.internals}</summary>
            <code>{(move.classificationReason.qualityRule ?? move.classificationReason.precedenceRule)}</code>
            <p>{move.classificationReason.exclusions.length === 0 ? copy.noExclusion : copy.exclusions(move.classificationReason.exclusions.join(", "))}</p>
          </details>
        </details>
      </section>}
    </div>
  );
}

export function CoachRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const copy = COPY[useUiLanguage()];
  if (!analysis) return <AnalysisGate section={copy.aiCoach} />;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel coach-route">
      <CoachPanel analysis={analysis} move={move} onSelectPly={runtime.navigateToPly} />
    </div>
  );
}

export function EngineRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const positionFen = useReviewStore((store) => store.positionFen);
  const language = useUiLanguage();
  const copy = COPY[language];
  const branch = useReviewStore((store) => store.branch);
  const [tab, setTab] = useState<"engine" | "explorer" | "tablebase">("engine");
  // Copying the record is the point of the button, so a refused clipboard has to be
  // visible rather than silently doing nothing: the timeline above stays selectable.
  const [diagnosticsCopy, setDiagnosticsCopy] = useState<"idle" | "copied" | "failed">("idle");
  const practiceHidden = runtime.retro.locked;
  // The explorer shows what is commonly played from this position, which is a
  // spoiler while the visitor still owes an answer, so the tabs stay away until
  // the practice session ends.
  const showTabs = !practiceHidden;
  // The lab shows the position the board is actually on. A recorded canonical
  // node only describes it while the board still stands on that node, and on a
  // branch the shell's own continuation search is the evidence for it — so the
  // panel never labels another position's numbers as this one's.
  const canonical = branch ? null : analysis?.moves[currentPly]?.stockfish ?? null;
  const result = practiceHidden ? null : runtime.engineResult ?? runtime.continuationResult ?? canonical;
  const enginePanel = <>
      <section className="engine-config"><label>{copy.depth}<select value={runtime.reviewDepth} disabled={runtime.reviewState === "running"} onChange={(event) => runtime.setReviewDepth(Number(event.target.value) as 10 | 12 | 15)}><option value={10}>10</option><option value={12}>12</option><option value={15}>15</option></select></label><label>{copy.engineLabLines}<select value={runtime.reviewMultiPv} onChange={(event) => runtime.setReviewMultiPv(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label></section>
      <div className="engine-actions"><button type="button" className="primary" disabled={runtime.engineState === "running"} onClick={() => void runtime.analyzePosition()}>{runtime.engineState === "running" ? copy.analyzingPositionBtn : copy.analyzeCurrent}</button>{runtime.record.kind === "pgn" && (runtime.reviewState === "running" ? <button type="button" className="secondary" onClick={runtime.cancelFullGame}>{copy.cancelGameReview}</button> : <button type="button" className="secondary" onClick={() => void runtime.analyzeFullGame()}>{copy.reanalyze}</button>)}</div>
      {(runtime.engineError || runtime.reviewError) && <p className="error">{runtime.engineError ?? runtime.reviewError}</p>}
      {runtime.reviewState === "running" && <div className="progress-card"><progress value={runtime.reviewProgress?.completed ?? 0} max={Math.max(1, runtime.reviewProgress?.total ?? 1)} /><span>{runtime.reviewProgress?.stage ?? "positions"} · {runtime.reviewProgress?.completed ?? 0}/{runtime.reviewProgress?.total ?? "?"}</span></div>}
      {/* What the last run's engine actually did. A run that stalled without engine
          traffic looked exactly like a slow machine before this existed. */}
      {runtime.runDiagnostics && runtime.runDiagnosticsSummary && <details className="run-diagnostics" open={runtime.runDiagnosticsSummary.searches === 0}>
        <summary>{copy.runDiagnostics}</summary>
        <p>{runDiagnosticsLine(runtime.runDiagnosticsSummary, language)}{runtime.runDiagnostics.dropped > 0 ? copy.dropped(runtime.runDiagnostics.dropped) : ""}</p>
        <ol>
          {runtime.runDiagnostics.events.slice(-40).map((event, index) => <li key={`${event.at}-${event.kind}-${index}`}>
            <code>{event.at} ms</code> {event.kind}{event.worker === undefined ? "" : ` · engine ${event.worker}`}{event.detail === undefined ? "" : ` · ${Object.entries(event.detail).map(([key, value]) => `${key} ${value}`).join(", ")}`}
          </li>)}
        </ol>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            void navigator.clipboard.writeText(runDiagnosticsText(runtime.runDiagnostics!, runtime.runDiagnosticsSummary!, language))
              .then(() => setDiagnosticsCopy("copied"))
              .catch(() => setDiagnosticsCopy("failed"));
          }}
        >
          {copy.copyDiagnostics}
        </button>
        {diagnosticsCopy === "copied" && <small role="status">{copy.diagnosticsCopied}</small>}
        {diagnosticsCopy === "failed" && <small role="alert">{copy.copyFailed}</small>}
      </details>}
      <section className="engine-diagnostics"><div><span>{copy.engineLabel}</span><strong>{copy.engineValue}</strong></div><div><span>{copy.cache}</span><strong>{runtime.reviewState === "cached" ? copy.loadedIdb : analysis ? copy.inMemory : copy.noAnalysis}</strong></div><div><span>{copy.score}</span><strong>{formatEngineScore(result)}</strong></div><div><span>{copy.divider}</span><strong>{analysis ? copy.dividerValue(String(analysis.division.middlePly ?? "—"), String(analysis.division.endPly ?? "—")) : "—"}</strong></div></section>
      {practiceHidden && <p className="utility-note" role="status">{copy.practiceHidden}</p>}
      {/* The lab reads raw MultiPV, but a line the visitor cannot play is a
          dead end: the same rows create a validated branch here as in Review,
          through the board's own path, so both surfaces walk a line the same
          way. Raw UCI stays visible because this is the lab. */}
      <div className="candidate-list" aria-label={copy.candidatesAria}>
        {practiceHidden ? null : result ? result.lines.map((line) => {
          const identity = stockfishCandidateIdentity(result, line);
          return (
            <button
              type="button"
              key={identity ? `${identity.fen}|${identity.rank}|${identity.pvKey}` : line.rank}
              className="candidate"
              aria-label={copy.candidateAria(line.rank, line.pv[0] ?? copy.unknown)}
              disabled={!identity}
              onClick={() => identity && runtime.playContinuation(identity, result)}
            >
              <span>#{line.rank}</span>
              <strong>{line.pv[0]}</strong>
              <code>{formatEngineScore(line.score)}</code>
              <small>{line.pv.slice(1, 7).join(" ")}</small>
              <em>{copy.explore}</em>
            </button>
          );
        }) : (
          <p className="utility-empty">
            {runtime.engineState === "running" || runtime.continuationState === "running"
              ? copy.analyzingPosition
              : copy.runCurrent}
          </p>
        )}
      </div>
  </>;
  return (
    <div className="route-panel engine-route">
      {showTabs && (
        <div className="engine-tabs" role="tablist" aria-label={copy.engineLab}>
          <button type="button" role="tab" aria-selected={tab === "engine"} className={tab === "engine" ? "active" : ""} onClick={() => setTab("engine")}>{copy.engineTab}</button>
          <button type="button" role="tab" aria-selected={tab === "explorer"} className={tab === "explorer" ? "active" : ""} onClick={() => setTab("explorer")}>{copy.explorerTab}</button>
          <button type="button" role="tab" aria-selected={tab === "tablebase"} className={tab === "tablebase" ? "active" : ""} onClick={() => setTab("tablebase")}>{copy.tablebaseTab}</button>
        </div>
      )}
      {!showTabs || tab === "engine"
        ? enginePanel
        : tab === "explorer"
          ? <OpeningExplorerPanel fen={positionFen} />
          : <TablebasePanel fen={positionFen} />}
    </div>
  );
}
