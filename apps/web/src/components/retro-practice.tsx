"use client";

import { useState } from "react";
import type { GameAnalysisV2, PlayerColor, UiLanguage } from "@chess-review/shared";
import { HUMAN_DIFFICULTY_LABELS, Icon } from "@chess-review/ui";
import type { RetroRuntime } from "../hooks/use-retrospect";
import { useUiLanguage } from "../hooks/use-ui-language";
import { useReviewStore } from "../store/review-store";
import { useReviewRuntime } from "./review-runtime";
import { learnerColorForRecord } from "../lib/player-identity";
import { PIECE_ASSET_DIR } from "../lib/board-piece-assets";
import { practiceSetup, type PracticeSetup, type PracticeSideSetup } from "../lib/practice-setup";

type RetroCopy = {
  white: string;
  black: string;
  position: string;
  positions: string;
  noPositions: string;
  meta: (side: string, count: number, unit: string) => string;
  includeInaccuracies: string;
  practiceSides: (side: string, count: number, unit: string) => string;
  emptyNone: (name: string) => string;
  emptyTheory: (n: number, name: string) => string;
  emptyEvidence: (name: string) => string;
  emptyBoth: (theory: number, evidence: number, name: string) => string;
  practiceYourMistakes: string;
  setupAria: string;
  learnAria: string;
  whichSide: string;
  sideAria: (side: string, count: number, unit: string) => string;
  kicker: string;
  positionProgress: (position: number, total: number) => string;
  previousPosition: string;
  nextPosition: string;
  reviewPractice: string;
  exit: string;
  alreadySeen: string;
  browsedAway: string;
  returnOrSkip: string;
  resumeLearning: string;
  skip: string;
  checkingMove: string;
  returning: string;
  yourTurn: string;
  toMove: (side: string) => string;
  wasPlayed: string;
  lookAtPrefix: string;
  lookAtSuffix: string;
  thatMove: string;
  thatMoveLower: string;
  doesNotKeep: (san: string) => string;
  engineTimeout: string;
  engineUnverified: (san: string) => string;
  makeMove: string;
  selectPiece: string;
  hint: string;
  viewSolution: string;
  showAnswer: string;
  keepsPosition: string;
  goodEnough: (san: string) => string;
  whyNatural: string;
  whyNaturalAria: string;
  humanModel: (model: string, elo: number) => string;
  noRank: string;
  strongerDifficulty: (label: string) => string;
  runHuman: string;
  viewSession: string;
  next: string;
  solution: string;
  bestWas: (san: string) => string;
  practiceSetup: string;
  done: string;
  edit: string;
  playAs: string;
  reset: string;
  setupSummary: (side: string, count: number, unit: string) => string;
  reviewed: (processed: number, side: string, unit: string, solved: number, revealed: number, skipped: number, unavailable: string) => string;
  unavailable: (n: number) => string;
  solvedMeaning: string;
  retryUnsolved: string;
  returnToReview: string;
};

