"use client";

import { useEffect, useState } from "react";
import type { CoachLanguage } from "@chess-review/shared";
import { AppHeader } from "./app-header";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, type AppSettings } from "../lib/app-settings";
import { type CoachRequestProvider } from "../lib/local-ai";
import { ConnectedAccounts } from "./connected-accounts";
import { useLocalAiHealth } from "../lib/use-local-ai-health";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const localAi = useLocalAiHealth();
  const health = localAi.health;
  const checking = localAi.state === "checking";
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

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

  return (
    <main className="page-scroll utility-page">
      <AppHeader />
      <section className="utility-heading"><span className="kicker">Application</span><h1>Settings</h1><p>Choose defaults without mixing engine truth, human modeling and coach generation.</p></section>
      <div className="settings-grid">
        <section className="settings-card">
          <div><span className="kicker">Review defaults</span><h2>Objective analysis</h2></div>
          <label>Depth<select value={settings.reviewDepth} onChange={(event) => update({ ...settings, reviewDepth: Number(event.target.value) as AppSettings["reviewDepth"] })}><option value={10}>10 · Fast</option><option value={12}>12 · Balanced</option><option value={15}>15 · Thorough</option></select></label>
          <label>MultiPV<select value={settings.reviewMultiPv} onChange={(event) => update({ ...settings, reviewMultiPv: Number(event.target.value) as AppSettings["reviewMultiPv"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Continuation lines<select value={settings.continuationLines} onChange={(event) => update({ ...settings, continuationLines: Number(event.target.value) as AppSettings["continuationLines"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Moves shown per line<select value={settings.continuationLength} onChange={(event) => update({ ...settings, continuationLength: Number(event.target.value) as AppSettings["continuationLength"] })}>{[6, 8, 10, 12, 16].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>After account sync<select value={settings.autoAnalyzeImported} onChange={(event) => update({ ...settings, autoAnalyzeImported: Number(event.target.value) as AppSettings["autoAnalyzeImported"] })}><option value={0}>Off · choose each game</option><option value={1}>Analyze newest 1</option><option value={3}>Analyze newest 3</option><option value={5}>Analyze newest 5</option></select></label>
          <small>Depth and MultiPV affect deterministic cache identity. Displayed continuation length does not rerun Stockfish. Automatic account analysis is off by default and runs sequentially.</small>
        </section>
        <section className="settings-card">
          <div><span className="kicker">Coach defaults</span><h2>Explanation layer</h2></div>
          <label>Provider<select value={settings.coachProvider} onChange={(event) => update({ ...settings, coachProvider: event.target.value as CoachRequestProvider })}><option value="ollama">Ollama · local</option><option value="openai-compatible">OpenAI-compatible</option></select></label>
          <label>Language<select value={settings.coachLanguage} onChange={(event) => update({ ...settings, coachLanguage: event.target.value as CoachLanguage })}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
          <label>Local model<input value={settings.coachModel} onChange={(event) => update({ ...settings, coachModel: event.target.value })} /></label>
        </section>
        <section className="settings-card runtime-card">
          <div><span className="kicker">Runtime boundary</span><h2>Local capabilities</h2></div>
          <p>A browser cannot launch native processes. Use <code>pnpm dev</code> for the complete workspace, or <code>pnpm dev:local-ai</code> when the web app is already running. Offline panels reconnect automatically.</p>
          <button className="secondary" onClick={() => void localAi.refresh()} disabled={checking}>{checking ? "Checking…" : "Check local runtime"}</button>
          {health ? (
            <div className="runtime-status">
              <span><i className={`service-dot ${health.maia}`} />Maia · {health.maia}</span>
              <span><i className={`service-dot ${health.coach.ollama}`} />Ollama · {health.coach.ollama}</span>
              <span><i className={`service-dot ${health.coach.ollamaModel}`} />{health.coach.configuredModel} · {health.coach.ollamaModel}</span>
            </div>
          ) : !checking && <p className="service-message">Local AI is not connected. Browser review remains available.</p>}
          {health?.coach.ollamaModel === "missing" && (
            <div className="model-setup"><strong>Model setup requires approval</strong><span>Run this yourself when ready:</span><code>ollama pull {health.coach.configuredModel}</code></div>
          )}
        </section>
      </div>
      {oauthNotice && <p className="oauth-notice" role="status">{oauthNotice}</p>}
      <ConnectedAccounts />
    </main>
  );
}
