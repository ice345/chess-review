"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import { playLegalBoardMove } from "@chess-review/chess-core";
import type { SyncedGame, UiLanguage } from "@chess-review/shared";
import { Icon, WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { useBoardPieces } from "../hooks/use-board-pieces";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { useUiLanguage } from "../hooks/use-ui-language";
import type { LibrarySnapshot } from "../lib/library-snapshot";
import { buildReviewRecord, saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { externalGameKey } from "../lib/review-status";
import { STARTING_FEN, openSyncedGameRecord } from "./import-desk";

type HomeCopy = {
  prelude: string;
  kicker: string;
  heroTitle1: string;
  heroTitle2: string;
  heroBody1: string;
  heroBody2: string;
  returnToGame: string;
  importFirstGame: string;
  retryLoading: string;
  startHere: string;
  studyDesk: string;
  onYourDesk: string;
  firstGameAwaits: string;
  openingLibrary: string;
  savedInBrowser: string;
  bringPgn: string;
  continueReview: string;
  bringAGameIn: string;
  practice: string;
  makeHabit: string;
  revisitDecisions: string;
  visitPractice: string;
  explorePosition: string;
  explorePositionHint: string;
  importOrConnect: string;
  helpAndPrivacy: string;
  couldNotOpenPosition: string;
  positionDesk: string;
  followCuriosity: string;
  movePieces: string;
  afterMove: (san: string) => string;
  startingPosition: string;
  undo: string;
  reset: string;
  opening: string;
  openEngineLab: string;
  unableToOpenSynced: string;
  recentGames: string;
  viewAll: string;
  loadingSaved: string;
  recentEmpty: string;
  reviewed: string;
  game: string;
  preparing: string;
  syncedNotReviewed: string;
  showFewer: string;
  showMore: (n: number) => string;
};

const COPY: Record<UiLanguage, HomeCopy> = {
  en: {
    prelude: "Home prelude",
    kicker: "A quiet place to understand chess",
    heroTitle1: "Between each move,",
    heroTitle2: "a little more possibility.",
    heroBody1: "Return to a game. Understand a choice.",
    heroBody2: "Take something new into the next one.",
    returnToGame: "Return to your game",
    importFirstGame: "Import your first game",
    retryLoading: "Retry loading games",
    startHere: "Start here today",
    studyDesk: "Your study desk",
    onYourDesk: "On your desk",
    firstGameAwaits: "Your first game awaits.",
    openingLibrary: "Opening your library…",
    savedInBrowser: "Saved in this browser",
    bringPgn: "Bring a PGN or a position into your personal library.",
    continueReview: "Continue",
    bringAGameIn: "Bring a game in",
    practice: "Practice",
    makeHabit: "Make understanding a habit.",
    revisitDecisions: "Revisit decisions from your own games, one position at a time.",
    visitPractice: "Visit Practice →",
    explorePosition: "Explore a position",
    explorePositionHint: "Open a board without importing a game",
    importOrConnect: "Import or connect an account →",
    helpAndPrivacy: "Help and data privacy →",
    couldNotOpenPosition: "Could not open this position. Please try again.",
    positionDesk: "Position desk",
    followCuriosity: "Follow your curiosity.",
    movePieces: "Move pieces to reach a position, then open it in Engine Lab.",
    afterMove: (san) => `After ${san}`,
    startingPosition: "Starting position · no engine running",
    undo: "Undo",
    reset: "Reset",
    opening: "Opening…",
    openEngineLab: "Open in Engine Lab →",
    unableToOpenSynced: "Unable to open synced game.",
    recentGames: "Recent games",
    viewAll: "View all →",
    loadingSaved: "Loading saved games…",
    recentEmpty: "Imported and synced games will wait here.",
    reviewed: "Reviewed",
    game: "game",
    preparing: "Preparing…",
    syncedNotReviewed: "Synced · not reviewed",
    showFewer: "Show fewer",
    showMore: (n) => `Show ${n} more`,
  },
  "zh-CN": {
    prelude: "首页序曲",
    kicker: "一处安静地理解棋的地方",
    heroTitle1: "每一步之间，",
    heroTitle2: "多一点可能。",
    heroBody1: "回到一盘对局。理解一个选择。",
    heroBody2: "把新的收获带进下一盘。",
    returnToGame: "回到你的对局",
    importFirstGame: "导入你的第一盘对局",
    retryLoading: "重新加载对局",
    startHere: "从这里开始",
    studyDesk: "你的学习桌",
    onYourDesk: "案头",
    firstGameAwaits: "你的第一盘对局在等你。",
    openingLibrary: "正在打开棋库…",
    savedInBrowser: "已保存在本浏览器",
    bringPgn: "把 PGN 或一个局面放进你的个人棋库。",
    continueReview: "继续",
    bringAGameIn: "导入对局",
    practice: "训练",
    makeHabit: "让理解成为习惯。",
    revisitDecisions: "从自己的对局里回看选择，一次一个局面。",
    visitPractice: "前往训练 →",
    explorePosition: "探索一个局面",
    explorePositionHint: "打开棋盘，不必导入对局",
    importOrConnect: "导入或连接账号 →",
    helpAndPrivacy: "帮助与数据隐私 →",
    couldNotOpenPosition: "无法打开这个局面。请再试一次。",
    positionDesk: "局面桌",
    followCuriosity: "跟着好奇心走。",
    movePieces: "挪动棋子到达一个局面，然后在引擎实验室中打开。",
    afterMove: (san) => `走完 ${san}`,
    startingPosition: "起始局面 · 引擎未运行",
    undo: "撤销",
    reset: "重置",
    opening: "正在打开…",
    openEngineLab: "在引擎实验室中打开 →",
    unableToOpenSynced: "无法打开已同步的对局。",
    recentGames: "最近对局",
    viewAll: "查看全部 →",
    loadingSaved: "正在加载已保存的对局…",
    recentEmpty: "导入和同步的对局会等在这里。",
    reviewed: "已复盘",
    game: "对局",
    preparing: "准备中…",
    syncedNotReviewed: "已同步 · 未复盘",
    showFewer: "显示更少",
    showMore: (n) => `再显示 ${n} 条`,
  },
};

export function HomeWorkspace() {
  const copy = COPY[useUiLanguage()];
  const { snapshot, error, loading, refresh } = useLibrarySnapshot();
  const latest = snapshot?.records[0];
  const href = latest ? `/review/${latest.id}${latest.kind === "fen" ? "/engine" : ""}` : "/import";
  return <main className="page-scroll bluebird-home">
    <section className="bluebird-hero" aria-label={copy.prelude}>
      <div className="bluebird-hero-inside">
        <p className="page-kicker">{copy.kicker}</p>
        <h1>{copy.heroTitle1}<br />{copy.heroTitle2}</h1>
        <p>{copy.heroBody1}<br />{copy.heroBody2}</p>
        <Link className="primary-link" href={href}>{latest ? copy.returnToGame : copy.importFirstGame} →</Link>
      </div>
    </section>
    {error && <p role="alert" className="error">{error} <button type="button" className="text-button" disabled={loading} onClick={() => void refresh()}>{copy.retryLoading}</button></p>}
    <div className="home-desk-heading"><h2>{copy.startHere}</h2><span>{copy.studyDesk}</span></div>
    <div className="home-next-grid">
      <section><p className="page-kicker">{copy.onYourDesk}</p><h2>{latest ? latest.title : copy.firstGameAwaits}</h2><p>{loading && !snapshot ? copy.openingLibrary : latest ? snapshot?.statuses.get(latest.id)?.label ?? copy.savedInBrowser : copy.bringPgn}</p><Link className="text-button" href={href}>{latest ? copy.continueReview : copy.bringAGameIn} →</Link></section>
      <section><p className="page-kicker">{copy.practice}</p><h2>{copy.makeHabit}</h2><p>{copy.revisitDecisions}</p><Link className="text-button" href="/training">{copy.visitPractice}</Link></section>
    </div>
    <HomeContinue records={snapshot?.records.slice(0,6) ?? []} games={snapshot?.games.slice(0,8) ?? []} statuses={snapshot?.statuses} loading={loading && !snapshot} onOpened={refresh} />
    <details className="home-position-tools"><summary>{copy.explorePosition} <span>{copy.explorePositionHint}</span></summary><PositionDesk /></details>
    <p className="home-footer"><Link href="/import">{copy.importOrConnect}</Link><Link href="/help">{copy.helpAndPrivacy}</Link></p>
  </main>;
}

function PositionDesk() {
  const copy = COPY[useUiLanguage()];
  const pieces = useBoardPieces();
  const router = useRouter();
  const [played, setPlayed] = useState<{ fen: string; san: string }[]>([]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fen = played.at(-1)?.fen ?? STARTING_FEN;
  async function openPosition() {
    if (opening) return;
    setOpening(true); setError(null);
    try {
      const record = await saveReviewRecord(await buildReviewRecord("fen",fen), { restoreDeleted:true });
      router.push(`/review/${record.id}/engine`);
    } catch { setError(copy.couldNotOpenPosition); setOpening(false); }
  }
  return <div className="position-desk">
    <div className="position-desk-board"><Chessboard options={{ ...WINDOWLIGHT_BOARD_APPEARANCE, position:fen, pieces, allowDragging:!opening, allowDrawingArrows:false, showNotation:true, onPieceDrop:({sourceSquare,targetSquare})=> {
      if (!targetSquare || opening) return false;
      try { const move=playLegalBoardMove(fen,{from:sourceSquare,to:targetSquare}); setPlayed(current=>[...current,{fen:move.fenAfter,san:move.san}]); return true; } catch { return false; }
    } }} /></div>
    <section><p className="page-kicker">{copy.positionDesk}</p><h2>{copy.followCuriosity}</h2><p>{copy.movePieces}</p><p>{played.length ? copy.afterMove(played.at(-1)?.san ?? "") : copy.startingPosition}</p><div className="position-actions"><button type="button" className="secondary" disabled={!played.length || opening} aria-label={copy.undo} onClick={()=>setPlayed(current=>current.slice(0,-1))}><Icon name="undo" /> {copy.undo}</button><button type="button" className="secondary" disabled={!played.length || opening} onClick={()=>setPlayed([])}><Icon name="reset" /> {copy.reset}</button></div><button type="button" className="primary" disabled={opening} onClick={()=>void openPosition()}>{opening ? copy.opening : copy.openEngineLab}</button>{error && <p role="alert" className="error">{error}</p>}</section>
  </div>;
}

function HomeContinue({
  records,
  games,
  statuses,
  loading,
  onOpened,
}: {
  records: ReviewRecord[];
  games: SyncedGame[];
  statuses: LibrarySnapshot["statuses"] | undefined;
  loading?: boolean;
  onOpened: () => void;
}) {
  const copy = COPY[useUiLanguage()];
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compactMobile, setCompactMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 560px)");
    const sync = () => setCompactMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const reviewedKeys = new Set(
    records.flatMap((record) => (record.external ? [externalGameKey(record.external)] : [])),
  );
  const pendingGames = games.filter((game) => !reviewedKeys.has(externalGameKey(game.external)));

  type Row =
    | { kind: "review"; record: ReviewRecord; at: string }
    | { kind: "synced"; game: SyncedGame; at: string };
  const rows: Row[] = [
    ...records.map((record) => ({ kind: "review" as const, record, at: record.updatedAt })),
    ...pendingGames.map((game) => ({ kind: "synced" as const, game, at: game.playedAt })),
  ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 5);

  const limit = compactMobile && !expanded ? 3 : 5;
  const visible = rows.slice(0, limit);
  const canExpand = compactMobile && rows.length > 3;

  async function openGame(game: SyncedGame) {
    if (busyId) return;
    setBusyId(game.id);
    setError(null);
    try {
      const id = await openSyncedGameRecord(game);
      onOpened();
      router.push(`/review/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.unableToOpenSynced);
      setBusyId(null);
    }
  }

  return (
    <section className="home-continue">

      <div className="panel-heading">
        <h2>{copy.recentGames}</h2>
        {records.length > 0 || games.length > 0 ? <Link className="text-button" href="/history">{copy.viewAll}</Link> : null}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p role="status">{copy.loadingSaved}</p> : rows.length === 0 ? (
        <div className="recent-empty">{copy.recentEmpty}</div>
      ) : (
        <>
          <div className="continue-grid">
            {visible.map((row) => row.kind === "review" ? (
              <Link
                href={row.record.kind === "pgn" ? `/review/${row.record.id}` : `/review/${row.record.id}/engine`}
                key={row.record.id}
              >
                <strong>{row.record.title}</strong>
                <small>{row.record.subtitle}</small>
                <em>{statuses?.get(row.record.id)?.label ?? copy.reviewed}</em>
              </Link>
            ) : (
              <button type="button" key={row.game.id} disabled={busyId !== null} onClick={() => void openGame(row.game)}>
                <strong>{row.game.white.username} vs {row.game.black.username}</strong>
                <small>{row.game.timeClass ?? copy.game} · {new Date(row.game.playedAt).toLocaleDateString()}</small>
                <em>{busyId === row.game.id ? copy.preparing : copy.syncedNotReviewed}</em>
              </button>
            ))}
          </div>
          {canExpand ? (
            <button
              type="button"
              className="text-button home-continue-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? copy.showFewer : copy.showMore(rows.length - 3)}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