const COPY: Record<UiLanguage, RetroCopy> = {
  en: {
    white: "White",
    black: "Black",
    position: "position",
    positions: "positions",
    noPositions: "No positions",
    meta: (side, count, unit) => `${side} · ${count} ${unit}`,
    includeInaccuracies: "Include inaccuracies",
    practiceSides: (side, count, unit) => `Practice ${side}'s ${count} ${unit}`,
    emptyNone: (name) => `No mistakes were recorded for ${name}.`,
    emptyTheory: (n, name) => `${n} ${n === 1 ? "fault" : "faults"} for ${name} stayed inside recognised opening theory, so there is nothing to practise.`,
    emptyEvidence: (name) => `Engine evidence is not ready for ${name}'s faults yet. Re-analyse the game, or try the other side.`,
    emptyBoth: (theory, evidence, name) => `${theory} opening-theory ${theory === 1 ? "fault" : "faults"} and ${evidence} without usable engine evidence were excluded for ${name}.`,
    practiceYourMistakes: "Practice your mistakes",
    setupAria: "Practice setup",
    learnAria: "Learn from your mistakes",
    whichSide: "Which side to practise",
    sideAria: (side, count, unit) => `${side}, ${count} ${unit}`,
    kicker: "Practice",
    positionProgress: (position, total) => `Position ${position} / ${total}`,
    previousPosition: "Previous position",
    nextPosition: "Next position",
    reviewPractice: "Review practice",
    exit: "Exit",
    alreadySeen: "You have already seen this position\u2019s analysis. Solving it here is practice, not a first-time find.",
    browsedAway: "You browsed away",
    returnOrSkip: "Return to the position to keep solving, or skip it.",
    resumeLearning: "Resume learning",
    skip: "Skip",
    checkingMove: "Checking this move\u2026",
    returning: "Returning to the position\u2026",
    yourTurn: "Your turn",
    toMove: (side) => `${side} to move`,
    wasPlayed: "was played. The arrow marks it.",
    lookAtPrefix: "Look at the piece on ",
    lookAtSuffix: ". The best move starts there — other moves can still keep the position.",
    thatMove: "That move",
    thatMoveLower: "that move",
    doesNotKeep: (san) => `${san} does not keep the position. Try again.`,
    engineTimeout: "The engine timed out, so that move was not marked wrong. Try again or view the answer.",
    engineUnverified: (san) => `The engine could not verify ${san}, so it was not marked wrong. Try again or view the answer.`,
    makeMove: "Make your move →",
    selectPiece: "Select a piece and a square on the board",
    hint: "Hint",
    viewSolution: "View the solution",
    showAnswer: "Show answer",
    keepsPosition: "That move keeps the position",
    goodEnough: (san) => `${san} is good enough — it is not necessarily the only best move.`,
    whyNatural: "Why the original move felt natural",
    whyNaturalAria: "Why the original move felt natural",
    humanModel: (model, elo) => `Human model ${model} at ${elo}`,
    noRank: " · this level's model did not rank the stronger move",
    strongerDifficulty: (label) => ` · difficulty of the stronger move: ${label}`,
    runHuman: "Run this move\u2019s human analysis in Review to see why the original move looked natural at your level.",
    viewSession: "View this session",
    next: "Next",
    solution: "Solution",
    bestWas: (san) => `Best was ${san}. Keep playing this line, or continue.`,
    practiceSetup: "Practice setup",
    done: "Done",
    edit: "Edit",
    playAs: "Play as",
    reset: "Reset",
    setupSummary: (side, count, unit) => `${side} · ${count} ${unit}`,
    reviewed: (processed, side, unit, solved, revealed, skipped, unavailable) =>
      `Reviewed ${processed} ${side} ${unit}: solved ${solved}, viewed ${revealed}, skipped ${skipped}${unavailable}.`,
    unavailable: (n) => `, unavailable ${n}`,
    solvedMeaning: "A solved position is one you found yourself. Viewing the solution is not counted as solving it.",
    retryUnsolved: "Retry unsolved positions",
    returnToReview: "Return to review",
  },
  "zh-CN": {
    white: "白方",
    black: "黑方",
    position: "个局面",
    positions: "个局面",
    noPositions: "没有局面",
    meta: (side, count, unit) => `${side} · ${count} ${unit}`,
    includeInaccuracies: "包含不精确",
    practiceSides: (side, count, unit) => `练习${side}的 ${count} ${unit}`,
    emptyNone: (name) => `${name}没有记录到失误。`,
    emptyTheory: (n, name) => `${name} 有 ${n} 处失误仍在公认开局定式内，因此没有可练的内容。`,
    emptyEvidence: (name) => `${name}的失误还没有引擎证据。请重新分析本局，或试试另一方。`,
    emptyBoth: (theory, evidence, name) => `已为${name}排除 ${theory} 处开局定式失误和 ${evidence} 处缺少可用引擎证据的失误。`,
    practiceYourMistakes: "练习你的失误",
    setupAria: "训练设置",
    learnAria: "从失误中学习",
    whichSide: "练习哪一方",
    sideAria: (side, count, unit) => `${side}，${count} ${unit}`,
    kicker: "训练",
    positionProgress: (position, total) => `局面 ${position} / ${total}`,
    previousPosition: "上一局面",
    nextPosition: "下一局面",
    reviewPractice: "复盘练习",
    exit: "退出",
    alreadySeen: "你已经看过这个局面的分析。在这里解题只是练习，不算第一次发现。",
    browsedAway: "你离开了这个局面",
    returnOrSkip: "回到该局面继续解题，或跳过。",
    resumeLearning: "继续学习",
    skip: "跳过",
    checkingMove: "正在检查这步…",
    returning: "正在回到该局面…",
    yourTurn: "轮到你了",
    toMove: (side) => `${side}走棋`,
    wasPlayed: "是实战着法。箭头标出了它。",
    lookAtPrefix: "看 ",
    lookAtSuffix: " 上的棋子。最佳着法从那里开始——其他着法仍可能保住局面。",
    thatMove: "那步",
    thatMoveLower: "那步",
    doesNotKeep: (san) => `${san} 不能保住局面。请再试。`,
    engineTimeout: "引擎超时，因此这步没有被判错。请再试或查看答案。",
    engineUnverified: (san) => `引擎无法验证 ${san}，因此没有被判错。请再试或查看答案。`,
    makeMove: "走出你的着法 →",
    selectPiece: "在棋盘上选择棋子和格子",
    hint: "提示",
    viewSolution: "查看解答",
    showAnswer: "显示答案",
    keepsPosition: "这步能保住局面",
    goodEnough: (san) => `${san} 已经足够好——不一定是唯一最佳着。`,
    whyNatural: "为什么原来的着法看起来自然",
    whyNaturalAria: "为什么原来的着法看起来自然",
    humanModel: (model, elo) => `人类模型 ${model}，等级 ${elo}`,
    noRank: " · 该等级模型未排到更强的着法",
    strongerDifficulty: (label) => ` · 更强着法的难度：${label}`,
    runHuman: "在复盘中运行这步的人类分析，看看原来的着法在你的水平上为什么显得自然。",
    viewSession: "查看本次练习",
    next: "下一题",
    solution: "解答",
    bestWas: (san) => `最佳是 ${san}。可以继续走这条变化，或进入下一题。`,
    practiceSetup: "训练设置",
    done: "完成",
    edit: "编辑",
    playAs: "执棋",
    reset: "重置",
    setupSummary: (side, count, unit) => `${side} · ${count} ${unit}`,
    reviewed: (processed, side, unit, solved, revealed, skipped, unavailable) =>
      `已复习${side} ${processed} ${unit}：做对 ${solved}，查看答案 ${revealed}，跳过 ${skipped}${unavailable}。`,
    unavailable: (n) => `，不可用 ${n}`,
    solvedMeaning: "做对的局面是你自己找到的。查看解答不算做对。",
    retryUnsolved: "重练未做对的局面",
    returnToReview: "返回复盘",
  },
};

