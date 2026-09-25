"use client";

import Link from "next/link";
import type { SyncedGame, UiLanguage } from "@chess-review/shared";
import { PlatformHeading } from "./platform-heading";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { useUiLanguage } from "../hooks/use-ui-language";
import { applySyncedAnalysisPolicy } from "../lib/auto-analysis";
import type { PlatformSyncMode } from "../lib/platform-sync";
import { ConnectedAccounts } from "./connected-accounts";
import { ImportForm } from "./import-desk";
import { SyncedGamesPanel } from "./synced-games-panel";

type ImportPageCopy = {
  chapter: string;
  title: string;
  openLibrary: string;
  subtitle: string;
  kicker: string;
  oneGame: string;
  clearerUnderstanding: string;
  chooseSource: string;
  checkGame: string;
  openWorkspace: string;
  pgnFenNote: string;
  importHelp: string;
  retryLoading: string;
};

const COPY: Record<UiLanguage, ImportPageCopy> = {
  en: {
    chapter: "Import / Begin a review",
    title: "Bring a game to your desk.",
    openLibrary: "Open library →",
    subtitle: "Paste a game, open a file, or connect a public account.",
    kicker: "A place to begin",
    oneGame: "One game.",
    clearerUnderstanding: "A clearer understanding.",
    chooseSource: "Choose your source",
    checkGame: "Check the game or position",
    openWorkspace: "Open your workspace",
    pgnFenNote: "PGN opens a full game review. FEN opens a position in Engine Lab.",
    importHelp: "Import help →",
    retryLoading: "Retry loading games",
  },
  "zh-CN": {
    chapter: "导入 / 开始复盘",
    title: "把一盘对局带到你的桌上。",
    openLibrary: "打开棋库 →",
    subtitle: "粘贴棋谱、打开文件，或连接公开账号。",
    kicker: "从这里开始",
    oneGame: "一盘对局。",
    clearerUnderstanding: "更清楚的理解。",
    chooseSource: "选择来源",
    checkGame: "核对对局或局面",
    openWorkspace: "打开工作台",
    pgnFenNote: "PGN 打开完整对局复盘。FEN 在引擎实验室中打开局面。",
    importHelp: "导入帮助 →",
    retryLoading: "重新加载对局",
  },
};

export function ImportPage() {
  const copy = COPY[useUiLanguage()];
  const { snapshot, error, loading, refresh } = useLibrarySnapshot();
  const records = snapshot?.records ?? [];
  const games = snapshot?.games ?? [];

  async function applySyncPolicy(games: SyncedGame[], mode: PlatformSyncMode, complete?: boolean) {
    await applySyncedAnalysisPolicy(games, mode, complete);
    refresh();
  }

  return (
    <main className="page-scroll import-page">
      <PlatformHeading chapter={copy.chapter} title={copy.title} actions={<Link className="text-button" href="/history">{copy.openLibrary}</Link>}>{copy.subtitle}</PlatformHeading>
      <section className="import-workspace">
        <aside className="import-guide"><p className="page-kicker">{copy.kicker}</p><h2>{copy.oneGame}<br />{copy.clearerUnderstanding}</h2><ol><li>{copy.chooseSource}</li><li>{copy.checkGame}</li><li>{copy.openWorkspace}</li></ol><p>{copy.pgnFenNote}</p><Link className="text-button" href="/help">{copy.importHelp}</Link></aside>
        <div className="import-source-sheet">
          <ImportForm latestReview={records[0]} surface="embedded" accountContent={<><ConnectedAccounts compact onGamesUpdated={applySyncPolicy} /><SyncedGamesPanel games={games} records={records} statuses={snapshot?.statuses} limit={5} onOpened={refresh} /></>} />
          {error && <p className="error" role="alert">{error} <button type="button" className="text-button" disabled={loading} onClick={() => void refresh()}>{copy.retryLoading}</button></p>}
        </div>
      </section>
    </main>
  );
}
