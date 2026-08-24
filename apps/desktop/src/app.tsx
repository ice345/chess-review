import { useEffect, useState, type ChangeEvent } from "react";
import { parsePgn, type NormalizedGame } from "@chess-review/chess-core";
import { BlueBishopMark } from "@chess-review/ui";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const EXAMPLE_PGN = `[Event "Desktop shell"]
[White "Blue Bishop"]
[Black "Local Study"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 *`;

interface ImportedStudy {
  fileName: string;
  game: NormalizedGame;
}

interface NativePgnDocument {
  fileName: string;
  contents: string;
}

interface NativeServiceStatus {
  ollama: "checking" | "available" | "starting" | "started" | "not-installed" | "error";
  owned: boolean;
  models: string[];
  configuredModel: string;
  message: string;
  localAi: "checking" | "available" | "starting" | "started" | "not-packaged" | "error";
  localAiOwned: boolean;
  localAiMessage: string;
}

function describeGame(study: ImportedStudy): string {
  const white = study.game.headers.White ?? "White";
  const black = study.game.headers.Black ?? "Black";
  return `${white} vs ${black} · ${study.game.plies.length} plies`;
}

export function App() {
  const [study, setStudy] = useState<ImportedStudy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<NativeServiceStatus | null>(null);
  const nativeRuntime = isTauri();

  function inspectPgn(pgn: string, fileName: string) {
    try {
      const game = parsePgn(pgn);
      if (game.plies.length === 0) throw new Error("The PGN contains no moves.");
      setStudy({ fileName, game });
      setError(null);
    } catch (reason) {
      setStudy(null);
      setError(reason instanceof Error ? reason.message : "The PGN could not be read.");
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    inspectPgn(await file.text(), file.name);
    event.target.value = "";
  }

  async function openNativePgn() {
    try {
      const document = await invoke<NativePgnDocument | null>("open_pgn_dialog");
      if (document) inspectPgn(document.contents, document.fileName);
    } catch (reason) {
      setStudy(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  useEffect(() => {
    if (!nativeRuntime) return;
    let active = true;
    let unlisten: UnlistenFn | undefined;
    void (async () => {
      unlisten = await listen<NativePgnDocument>("desktop://pgn-opened", (event) => {
        if (!active) return;
        inspectPgn(event.payload.contents, event.payload.fileName);
        void invoke("take_pending_pgn");
      });
      const pending = await invoke<NativePgnDocument | null>("take_pending_pgn");
      if (active && pending) inspectPgn(pending.contents, pending.fileName);
    })().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [nativeRuntime]);

  useEffect(() => {
    if (!nativeRuntime) return;
    let active = true;
    let unlisten: UnlistenFn | undefined;
    void (async () => {
      unlisten = await listen<NativeServiceStatus>("desktop://services-changed", (event) => {
        if (active) setServiceStatus(event.payload);
      });
      const current = await invoke<NativeServiceStatus>("native_service_status");
      if (active) setServiceStatus(current);
    })().catch(() => undefined);
    return () => {
      active = false;
      unlisten?.();
    };
  }, [nativeRuntime]);

  async function refreshServices() {
    if (!nativeRuntime) return;
    setServiceStatus((current) => current ? { ...current, ollama: "checking", message: "Checking local Ollama…" } : null);
    setServiceStatus(await invoke<NativeServiceStatus>("refresh_native_services"));
  }

  return (
    <main className="desktop-shell">
      <header className="desktop-header">
        <a className="desktop-brand" href="#top" aria-label="Open Chess Review desktop home">
          <span className="desktop-mark"><BlueBishopMark size={30} decorative /></span>
          <span><strong>Open Chess Review</strong><small>Objective · Human · Coach</small></span>
        </a>
        <span className="desktop-mode">{nativeRuntime ? "Native PGN ready" : "Desktop preview"}</span>
      </header>

      <section className="desktop-hero" id="top">
        <div className="desktop-intro">
          <span className="kicker">Phase 6 · native workspace</span>
          <h1>Your chess study,<br />at home on the desktop.</h1>
          <p>The native shell stays deliberately thin. Legal chess parsing and visual identity already come from the same canonical packages as the web application.</p>
          <div className="source-boundaries" aria-label="Analysis source boundaries">
            <span><i className="objective" />Stockfish owns objective truth</span>
            <span><i className="human" />Maia predicts human choices</span>
            <span><i className="coach" />Coach explains grounded facts</span>
          </div>
          {nativeRuntime && serviceStatus && <section className="native-services" aria-label="Native service status">
            <div><span>Enhanced local mode</span><strong>Ollama · {serviceStatus.ollama}{serviceStatus.owned ? " · app managed" : ""}</strong></div>
            <p>{serviceStatus.message}</p>
            <small>{serviceStatus.models.length > 0 ? `${serviceStatus.models.length} installed models · configured ${serviceStatus.configuredModel}` : `Configured model · ${serviceStatus.configuredModel}`}</small>
            <div><span>Human analysis + Coach bridge</span><strong>local-ai · {serviceStatus.localAi}{serviceStatus.localAiOwned ? " · app managed" : ""}</strong></div>
            <p>{serviceStatus.localAiMessage}</p>
            <button type="button" onClick={() => void refreshServices()} disabled={serviceStatus.ollama === "checking" || serviceStatus.ollama === "starting" || serviceStatus.localAi === "checking" || serviceStatus.localAi === "starting"}>Refresh services</button>
            {!serviceStatus.models.includes(serviceStatus.configuredModel) && <code>Explicit setup: ollama pull {serviceStatus.configuredModel}</code>}
          </section>}
        </div>

        <section className="desktop-import" aria-labelledby="import-heading">
          <span className="kicker">Local game</span>
          <h2 id="import-heading">Open a PGN study</h2>
          <p>Choose a PGN with the native system dialog, or open a .pgn file with this app. Parsing stays inside the shared chess-core package.</p>
          {nativeRuntime ? <button type="button" className="file-button" onClick={() => void openNativePgn()}>Open PGN…</button> : <label className="file-button">
            <input type="file" accept=".pgn,text/plain,application/x-chess-pgn" onChange={(event) => void importFile(event)} />
            Choose PGN file
          </label>}
          <button type="button" className="example-button" onClick={() => inspectPgn(EXAMPLE_PGN, "desktop-example.pgn")}>Use a small example</button>

          <div className={`import-result ${error ? "error" : study ? "ready" : "idle"}`} role="status">
            {error ? <><strong>Could not open that game</strong><span>{error}</span></> : study ? <>
              <strong>{describeGame(study)}</strong>
              <span>{study.fileName} · parsed by @chess-review/chess-core</span>
            </> : <><strong>No game open</strong><span>PGN stays on this device.</span></>}
          </div>
        </section>
      </section>

      <footer className="desktop-footer">
        <span>Browser Core remains a complete web mode.</span>
        <span>Desktop-native services are added without copying analysis semantics.</span>
      </footer>
    </main>
  );
}
