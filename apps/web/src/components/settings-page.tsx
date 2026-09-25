"use client";

import Link from "next/link";
import { FolioHeading } from "./folio-heading";
import { DEPLOYMENT_MODE } from "../lib/deployment";
import { useEffect, useRef, useState } from "react";
import type { CoachLanguage, UiLanguage } from "@chess-review/shared";
import { LibraryBackupPanel } from "./library-backup-panel";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, type AppSettings } from "../lib/app-settings";
import { downloadMaiaModel, type CoachRequestProvider, type MaiaModel } from "../lib/local-ai";
import { ConnectedAccounts } from "./connected-accounts";
import { useLocalAiHealth } from "../lib/use-local-ai-health";
import { useUiLanguage } from "../hooks/use-ui-language";

type SettingsCopy = {
  chapter: string;
  title: string;
  helpLink: string;
  folioLede: (mode: string) => string;
  enhancedLocal: string;
  browserCore: string;
  navAria: string;
  navLanguage: string;
  navAnalysis: string;
  navCoach: string;
  navBoard: string;
  navAccounts: string;
  navBackup: string;
  retention: string;
  kickerInterface: string;
  languageHeading: string;
  interfaceLanguage: string;
  languageBlurb: string;
  kickerReviewDefaults: string;
  objectiveAnalysis: string;
  depth: string;
  depthFast: string;
  depthBalanced: string;
  depthThorough: string;
  engineLabLines: string;
  continuationLines: string;
  movesPerLine: string;
  afterAccountSync: string;
  syncOff: string;
  analyzeNewest1: string;
  analyzeNewest3: string;
  analyzeNewest5: string;
  analysisBlurb: string;
  kickerHumanDefaults: string;
  maiaPrediction: string;
  preferredElo: string;
  maiaModel: string;
  maia5m: string;
  maia23m: string;
  maia79m: string;
  downloading: string;
  downloadModel: string;
  modelReady: (model: string) => string;
  maiaDownloadFailed: string;
  humanBlurb: string;
  kickerCoachDefaults: string;
  explanationLayer: string;
  provider: string;
  ollamaLocal: string;
  openaiCompatible: string;
  cloudBlurb: string;
  coachOutputLanguage: string;
  localModel: string;
  modelNotDetected: (model: string) => string;
  ollamaModelsDetected: (count: number) => string;
  startOllama: string;
  browserCoachBlurb: string;
  kickerBoardFeedback: string;
  boardAndDisplay: string;
  pieceSet: string;
  featherPorcelain: string;
  classicSvg: string;
  coordinates: string;
  insideSquares: string;
  off: string;
  analysisArrows: string;
  qualityBadge: string;
  pieceAnimation: string;
  animNatural: string;
  animFast: string;
  moveEmphasis: string;
  keyMovesOnly: string;
  allAnalyzedMoves: string;
  boardBlurb: string;
  chessSounds: string;
  soundEffects: string;
  volume: (percent: number) => string;
  soundTheme: string;
  soundsBlurb: string;
  kickerCapabilities: string;
  localEnhancements: string;
  coreCapabilities: string;
  checking: string;
  checkRuntime: string;
  maiaStatus: (status: string) => string;
  ollamaStatus: (status: string) => string;
  selectedModel: (installed: boolean) => string;
  apiProvider: (status: string) => string;
  notConfigured: string;
  unreachable: string;
  browserReviewRemains: string;
  noMaia: string;
  enhancedSetupLink: string;
  kickerThisBrowser: string;
  localData: string;
  clearCache: string;
  resetAll: string;
  confirmClearCache: string;
  confirmResetAll: string;
  unableToClear: string;
  unableToSave: string;
  lichessDisconnected: string;
  lichessConnected: string;
  lichessFailed: (reason: string) => string;
  oauthIncomplete: string;
};