function sideName(color: PlayerColor, copy: RetroCopy): string {
  return color === "white" ? copy.white : copy.black;
}

function unit(count: number, copy: RetroCopy): string {
  return count === 1 ? copy.position : copy.positions;
}

function emptyCopy(side: PracticeSideSetup, copy: RetroCopy): string {
  const name = sideName(side.color, copy);
  const theory = side.excluded.openingTheory;
  const evidence = side.excluded.missingEngineEvidence;
  if (theory === 0 && evidence === 0) return copy.emptyNone(name);
  if (theory > 0 && evidence === 0) return copy.emptyTheory(theory, name);
  if (evidence > 0 && theory === 0) return copy.emptyEvidence(name);
  return copy.emptyBoth(theory, evidence, name);
}

export function RetroPractice({ analysis, foldIdle = false }: { analysis: GameAnalysisV2; foldIdle?: boolean }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const runtime = useReviewRuntime();
  const retro = runtime.retro;
  const currentPly = useReviewStore((store) => store.currentPly);
  const branch = useReviewStore((store) => store.branch);
  // Session-scoped to this review: the choice survives leaving and re-entering
  // the Practice panel, and the store clears it when another game is loaded.
  const practiceColor = useReviewStore((store) => store.practiceColor);
  const setPracticeColor = useReviewStore((store) => store.setPracticeColor);
  // Orientation is not identity: a manual import has no learner, so the side is
  // the visitor's choice and the default is the side with something to practise.
  const knownColor = learnerColorForRecord(runtime.record);

  const setup = practiceSetup({ analysis, includeInaccuracies: retro.includeInaccuracies, selected: practiceColor, knownColor });
  const offTrack = Boolean(
    retro.active
    && retro.locked
    && retro.status !== "evaluating"
    && retro.status !== "rewinding"
    && retro.current
    && branch === null
    && currentPly !== retro.current.promptPly,
  );

  function begin(nextColor: PlayerColor) {
    runtime.pausePlayback();
    retro.start(nextColor);
    document.querySelector(".board-wrap")?.scrollIntoView({ block: "nearest" });
  }

  if (!retro.active) {
    const { startable } = setup;
    const meta = startable.count > 0
      ? copy.meta(sideName(startable.color, copy), startable.count, unit(startable.count, copy))
      : copy.noPositions;
    const body = (
      <>
        <SideChooser setup={setup} onSelect={setPracticeColor} />
        <label className="practice-inline-check">
          <input type="checkbox" checked={retro.includeInaccuracies} onChange={(event) => retro.setIncludeInaccuracies(event.target.checked)} />
          {copy.includeInaccuracies}
        </label>
        {/* Secondary by contract: at the start ply the guided route owns the one
            primary action, and practice is the second layer of that screen. */}
        {startable.count > 0 ? (
          <button type="button" className="secondary retro-idle-start" onClick={() => begin(startable.color)}>
            {copy.practiceSides(sideName(startable.color, copy), startable.count, unit(startable.count, copy))}
          </button>
        ) : (
          <p className="utility-note">{emptyCopy(startable, copy)}</p>
        )}
      </>
    );
    if (foldIdle) {
      return (
        <details className="retro-practice retro-idle review-panel-row" aria-label={copy.practiceYourMistakes}>
          <summary>
            <Icon name="practice" />
            <span className="review-row-copy"><strong>{copy.practiceYourMistakes}</strong></span>
            <span className="review-row-meta">{meta}</span>
            <Icon className="review-row-chevron" name="chevron-right" />
          </summary>
          <div className="review-open-row-body">{body}</div>
        </details>
      );
    }
    return <section className="retro-practice retro-idle" aria-label={copy.setupAria}>
      <p className="practice-heading">{copy.practiceYourMistakes}</p>
      {body}
    </section>;
  }

  const total = retro.totalCount;
  const position = Math.min(retro.currentIndex + 1, Math.max(total, 1));
  // The running session's own colour, which the guided-moment entry
  // (`retro.startAt`) sets from the fault's mover. That deliberately overrides
  // the setup selection: a key moment practises that exact fault, whichever side
  // played it, and the setup selection is restored the next time practice starts
  // from this panel.
  const side = sideName(retro.color, copy);
  const last = retro.currentIndex + 1 >= total;
  const pawnKey = retro.color === "white" ? "wP" : "bP";
  const answering = retro.status === "solving" || retro.status === "rejected";
  const canAdvance = retro.status !== "complete" && retro.status !== "evaluating" && retro.status !== "rewinding";

  function selectDuringSession(nextColor: PlayerColor) {
    setPracticeColor(nextColor);
    const next = setup.sides.find((entry) => entry.color === nextColor);
    if (next && next.count > 0 && nextColor !== retro.color) begin(nextColor);
  }

  function goNext() {
    if (!canAdvance) return;
    if (retro.status === "accepted" || retro.status === "revealed") retro.next();
    else retro.skip();
  }

  const difficulty = retro.current?.comparison?.bestMoveDifficulty;
  const difficultyLabel = difficulty === undefined ? undefined : HUMAN_DIFFICULTY_LABELS[language][difficulty.label];

  return <section className="retro-practice retro-active" aria-label={copy.learnAria} data-status={retro.status}>
    <header className="retro-head">
      <span className="kicker">{copy.kicker}</span>
      <span className="retro-position">
        {copy.positionProgress(position, total)}
        <button type="button" className="retro-position-nav" aria-label={copy.previousPosition} disabled>
          <Icon name="chevron-left" />
        </button>
        <button type="button" className="retro-position-nav" aria-label={copy.nextPosition} disabled={!canAdvance} onClick={goNext}>
          <Icon name="chevron-right" />
        </button>
      </span>
      {retro.answerExposed && <span className="retro-exposure" role="status">{copy.reviewPractice}</span>}
      <button type="button" className="text-button retro-close" onClick={() => retro.stop()}>{copy.exit}</button>
    </header>

    {retro.answerExposed && <p className="retro-lead retro-exposure-note">{copy.alreadySeen}</p>}

    {retro.status === "complete" && <CompletePanel retro={retro} side={side} />}

    {retro.status !== "complete" && retro.current && <div className="retro-panel">
      {offTrack && <>
        <p className="retro-verdict" role="status">{copy.browsedAway}</p>
        <p className="retro-lead">{copy.returnOrSkip}</p>
        <div className="retro-choices">
          <button type="button" className="primary" onClick={() => runtime.navigateToPly(retro.current!.promptPly)}>{copy.resumeLearning}</button>
          <button type="button" className="text-button" onClick={() => retro.skip()}>{copy.skip}</button>
        </div>
      </>}

      {!offTrack && retro.status === "evaluating" && <p className="retro-verdict" role="status">{copy.checkingMove}</p>}
      {!offTrack && retro.status === "rewinding" && <p className="retro-verdict" role="status">{copy.returning}</p>}

      {!offTrack && answering && <>
        <div className="retro-turn">
          <span className="retro-turn-badge" aria-hidden="true">
            <img src={`${PIECE_ASSET_DIR}/${pawnKey}.png`} alt="" width={40} height={40} draggable={false} />
          </span>
          <div>
            <p className="retro-your-turn">{copy.yourTurn}</p>
            <p className="retro-meta">{copy.toMove(side)}</p>
          </div>
        </div>
        <p className="retro-aside retro-quiet">
          <strong>{retro.current.faultLabel}</strong>
          {" "}{copy.wasPlayed}
        </p>
        {retro.hintSquare && (
          <p className="retro-hint" role="status">
            {copy.lookAtPrefix}<strong>{retro.hintSquare}</strong>{copy.lookAtSuffix}
          </p>
        )}
        {retro.status === "rejected" && retro.lastOutcome?.reason !== "engine-unavailable" && retro.lastOutcome?.reason !== "timeout"
          ? <p className="retro-status" role="status">{copy.doesNotKeep(retro.lastOutcome?.attemptedSan ?? copy.thatMove)}</p>
          : null}
        {(retro.lastOutcome?.reason === "engine-unavailable" || retro.lastOutcome?.reason === "timeout") && (
          <p className="retro-status" role="status">
            {retro.lastOutcome.reason === "timeout"
              ? copy.engineTimeout
              : copy.engineUnverified(retro.lastOutcome.attemptedSan ?? copy.thatMoveLower)}
          </p>
        )}
        <button
          type="button"
          className="primary retro-commit"
          onClick={() => document.querySelector(".board-wrap")?.scrollIntoView({ block: "nearest" })}
        >
          {copy.makeMove}
        </button>
        <p className="retro-helper">{copy.selectPiece}</p>
        <div className="retro-choices retro-choices-secondary">
          {retro.hintSquare === null && (
            <button type="button" className="text-button" onClick={retro.useHint}>
              <Icon name="hint" /> {copy.hint}
            </button>
          )}
          <button type="button" className="text-button" aria-label={copy.viewSolution} onClick={() => retro.viewSolution()}>
            <Icon name="answer" /> {copy.showAnswer}
          </button>
          <button type="button" className="text-button" onClick={() => retro.skip()}>{copy.skip}</button>
        </div>
      </>}

      {!offTrack && retro.status === "accepted" && <>
        <p className="retro-verdict solved" role="status">{copy.keepsPosition}</p>
        {retro.lastOutcome?.attemptedSan && <p className="retro-lead">{copy.goodEnough(retro.lastOutcome.attemptedSan)}</p>}
        {retro.current.comparison
          ? <div className="retro-human" aria-label={copy.whyNaturalAria}>
            <strong>{copy.whyNatural}</strong>
            <p>{retro.current.comparison.summary}</p>
            <small>
              {copy.humanModel(retro.current.comparison.model, retro.current.comparison.targetElo)}
              {difficultyLabel === undefined
                ? copy.noRank
                : copy.strongerDifficulty(difficultyLabel)}
            </small>
          </div>
          : runtime.humanServiceState === "available"
            ? <p className="retro-human-note">{copy.runHuman}</p>
            : null}
        <div className="retro-choices">
          <button type="button" className="primary" onClick={() => retro.next()}>{last ? copy.viewSession : copy.next}</button>
        </div>
      </>}

      {!offTrack && retro.status === "revealed" && <>
        <p className="retro-verdict" role="status">{copy.solution}</p>
        <p className="retro-lead">{copy.bestWas(retro.current.bestSan)}</p>
        <div className="retro-choices">
          <button type="button" className="primary" onClick={() => retro.next()}>{last ? copy.viewSession : copy.next}</button>
        </div>
      </>}
    </div>}

    <ActiveSetup
      setup={setup}
      includeInaccuracies={retro.includeInaccuracies}
      onIncludeInaccuracies={retro.setIncludeInaccuracies}
      onSelect={selectDuringSession}
      onReset={() => retro.reset()}
    />
  </section>;
}


