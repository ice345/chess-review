"use client";

import Link from "next/link";
import { DEPLOYMENT_MODE } from "../lib/deployment";
import { useEffect, useRef, useState } from "react";
import type { CoachLanguage } from "@chess-review/shared";
import { LOCAL_DATA_RETENTION } from "../lib/local-data";
import { AppHeader } from "./app-header";
import { LibraryBackupPanel } from "./library-backup-panel";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, type AppSettings } from "../lib/app-settings";
import { downloadMaiaModel, type CoachRequestProvider, type MaiaModel } from "../lib/local-ai";
import { ConnectedAccounts } from "./connected-accounts";
import { useLocalAiHealth } from "../lib/use-local-ai-health";

export function SettingsPage() {
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
    if (!window.confirm(scope === "cache" ? "Clear derived analysis cache and pause background work? Games and reviews stay. This page will reload." : "Erase all local games, reviews, training records, avatars and preferences? Background work will pause. This cannot be undone.")) return;
    setDataWorking(true);
    setDataError(null);
    try {
      await (await import("../lib/local-data")).resetLocalData(scope);
      if (scope === "all") window.location.assign("/");
      else window.location.reload();
    } catch (error) { setDataError(error instanceof Error ? error.message : "Unable to clear local data. Try again."); setDataWorking(false); }
  }

  useEffect(() => {
    setSettings(loadAppSettings());
    const params = new URLSearchParams(window.location.search);
    if (params.get("lichess") === "disconnected") setOauthNotice("Disconnected in this browser. Lichess could not confirm remote token revocation. You can revoke the application in Lichess account settings; see Help for the link.");
    if (params.get("lichess") === "connected") setOauthNotice("Lichess connected. The encrypted server session is ready for sync.");
    if (params.get("lichess") === "error") setOauthNotice(`Lichess connection failed: ${params.get("reason") ?? "OAuth did not complete."}`);
  }, []);

  function update(next: AppSettings) {
    try { saveAppSettings(next); setSettings(next); setDataError(null); }
    catch (error) { setDataError(error instanceof Error ? error.message : "Unable to save preferences."); }
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
      setHumanSetupNotice(`${requestedModel} is cached and ready.`);
    } catch (error) {
      setHumanSetupState("error");
      setHumanSetupNotice(error instanceof Error ? error.message : "Maia model download failed.");
    } finally {
      setupInFlight.current = false;
    }
  }

  return (
    <main className="page-scroll utility-page">
      <AppHeader />
      <section className="utility-heading"><h1>Settings</h1><p>{enhanced ? "Enhanced Local" : "Browser Core"} · Your games and review progress are saved in this browser.</p><Link className="text-button" href="/help">Help, capabilities and data privacy →</Link></section>
      <div className={`settings-grid${enhanced ? "" : " browser-core-settings"}`}>
        <section className="settings-card">
          <div><span className="kicker">Review defaults</span><h2>Objective analysis</h2></div>
          <label>Depth<select value={settings.reviewDepth} onChange={(event) => update({ ...settings, reviewDepth: Number(event.target.value) as AppSettings["reviewDepth"] })}><option value={10}>10 · Fast</option><option value={12}>12 · Balanced</option><option value={15}>15 · Thorough</option></select></label>
          <label>Engine Lab lines<select value={settings.reviewMultiPv} onChange={(event) => update({ ...settings, reviewMultiPv: Number(event.target.value) as AppSettings["reviewMultiPv"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Continuation lines<select value={settings.continuationLines} onChange={(event) => update({ ...settings, continuationLines: Number(event.target.value) as AppSettings["continuationLines"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Moves shown per line<select value={settings.continuationLength} onChange={(event) => update({ ...settings, continuationLength: Number(event.target.value) as AppSettings["continuationLength"] })}>{[6, 8, 10, 12, 16].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>After account sync<select value={settings.autoAnalyzeImported} onChange={(event) => update({ ...settings, autoAnalyzeImported: Number(event.target.value) as AppSettings["autoAnalyzeImported"] })}><option value={0}>Off · choose each game</option><option value={1}>Analyze newest 1</option><option value={3}>Analyze newest 3</option><option value={5}>Analyze newest 5</option></select></label>
          <small>Deeper reviews take longer and are cached separately. Engine Lab lines control only the current position. Sync-newest can auto-analyze a few recent games; it never starts Maia or Coach.</small>
        </section>
        {enhanced && <section className="settings-card">
          <div><span className="kicker">Human defaults</span><h2>Maia prediction</h2></div>
          <label>Preferred target Elo<input type="number" min={400} max={3000} step={50} value={settings.humanTargetElo} onChange={(event) => update({ ...settings, humanTargetElo: Math.max(400, Math.min(3000, Number(event.target.value))) })} /></label>
          <label>Maia model<select value={settings.humanModel} onChange={(event) => update({ ...settings, humanModel: event.target.value as MaiaModel })}>
            <option value="maia3-5m">Maia-3 5M · Fastest · Recommended for CPU</option>
            <option value="maia3-23m">Maia-3 23M · More accurate · Balanced</option>
            <option value="maia3-79m">Maia-3 79M · Highest accuracy · Heavy</option>
          </select></label>
          <div className="human-model-status"><span><i className={`service-dot ${humanModelReady ? "available" : humanModelState === "not-cached" ? "not-installed" : humanModelState}`} />{settings.humanModel} · {humanModelState}</span>
            {!humanModelReady && health?.maia === "available" && <button type="button" className="secondary" disabled={humanSetupState === "running"} onClick={() => void setupHumanModel()}>{humanSetupState === "running" ? "Downloading…" : "Download model"}</button>}
          </div>
          {humanSetupNotice && <small role="status">{humanSetupNotice}</small>}
          <small>Changing the selector never downloads or loads a checkpoint. Use Download model explicitly. Elo and model identity are remembered across reviews and never change Stockfish evaluation or Move Quality.</small>
        </section>}
        <section className="settings-card">
          <div><span className="kicker">Coach defaults</span><h2>Explanation layer</h2></div>
          {enhanced && <><label>Provider<select value={settings.coachProvider} onChange={(event) => update({ ...settings, coachProvider: event.target.value as CoachRequestProvider })}><option value="ollama">Ollama · local</option><option value="openai-compatible">OpenAI-compatible</option></select></label>
          {settings.coachProvider === "openai-compatible" && <small role="status">Cloud explanations send selected positions or whole-game move facts, including headers and player names, through your local gateway to its configured provider. They run only when you request a lesson.</small>}</>}
          <label>Coach output language<select value={settings.coachLanguage} onChange={(event) => update({ ...settings, coachLanguage: event.target.value as CoachLanguage })}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
          {enhanced && <><label>Local model<select value={settings.coachModel} onChange={(event) => update({ ...settings, coachModel: event.target.value })}>
            {!selectedModelInstalled && <option value={settings.coachModel}>{settings.coachModel} · not detected</option>}
            {ollamaModels.map((model) => <option value={model} key={model}>{model}</option>)}
          </select></label>
          <small>{ollamaModels.length > 0 ? `${ollamaModels.length} installed Ollama model${ollamaModels.length === 1 ? "" : "s"} detected. The selected model is passed explicitly to every request.` : "Start Ollama and check the local runtime to discover installed models."}</small></>}
          {!enhanced && <small>Grounded summaries are built from objective analysis on this device. Generative AI is not provided by this website. Output language does not change the English interface.</small>}
        </section>
        <section className="settings-card">
          <div><span className="kicker">Board feedback</span><h2>Board and display</h2></div>
          <label>Piece set<select value={settings.pieceSet} onChange={(event) => update({ ...settings, pieceSet: event.target.value as AppSettings["pieceSet"] })}>
            <option value="liz-blue">Feather Porcelain</option>
            <option value="classic">Classic SVG</option>
          </select></label>
          <label>Coordinates<select value={settings.boardCoordinates} onChange={(event) => update({ ...settings, boardCoordinates: event.target.value as AppSettings["boardCoordinates"] })}>
            <option value="inside">Inside the squares</option>
            <option value="off">Off</option>
          </select></label>
          <label className="setting-row"><span>Analysis arrows</span><input type="checkbox" checked={settings.boardArrows} onChange={(event) => update({ ...settings, boardArrows: event.target.checked })} /></label>
          <label className="setting-row"><span>Move Quality badge on the board</span><input type="checkbox" checked={settings.boardQualityBadge} onChange={(event) => update({ ...settings, boardQualityBadge: event.target.checked })} /></label>
          <label>Piece animation<select value={settings.pieceAnimation} onChange={(event) => update({ ...settings, pieceAnimation: event.target.value as AppSettings["pieceAnimation"] })}>
            <option value="natural">Natural · 160 ms</option>
            <option value="fast">Fast · 90 ms</option>
            <option value="off">Off</option>
          </select></label>
          <label>Move list emphasis<select value={settings.moveEmphasis} onChange={(event) => update({ ...settings, moveEmphasis: event.target.value as AppSettings["moveEmphasis"] })}>
            <option value="key">Key moves only</option>
            <option value="all">All analyzed moves</option>
          </select></label>
          <small>Arrows are the Stockfish and Maia candidates; the red practice arrow is never hidden. Emphasis changes how strongly a non-key move is drawn, never whether it is listed. Board size is set from the board toolbar inside a review.</small>
        </section>
        <section className="settings-card">
          <div><span className="kicker">Board feedback</span><h2>Chess sounds</h2></div>
          <label className="setting-row"><span>Sound effects</span><input type="checkbox" checked={settings.soundEnabled} onChange={(event) => update({ ...settings, soundEnabled: event.target.checked })} /></label>
          <label>Volume · {Math.round(settings.soundVolume * 100)}<input type="range" min={0} max={100} step={1} value={Math.round(settings.soundVolume * 100)} onChange={(event) => update({ ...settings, soundVolume: Number(event.target.value) / 100 })} /></label>
          <label>Sound theme<select value={settings.soundTheme} onChange={() => update({ ...settings, soundTheme: "wintrchess" })}><option value="wintrchess">WintrChess</option></select></label>
          <small>Feather Porcelain is the default board set. Classic SVG is the previous react-chessboard pieces. Sounds follow legal board transitions.</small>
        </section>
        <section className="settings-card runtime-card">
          <div><span className="kicker">Available capabilities</span><h2>{enhanced ? "Local enhancements" : "Browser Core"}</h2></div>
          <p>PGN/FEN, Stockfish review, move evidence, grounded summaries, saved review tasks and backups work without an AI service.</p>
          {enhanced ? <>
            <button type="button" className="secondary" onClick={() => void localAi.refresh()} disabled={checking}>{checking ? "Checking…" : "Check local runtime"}</button>
            {health ? <div className="runtime-status">
              <span>Maia · {health.maia}</span><span>{settings.humanModel} · {humanModelState}</span>
              <span>Ollama · {health.coach.ollama}</span><span>Selected model · {selectedModelInstalled ? "available" : "not installed"}</span>
              <span>API provider · {health.coach.openaiCompatible}</span>
            </div> : !checking && <p className="service-message">{localAi.state === "not-configured" ? "Local enhancements are not configured correctly." : "The local AI service is unreachable."} Browser review remains available.</p>}
          </> : <p>Maia and generative coaching are not offered by this deployment. Use Enhanced Local on your own computer to add them.</p>}
          <Link className="text-button" href="/help#enhanced-local">Enhanced Local setup and model help →</Link>
        </section>
      </div>
      {oauthNotice && <p className="oauth-notice" role="status">{oauthNotice}</p>}
      <ConnectedAccounts />
      <div className="settings-grid">
        <section className="settings-card data-card">
          <div><span className="kicker">This browser</span><h2>Local data</h2></div>
          <p>{LOCAL_DATA_RETENTION}</p>
          <LibraryBackupPanel disabled={dataWorking} onBusyChange={setDataWorking} />
          {dataError && <p className="error" role="alert">{dataError}</p>}
          <div className="account-sync-actions">
            <button type="button" className="secondary" disabled={dataWorking} onClick={() => void clearData("cache")}>Clear analysis cache</button>
            <button type="button" className="secondary danger" disabled={dataWorking} onClick={() => void clearData("all")}>Reset all local data</button>
          </div>
        </section>
      </div>
    </main>
  );
}
