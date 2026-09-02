"use client";

import { useEffect, useRef, useState } from "react";
import type { CoachLanguage } from "@chess-review/shared";
import { AppHeader } from "./app-header";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, type AppSettings } from "../lib/app-settings";
import { downloadMaiaModel, type CoachRequestProvider, type MaiaModel } from "../lib/local-ai";
import { ConnectedAccounts } from "./connected-accounts";
import { useLocalAiHealth } from "../lib/use-local-ai-health";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const localAi = useLocalAiHealth();
  const health = localAi.health;
  const checking = localAi.state === "checking";
  const ollamaModels = health?.coach.ollamaModels ?? [];
  const selectedModelInstalled = ollamaModels.includes(settings.coachModel);
  const humanModelState = health?.maiaModels?.[settings.humanModel] ?? "unavailable";
  const humanModelReady = humanModelState === "active" || humanModelState === "cached";
  const [humanSetupState, setHumanSetupState] = useState<"idle" | "running" | "error">("idle");
  const [humanSetupNotice, setHumanSetupNotice] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const setupInFlight = useRef(false);

  useEffect(() => {
    setSettings(loadAppSettings());
    const params = new URLSearchParams(window.location.search);
    if (params.get("lichess") === "connected") setOauthNotice("Lichess connected. The encrypted server session is ready for sync.");
    if (params.get("lichess") === "error") setOauthNotice(`Lichess connection failed: ${params.get("reason") ?? "OAuth did not complete."}`);
  }, []);

  function update(next: AppSettings) {
    setSettings(next);
    saveAppSettings(next);
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
      <section className="utility-heading"><h1>Settings</h1></section>
      <div className="settings-grid">
        <section className="settings-card">
          <div><span className="kicker">Review defaults</span><h2>Objective analysis</h2></div>
          <label>Depth<select value={settings.reviewDepth} onChange={(event) => update({ ...settings, reviewDepth: Number(event.target.value) as AppSettings["reviewDepth"] })}><option value={10}>10 · Fast</option><option value={12}>12 · Balanced</option><option value={15}>15 · Thorough</option></select></label>
          <label>Engine Lab lines<select value={settings.reviewMultiPv} onChange={(event) => update({ ...settings, reviewMultiPv: Number(event.target.value) as AppSettings["reviewMultiPv"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Continuation lines<select value={settings.continuationLines} onChange={(event) => update({ ...settings, continuationLines: Number(event.target.value) as AppSettings["continuationLines"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Moves shown per line<select value={settings.continuationLength} onChange={(event) => update({ ...settings, continuationLength: Number(event.target.value) as AppSettings["continuationLength"] })}>{[6, 8, 10, 12, 16].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>After account sync<select value={settings.autoAnalyzeImported} onChange={(event) => update({ ...settings, autoAnalyzeImported: Number(event.target.value) as AppSettings["autoAnalyzeImported"] })}><option value={0}>Off · choose each game</option><option value={1}>Analyze newest 1</option><option value={3}>Analyze newest 3</option><option value={5}>Analyze newest 5</option></select></label>
          <small>Deeper reviews take longer and are cached separately. Engine Lab lines control only the current position. Sync-newest can auto-analyze a few recent games; it never starts Maia or Coach.</small>
        </section>
        <section className="settings-card">
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
        </section>
        <section className="settings-card">
          <div><span className="kicker">Coach defaults</span><h2>Explanation layer</h2></div>
          <label>Provider<select value={settings.coachProvider} onChange={(event) => update({ ...settings, coachProvider: event.target.value as CoachRequestProvider })}><option value="ollama">Ollama · local</option><option value="openai-compatible">OpenAI-compatible</option></select></label>
          {settings.coachProvider === "openai-compatible" && <small role="status">Cloud explanations send structured move facts off this device. Game PGNs stay in the browser unless you paste them elsewhere.</small>}
          <label>Language<select value={settings.coachLanguage} onChange={(event) => update({ ...settings, coachLanguage: event.target.value as CoachLanguage })}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
          <label>Local model<select value={settings.coachModel} onChange={(event) => update({ ...settings, coachModel: event.target.value })}>
            {!selectedModelInstalled && <option value={settings.coachModel}>{settings.coachModel} · not detected</option>}
            {ollamaModels.map((model) => <option value={model} key={model}>{model}</option>)}
          </select></label>
          <small>{ollamaModels.length > 0 ? `${ollamaModels.length} installed Ollama model${ollamaModels.length === 1 ? "" : "s"} detected. The selected model is passed explicitly to every request.` : "Start Ollama and check the local runtime to discover installed models."}</small>
        </section>
        <section className="settings-card">
          <div><span className="kicker">Board feedback</span><h2>Chess sounds</h2></div>
          <label className="sound-enabled-setting"><span>Sound effects</span><input type="checkbox" checked={settings.soundEnabled} onChange={(event) => update({ ...settings, soundEnabled: event.target.checked })} /></label>
          <label>Volume · {Math.round(settings.soundVolume * 100)}<input type="range" min={0} max={100} step={1} value={Math.round(settings.soundVolume * 100)} onChange={(event) => update({ ...settings, soundVolume: Number(event.target.value) / 100 })} /></label>
          <label>Sound theme<select value={settings.soundTheme} onChange={() => update({ ...settings, soundTheme: "wintrchess" })}><option value="wintrchess">WintrChess</option></select></label>
          <small>Move feedback follows legal board transitions. Checkmate, check, castle, promotion, capture and quiet moves use the WintrChess sound set. Use the board control for quick mute.</small>
        </section>
        <section className="settings-card runtime-card">
          <div><span className="kicker">Runtime boundary</span><h2>Local capabilities</h2></div>
          <p>A browser cannot launch native processes. Use <code>pnpm dev</code> for the complete workspace, or <code>pnpm dev:local-ai</code> when the web app is already running. Offline panels reconnect automatically.</p>
          <button type="button" className="secondary" onClick={() => void localAi.refresh()} disabled={checking}>{checking ? "Checking…" : "Check local runtime"}</button>
          {health ? (
            <div className="runtime-status">
              <span><i className={`service-dot ${health.maia}`} />Maia · {health.maia}</span>
              <span><i className={`service-dot ${humanModelReady ? "available" : "not-installed"}`} />Human model · {settings.humanModel} · {humanModelState}</span>
              <span><i className={`service-dot ${health.coach.ollama}`} />Ollama · {health.coach.ollama}</span>
              <span><i className={`service-dot ${selectedModelInstalled ? "available" : "not-installed"}`} />Selected model · {selectedModelInstalled ? "available" : "missing"}</span>
              <span>{ollamaModels.length} installed model{ollamaModels.length === 1 ? "" : "s"} discovered</span>
            </div>
          ) : !checking && <p className="service-message">Local AI is not connected. Browser review remains available.</p>}
          {health?.coach.ollama === "available" && !selectedModelInstalled && (
            <div className="model-setup"><strong>Model setup requires approval</strong><span>Run this yourself when ready:</span><code>ollama pull {settings.coachModel}</code></div>
          )}
        </section>
      </div>
      {oauthNotice && <p className="oauth-notice" role="status">{oauthNotice}</p>}
      <ConnectedAccounts />
      <div className="settings-grid">
        <section className="settings-card data-card">
          <div><span className="kicker">This browser</span><h2>Local data</h2></div>
          <p>Games, reviews, analysis cache, training jobs and settings stay in this browser until you delete them. Disconnecting an account asks whether to keep imported games.</p>
          <div className="account-sync-actions">
            <button type="button" className="secondary" onClick={() => {
              if (!window.confirm("Clear derived Stockfish analysis cache? Reviews and imported games stay.")) return;
              void import("../lib/local-data").then(({ resetLocalData }) => resetLocalData("cache"));
            }}>Clear analysis cache</button>
            <button type="button" className="secondary danger" onClick={() => {
              if (!window.confirm("Erase all Open Chess Review data in this browser? This cannot be undone.")) return;
              void import("../lib/local-data").then(({ resetLocalData }) => resetLocalData("all")).then(() => window.location.assign("/"));
            }}>Reset all local data</button>
          </div>
        </section>
      </div>
    </main>
  );
}