function SideChooser({ setup, onSelect }: { setup: PracticeSetup; onSelect: (color: PlayerColor) => void }) {
  const copy = COPY[useUiLanguage()];
  return (
    <div className="practice-setup" role="group" aria-label={copy.whichSide}>
      {setup.sides.map((side) => (
        <button
          key={side.color}
          type="button"
          className="practice-side"
          aria-label={copy.sideAria(sideName(side.color, copy), side.count, unit(side.count, copy))}
          aria-pressed={side.color === setup.selected}
          // An empty side stays in the selector and stays selectable: its
          // explanation is the answer to "why can I not practise this side?".
          data-empty={side.count === 0 ? "true" : undefined}
          onClick={() => onSelect(side.color)}
        >
          <span>{sideName(side.color, copy)}</span>
          <small>{side.count} {unit(side.count, copy)}</small>
        </button>
      ))}
    </div>
  );
}

function ActiveSetup({
  setup,
  includeInaccuracies,
  onIncludeInaccuracies,
  onSelect,
  onReset,
}: {
  setup: PracticeSetup;
  includeInaccuracies: boolean;
  onIncludeInaccuracies: (value: boolean) => void;
  onSelect: (color: PlayerColor) => void;
  onReset: () => void;
}) {
  const copy = COPY[useUiLanguage()];
  const [editing, setEditing] = useState(false);
  const count = setup.startable.count;
  return (
    <div className="practice-active-setup">
      <div className="practice-active-setup-head">
        <strong>{copy.practiceSetup}</strong>
        <button type="button" className="text-button" onClick={() => setEditing((open) => !open)}>
          {editing ? copy.done : copy.edit}
        </button>
      </div>
      {editing ? (
        <>
          <div className="practice-play-as">
            <span>{copy.playAs}</span>
            <SideChooser setup={setup} onSelect={onSelect} />
          </div>
          <label className="practice-inline-check practice-option-row">
            {copy.includeInaccuracies}
            <input type="checkbox" checked={includeInaccuracies} onChange={(event) => onIncludeInaccuracies(event.target.checked)} />
          </label>
          <button type="button" className="text-button practice-reset" onClick={onReset}>
            <Icon name="reset" /> {copy.reset}
          </button>
        </>
      ) : (
        <p className="practice-setup-summary">{copy.setupSummary(sideName(setup.selected, copy), count, unit(count, copy))}</p>
      )}
    </div>
  );
}

function CompletePanel({ retro, side }: { retro: RetroRuntime; side: string }) {
  const copy = COPY[useUiLanguage()];
  const { tally } = retro;
  return <div className="retro-panel">
    <p className="retro-verdict solved" role="status">
      {copy.reviewed(
        tally.processed,
        side,
        unit(tally.processed, copy),
        tally.solved,
        tally.revealed,
        tally.skipped,
        tally.unavailable > 0 ? copy.unavailable(tally.unavailable) : "",
      )}
    </p>
    <p className="retro-lead">{copy.solvedMeaning}</p>
    <div className="retro-choices">
      {tally.solved < tally.processed && <button type="button" className="primary" onClick={() => retro.retryUnsolved()}>{copy.retryUnsolved}</button>}
      <button type="button" className={tally.solved < tally.processed ? "text-button" : "primary"} onClick={() => retro.stop()}>{copy.returnToReview}</button>
    </div>
  </div>;
}