const COPY: Record<UiLanguage, SettingsCopy> = {
  en: {
    chapter: "Settings",
    title: "Make room for your game.",
    helpLink: "Help and capabilities →",
    folioLede: (mode) => `${mode} · Your games and review progress are saved in this browser.`,
    enhancedLocal: "Enhanced Local",
    browserCore: "Browser Core",
    navAria: "Settings sections",
    navLanguage: "Language",
    navAnalysis: "Analysis",
    navCoach: "Coach",
    navBoard: "Board",
    navAccounts: "Accounts",
    navBackup: "Backup & data",
    retention: "Games and learning records are saved in this browser. Use Library backup below to keep a recoverable copy. Delete review removes its learning references; an imported source game remains available for a new review. Account game deletion also removes linked reviews. Cleanup pauses background work; reload other open tabs before continuing.",
    kickerInterface: "This interface",
    languageHeading: "Language",
    interfaceLanguage: "Interface language",
    languageBlurb: "Interface language decides the wording of the whole interface, this page included. A lesson is written in the Coach output language, set in Explanation layer.",
    kickerReviewDefaults: "Review defaults",
    objectiveAnalysis: "Objective analysis",
    depth: "Depth",
    depthFast: "10 · Fast",
    depthBalanced: "12 · Balanced",
    depthThorough: "15 · Thorough",
    engineLabLines: "Engine Lab lines",
    continuationLines: "Continuation lines",
    movesPerLine: "Moves shown per line",
    afterAccountSync: "After account sync",
    syncOff: "Off · choose each game",
    analyzeNewest1: "Analyze newest 1",
    analyzeNewest3: "Analyze newest 3",
    analyzeNewest5: "Analyze newest 5",
    analysisBlurb: "Deeper reviews take longer and are cached separately. Engine Lab lines control only the current position. Sync-newest can auto-analyze a few recent games; it never starts Maia or Coach.",
    kickerHumanDefaults: "Human defaults",
    maiaPrediction: "Maia prediction",
    preferredElo: "Preferred target Elo",
    maiaModel: "Maia model",
    maia5m: "Maia-3 5M · Fastest · Recommended for CPU",
    maia23m: "Maia-3 23M · More accurate · Balanced",
    maia79m: "Maia-3 79M · Highest accuracy · Heavy",
    downloading: "Downloading…",
    downloadModel: "Download model",
    modelReady: (model) => `${model} is cached and ready.`,
    maiaDownloadFailed: "Maia model download failed.",
    humanBlurb: "Changing the selector never downloads or loads a checkpoint. Use Download model explicitly. Elo and model identity are remembered across reviews and never change Stockfish evaluation or Move Quality.",
    kickerCoachDefaults: "Coach defaults",
    explanationLayer: "Explanation layer",
    provider: "Provider",
    ollamaLocal: "Ollama · local",
    openaiCompatible: "OpenAI-compatible",
    cloudBlurb: "Cloud explanations send selected positions or whole-game move facts, including headers and player names, through your local gateway to its configured provider. They run only when you request a lesson.",
    coachOutputLanguage: "Coach output language",
    localModel: "Local model",
    modelNotDetected: (model) => `${model} · not detected`,
    ollamaModelsDetected: (count) => `${count} installed Ollama model${count === 1 ? "" : "s"} detected. The selected model is passed explicitly to every request.`,
    startOllama: "Start Ollama and check the local runtime to discover installed models.",
    browserCoachBlurb: "Grounded summaries are built from objective analysis on this device. Generative AI is not provided by this website. Output language changes what a lesson says, never the controls around it; the interface has its own language.",
    kickerBoardFeedback: "Board feedback",
    boardAndDisplay: "Board and display",
    pieceSet: "Piece set",
    featherPorcelain: "Feather Porcelain",
    classicSvg: "Classic SVG",
    coordinates: "Coordinates",
    insideSquares: "Inside the squares",
    off: "Off",
    analysisArrows: "Analysis arrows",
    qualityBadge: "Move Quality badge on the board",
    pieceAnimation: "Piece animation",
    animNatural: "Natural · 160 ms",
    animFast: "Fast · 90 ms",
    moveEmphasis: "Move list emphasis",
    keyMovesOnly: "Key moves only",
    allAnalyzedMoves: "All analyzed moves",
    boardBlurb: "Arrows are the Stockfish and Maia candidates; the practice mistake arrow is never hidden. Emphasis changes how strongly a non-key move is drawn, never whether it is listed. Board size is set from the board toolbar inside a review.",
    chessSounds: "Chess sounds",
    soundEffects: "Sound effects",
    volume: (percent) => `Volume · ${percent}`,
    soundTheme: "Sound theme",
    soundsBlurb: "Feather Porcelain is the default board set. Classic SVG is the previous react-chessboard pieces. Sounds follow legal board transitions.",
    kickerCapabilities: "Available capabilities",
    localEnhancements: "Local enhancements",
    coreCapabilities: "PGN/FEN, Stockfish review, move evidence, grounded summaries, saved review tasks and backups work without an AI service.",
    checking: "Checking…",
    checkRuntime: "Check local runtime",
    maiaStatus: (status) => `Maia · ${status}`,
    ollamaStatus: (status) => `Ollama · ${status}`,
    selectedModel: (installed) => `Selected model · ${installed ? "available" : "not installed"}`,
    apiProvider: (status) => `API provider · ${status}`,
    notConfigured: "Local enhancements are not configured correctly.",
    unreachable: "The local AI service is unreachable.",
    browserReviewRemains: "Browser review remains available.",
    noMaia: "Maia and generative coaching are not offered by this deployment. Use Enhanced Local on your own computer to add them.",
    enhancedSetupLink: "Enhanced Local setup and model help →",
    kickerThisBrowser: "This browser",
    localData: "Local data",
    clearCache: "Clear analysis cache",
    resetAll: "Reset all local data",
    confirmClearCache: "Clear derived analysis cache and pause background work? Games and reviews stay. This page will reload.",
    confirmResetAll: "Erase all local games, reviews, training records, avatars and preferences? Background work will pause. This cannot be undone.",
    unableToClear: "Unable to clear local data. Try again.",
    unableToSave: "Unable to save preferences.",
    lichessDisconnected: "Disconnected in this browser. Lichess could not confirm remote token revocation. You can revoke the application in Lichess account settings; see Help for the link.",
    lichessConnected: "Lichess connected. The encrypted server session is ready for sync.",
    lichessFailed: (reason) => `Lichess connection failed: ${reason}`,
    oauthIncomplete: "OAuth did not complete.",
  },
  "zh-CN": {
    chapter: "设置",
    title: "给这盘棋留出空间。",
    helpLink: "帮助与能力 →",
    folioLede: (mode) => `${mode} · 你的对局和复盘进度保存在这个浏览器里。`,
    enhancedLocal: "本地增强",
    browserCore: "浏览器核心",
    navAria: "设置分区",
    navLanguage: "语言",
    navAnalysis: "分析",
    navCoach: "讲解",
    navBoard: "棋盘",
    navAccounts: "账户",
    navBackup: "备份与数据",
    retention: "对局和学习记录保存在这个浏览器里。用下面的棋库备份保留一份可恢复的副本。删除复盘会移除它的学习引用，导入的源对局仍可重新复盘。删除账号对局也会移除关联的复盘。清理会暂停后台任务；继续前请刷新其他打开的标签页。",
    kickerInterface: "本界面",
    languageHeading: "语言",
    interfaceLanguage: "界面语言",
    languageBlurb: "界面语言决定整个界面的文案，包括这一页。讲解正文使用「讲解层」中设置的教练输出语言。",
    kickerReviewDefaults: "复盘默认值",
    objectiveAnalysis: "客观分析",
    depth: "深度",
    depthFast: "10 · 快速",
    depthBalanced: "12 · 均衡",
    depthThorough: "15 · 深入",
    engineLabLines: "引擎实验室变化",
    continuationLines: "后续变化",
    movesPerLine: "每条变化显示的着法数",
    afterAccountSync: "账户同步之后",
    syncOff: "关 · 逐盘选择",
    analyzeNewest1: "分析最新 1 盘",
    analyzeNewest3: "分析最新 3 盘",
    analyzeNewest5: "分析最新 5 盘",
    analysisBlurb: "更深的复盘更耗时，并单独缓存。引擎实验室的变化只作用于当前局面。同步最新对局可以自动分析几盘最近的棋；它不会启动 Maia 或讲解。",
    kickerHumanDefaults: "人类默认值",
    maiaPrediction: "Maia 预测",
    preferredElo: "目标 Elo",
    maiaModel: "Maia 模型",
    maia5m: "Maia-3 5M · 最快 · 推荐 CPU 使用",
    maia23m: "Maia-3 23M · 更准 · 均衡",
    maia79m: "Maia-3 79M · 最高精度 · 较重",
    downloading: "正在下载…",
    downloadModel: "下载模型",
    modelReady: (model) => `${model} 已缓存，可以使用。`,
    maiaDownloadFailed: "Maia 模型下载失败。",
    humanBlurb: "更改选择器不会下载或加载检查点。请明确使用「下载模型」。Elo 和模型身份会在各次复盘中记住，且不会改变 Stockfish 评分或着法质量。",
    kickerCoachDefaults: "讲解默认值",
    explanationLayer: "讲解层",
    provider: "提供方",
    ollamaLocal: "Ollama · 本地",
    openaiCompatible: "OpenAI 兼容",
    cloudBlurb: "云端讲解会把选定局面或整局着法事实（包括棋头和棋手姓名）经你的本地网关发往其配置的提供方。只有在你请求讲解时才会发送。",
    coachOutputLanguage: "讲解输出语言",
    localModel: "本地模型",
    modelNotDetected: (model) => `${model} · 未检测到`,
    ollamaModelsDetected: (count) => `检测到 ${count} 个已安装的 Ollama 模型。每次请求都会显式传入所选模型。`,
    startOllama: "启动 Ollama 并检查本地运行时，以发现已安装的模型。",
    browserCoachBlurb: "有依据的总结根据本机客观分析生成。本网站不提供生成式 AI。输出语言改变的是讲解正文，而不是周围的控件；界面有自己的语言。",
    kickerBoardFeedback: "棋盘反馈",
    boardAndDisplay: "棋盘与显示",
    pieceSet: "棋子",
    featherPorcelain: "Feather Porcelain",
    classicSvg: "Classic SVG",
    coordinates: "坐标",
    insideSquares: "写在格子内",
    off: "关",
    analysisArrows: "分析箭头",
    qualityBadge: "棋盘上着法质量标记",
    pieceAnimation: "棋子动画",
    animNatural: "自然 · 160 ms",
    animFast: "快速 · 90 ms",
    moveEmphasis: "着法列表强调",
    keyMovesOnly: "仅关键着法",
    allAnalyzedMoves: "全部已分析着法",
    boardBlurb: "箭头是 Stockfish 与 Maia 的候选着；训练中的错着箭头不会被隐藏。强调只改变非关键着法的绘制强度，不决定是否列出。棋盘大小在复盘内的棋盘工具栏设置。",
    chessSounds: "棋声",
    soundEffects: "音效",
    volume: (percent) => `音量 · ${percent}`,
    soundTheme: "音效主题",
    soundsBlurb: "Feather Porcelain 是默认棋子。Classic SVG 是之前的 react-chessboard 棋子。音效跟随合法的棋盘变化。",
    kickerCapabilities: "可用能力",
    localEnhancements: "本地增强",
    coreCapabilities: "PGN/FEN、Stockfish 复盘、着法证据、有依据的总结、已保存的复盘任务和备份，无需 AI 服务即可使用。",
    checking: "正在检查…",
    checkRuntime: "检查本地运行时",
    maiaStatus: (status) => `Maia · ${status}`,
    ollamaStatus: (status) => `Ollama · ${status}`,
    selectedModel: (installed) => `所选模型 · ${installed ? "可用" : "未安装"}`,
    apiProvider: (status) => `API 提供方 · ${status}`,
    notConfigured: "本地增强配置不正确。",
    unreachable: "无法连接本地 AI 服务。",
    browserReviewRemains: "浏览器复盘仍可使用。",
    noMaia: "此部署不提供 Maia 和生成式讲解。可在自己的电脑上使用本地增强来添加它们。",
    enhancedSetupLink: "本地增强设置与模型帮助 →",
    kickerThisBrowser: "此浏览器",
    localData: "本地数据",
    clearCache: "清除分析缓存",
    resetAll: "重置全部本地数据",
    confirmClearCache: "清除派生分析缓存并暂停后台工作？对局和复盘会保留。本页将重新加载。",
    confirmResetAll: "清除全部本地对局、复盘、训练记录、头像和偏好？后台工作将暂停。此操作无法撤销。",
    unableToClear: "无法清除本地数据。请重试。",
    unableToSave: "无法保存偏好。",
    lichessDisconnected: "已在此浏览器断开。Lichess 未能确认远程令牌撤销。你可以在 Lichess 账户设置中撤销该应用；链接见帮助。",
    lichessConnected: "Lichess 已连接。加密的服务器会话已可同步。",
    lichessFailed: (reason) => `Lichess 连接失败：${reason}`,
    oauthIncomplete: "OAuth 未完成。",
  },
};

export function SettingsPage() {
  const copy = COPY[useUiLanguage()];
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const localAi = useLocalAiHealth();
  const health = localAi.health;
  const checking = localAi.state === "checking";
  const enhanced = DEPLOYMENT_MODE === "enhanced-local" && localAi.state !== "not-provided";
  const ollamaModels = health?.coach.ollamaModels ?? [];
  const selectedModelInstalled = ollamaModels.includes(settings.coachModel);
  const humanModelState = health?.maiaModels?.[settings.humanModel] ?? "unavailable";
  const humanModelReady = humanModelState === "active" || humanModelState === "cached";
  const [humanSetupState, setHumanSetupState] = useState<"idle" | "running" | "error">("idle");
  const [humanSetupNotice, setHumanSetupNotice] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const setupInFlight = useRef(false);
  const [dataWorking, setDataWorking] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  async function clearData(scope: "cache" | "all") {
    if (dataWorking) return;
    if (!window.confirm(scope === "cache" ? copy.confirmClearCache : copy.confirmResetAll)) return;
    setDataWorking(true);
    setDataError(null);
    try {
      await (await import("../lib/local-data")).resetLocalData(scope);
      if (scope === "all") window.location.assign("/");
      else window.location.reload();
    } catch (error) { setDataError(error instanceof Error ? error.message : copy.unableToClear); setDataWorking(false); }
  }

  useEffect(() => {
    setSettings(loadAppSettings());
    const params = new URLSearchParams(window.location.search);
    const text = COPY[loadAppSettings().uiLanguage];
    if (params.get("lichess") === "disconnected") setOauthNotice(text.lichessDisconnected);
    if (params.get("lichess") === "connected") setOauthNotice(text.lichessConnected);
    if (params.get("lichess") === "error") setOauthNotice(text.lichessFailed(params.get("reason") ?? text.oauthIncomplete));
  }, []);

  function update(next: AppSettings) {
    try { saveAppSettings(next); setSettings(next); setDataError(null); }
    catch (error) { setDataError(error instanceof Error ? error.message : copy.unableToSave); }
  }

  async function setupHumanModel() {
    if (setupInFlight.current) return;
    setupInFlight.current = true;
    const requestedModel = settings.humanModel;
    setHumanSetupState("running");
    setHumanSetupNotice(null);
    try {
      await downloadMaiaModel(requestedModel);
      await localAi.refresh();
      setHumanSetupState("idle");
      setHumanSetupNotice(COPY[loadAppSettings().uiLanguage].modelReady(requestedModel));
    } catch (error) {
      setHumanSetupState("error");
      setHumanSetupNotice(error instanceof Error ? error.message : COPY[loadAppSettings().uiLanguage].maiaDownloadFailed);
    } finally {
      setupInFlight.current = false;
    }
  }

  return (
    <main className="page-scroll utility-page">
      <FolioHeading chapter={copy.chapter} title={copy.title} actions={<Link className="text-button" href="/help">{copy.helpLink}</Link>}>
        {copy.folioLede(enhanced ? copy.enhancedLocal : copy.browserCore)}
      </FolioHeading>
      <nav className="settings-contents" aria-label={copy.navAria}>
        <a href="#interface-settings">{copy.navLanguage}</a>
        <a href="#analysis-settings">{copy.navAnalysis}</a>
        <a href="#coach-settings">{copy.navCoach}</a>
        <a href="#board-settings">{copy.navBoard}</a>
        <a href="#connected-accounts">{copy.navAccounts}</a>
        <a href="#local-data-settings">{copy.navBackup}</a>
      </nav>
      <div className={`settings-grid${enhanced ? "" : " browser-core-settings"}`}>
        <section id="interface-settings" className="settings-card">
          <div><span className="kicker">{copy.kickerInterface}</span><h2>{copy.languageHeading}</h2></div>
          <label>{copy.interfaceLanguage}<select value={settings.uiLanguage} onChange={(event) => update({ ...settings, uiLanguage: event.target.value as UiLanguage })}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label>
          <small>{copy.languageBlurb}</small>
        </section>
        <section id="analysis-settings" className="settings-card">
          <div><span className="kicker">{copy.kickerReviewDefaults}</span><h2>{copy.objectiveAnalysis}</h2></div>
          <label>{copy.depth}<select value={settings.reviewDepth} onChange={(event) => update({ ...settings, reviewDepth: Number(event.target.value) as AppSettings["reviewDepth"] })}><option value={10}>{copy.depthFast}</option><option value={12}>{copy.depthBalanced}</option><option value={15}>{copy.depthThorough}</option></select></label>
          <label>{copy.engineLabLines}<select value={settings.reviewMultiPv} onChange={(event) => update({ ...settings, reviewMultiPv: Number(event.target.value) as AppSettings["reviewMultiPv"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>{copy.continuationLines}<select value={settings.continuationLines} onChange={(event) => update({ ...settings, continuationLines: Number(event.target.value) as AppSettings["continuationLines"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>{copy.movesPerLine}<select value={settings.continuationLength} onChange={(event) => update({ ...settings, continuationLength: Number(event.target.value) as AppSettings["continuationLength"] })}>{[6, 8, 10, 12, 16].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>{copy.afterAccountSync}<select value={settings.autoAnalyzeImported} onChange={(event) => update({ ...settings, autoAnalyzeImported: Number(event.target.value) as AppSettings["autoAnalyzeImported"] })}><option value={0}>{copy.syncOff}</option><option value={1}>{copy.analyzeNewest1}</option><option value={3}>{copy.analyzeNewest3}</option><option value={5}>{copy.analyzeNewest5}</option></select></label>
          <small>{copy.analysisBlurb}</small>
        </section>
        {enhanced && <section className="settings-card">
          <div><span className="kicker">{copy.kickerHumanDefaults}</span><h2>{copy.maiaPrediction}</h2></div>
          <label>{copy.preferredElo}<input type="number" min={400} max={3000} step={50} value={settings.humanTargetElo} onChange={(event) => update({ ...settings, humanTargetElo: Math.max(400, Math.min(3000, Number(event.target.value))) })} /></label>
          <label>{copy.maiaModel}<select value={settings.humanModel} onChange={(event) => update({ ...settings, humanModel: event.target.value as MaiaModel })}>
            <option value="maia3-5m">{copy.maia5m}</option>
            <option value="maia3-23m">{copy.maia23m}</option>
            <option value="maia3-79m">{copy.maia79m}</option>
          </select></label>
          <div className="human-model-status"><span><i className={`service-dot ${humanModelReady ? "available" : humanModelState === "not-cached" ? "not-installed" : humanModelState}`} />{settings.humanModel} · {humanModelState}</span>
            {!humanModelReady && health?.maia === "available" && <button type="button" className="secondary" disabled={humanSetupState === "running"} onClick={() => void setupHumanModel()}>{humanSetupState === "running" ? copy.downloading : copy.downloadModel}</button>}
          </div>
          {humanSetupNotice && <small role="status">{humanSetupNotice}</small>}
          <small>{copy.humanBlurb}</small>
        </section>}
        <section id="coach-settings" className="settings-card">
          <div><span className="kicker">{copy.kickerCoachDefaults}</span><h2>{copy.explanationLayer}</h2></div>
          {enhanced && <><label>{copy.provider}<select value={settings.coachProvider} onChange={(event) => update({ ...settings, coachProvider: event.target.value as CoachRequestProvider })}><option value="ollama">{copy.ollamaLocal}</option><option value="openai-compatible">{copy.openaiCompatible}</option></select></label>
          {settings.coachProvider === "openai-compatible" && <small role="status">{copy.cloudBlurb}</small>}</>}
          <label>{copy.coachOutputLanguage}<select value={settings.coachLanguage} onChange={(event) => update({ ...settings, coachLanguage: event.target.value as CoachLanguage })}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
          {enhanced && <><label>{copy.localModel}<select value={settings.coachModel} onChange={(event) => update({ ...settings, coachModel: event.target.value })}>
            {!selectedModelInstalled && <option value={settings.coachModel}>{copy.modelNotDetected(settings.coachModel)}</option>}
            {ollamaModels.map((model) => <option value={model} key={model}>{model}</option>)}
          </select></label>
          <small>{ollamaModels.length > 0 ? copy.ollamaModelsDetected(ollamaModels.length) : copy.startOllama}</small></>}
          {!enhanced && <small>{copy.browserCoachBlurb}</small>}
        </section>
        <section id="board-settings" className="settings-card">
          <div><span className="kicker">{copy.kickerBoardFeedback}</span><h2>{copy.boardAndDisplay}</h2></div>
          <label>{copy.pieceSet}<select value={settings.pieceSet} onChange={(event) => update({ ...settings, pieceSet: event.target.value as AppSettings["pieceSet"] })}>
            <option value="liz-blue">{copy.featherPorcelain}</option>
            <option value="classic">{copy.classicSvg}</option>
          </select></label>
          <label>{copy.coordinates}<select value={settings.boardCoordinates} onChange={(event) => update({ ...settings, boardCoordinates: event.target.value as AppSettings["boardCoordinates"] })}>
            <option value="inside">{copy.insideSquares}</option>
            <option value="off">{copy.off}</option>
          </select></label>
          <label className="setting-row"><span>{copy.analysisArrows}</span><input type="checkbox" checked={settings.boardArrows} onChange={(event) => update({ ...settings, boardArrows: event.target.checked })} /></label>
          <label className="setting-row"><span>{copy.qualityBadge}</span><input type="checkbox" checked={settings.boardQualityBadge} onChange={(event) => update({ ...settings, boardQualityBadge: event.target.checked })} /></label>
          <label>{copy.pieceAnimation}<select value={settings.pieceAnimation} onChange={(event) => update({ ...settings, pieceAnimation: event.target.value as AppSettings["pieceAnimation"] })}>
            <option value="natural">{copy.animNatural}</option>
            <option value="fast">{copy.animFast}</option>
            <option value="off">{copy.off}</option>
          </select></label>
          <label>{copy.moveEmphasis}<select value={settings.moveEmphasis} onChange={(event) => update({ ...settings, moveEmphasis: event.target.value as AppSettings["moveEmphasis"] })}>
            <option value="key">{copy.keyMovesOnly}</option>
            <option value="all">{copy.allAnalyzedMoves}</option>
          </select></label>
          <small>{copy.boardBlurb}</small>
        </section>
        <section className="settings-card">
          <div><span className="kicker">{copy.kickerBoardFeedback}</span><h2>{copy.chessSounds}</h2></div>
          <label className="setting-row"><span>{copy.soundEffects}</span><input type="checkbox" checked={settings.soundEnabled} onChange={(event) => update({ ...settings, soundEnabled: event.target.checked })} /></label>
          <label>{copy.volume(Math.round(settings.soundVolume * 100))}<input type="range" min={0} max={100} step={1} value={Math.round(settings.soundVolume * 100)} onChange={(event) => update({ ...settings, soundVolume: Number(event.target.value) / 100 })} /></label>
          <label>{copy.soundTheme}<select value={settings.soundTheme} onChange={() => update({ ...settings, soundTheme: "wintrchess" })}><option value="wintrchess">WintrChess</option></select></label>
          <small>{copy.soundsBlurb}</small>
        </section>
        <section className="settings-card runtime-card">
          <div><span className="kicker">{copy.kickerCapabilities}</span><h2>{enhanced ? copy.localEnhancements : copy.browserCore}</h2></div>
          <p>{copy.coreCapabilities}</p>
          {enhanced ? <>
            <button type="button" className="secondary" onClick={() => void localAi.refresh()} disabled={checking}>{checking ? copy.checking : copy.checkRuntime}</button>
            {health ? <div className="runtime-status">
              <span>{copy.maiaStatus(health.maia)}</span><span>{settings.humanModel} · {humanModelState}</span>
              <span>{copy.ollamaStatus(health.coach.ollama)}</span><span>{copy.selectedModel(selectedModelInstalled)}</span>
              <span>{copy.apiProvider(health.coach.openaiCompatible)}</span>
            </div> : !checking && <p className="service-message">{localAi.state === "not-configured" ? copy.notConfigured : copy.unreachable} {copy.browserReviewRemains}</p>}
          </> : <p>{copy.noMaia}</p>}
          <Link className="text-button" href="/help#enhanced-local">{copy.enhancedSetupLink}</Link>
        </section>
      </div>
      {oauthNotice && <p className="oauth-notice" role="status">{oauthNotice}</p>}
      <ConnectedAccounts />
      <div className="settings-grid">
        <section id="local-data-settings" className="settings-card data-card">
          <div><span className="kicker">{copy.kickerThisBrowser}</span><h2>{copy.localData}</h2></div>
          <p>{copy.retention}</p>
          <LibraryBackupPanel disabled={dataWorking} onBusyChange={setDataWorking} />
          {dataError && <p className="error" role="alert">{dataError}</p>}
          <div className="account-sync-actions">
            <button type="button" className="secondary" disabled={dataWorking} onClick={() => void clearData("cache")}>{copy.clearCache}</button>
            <button type="button" className="secondary danger" disabled={dataWorking} onClick={() => void clearData("all")}>{copy.resetAll}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
