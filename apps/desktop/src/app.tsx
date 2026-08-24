import { useState, type ChangeEvent } from "react";
import { parsePgn, type NormalizedGame } from "@chess-review/chess-core";
import { BlueBishopMark } from "@chess-review/ui";

const EXAMPLE_PGN = `[Event "Desktop shell"]
[White "Blue Bishop"]
[Black "Local Study"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 *`;

interface ImportedStudy {
  fileName: string;
  game: NormalizedGame;
}

function describeGame(study: ImportedStudy): string {
  const white = study.game.headers.White ?? "White";
  const black = study.game.headers.Black ?? "Black";
  return `${white} vs ${black} · ${study.game.plies.length} plies`;
}

export function App() {
  const [study, setStudy] = useState<ImportedStudy | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="desktop-shell">
      <header className="desktop-header">
        <a className="desktop-brand" href="#top" aria-label="Open Chess Review desktop home">
          <span className="desktop-mark"><BlueBishopMark size={30} decorative /></span>
          <span><strong>Open Chess Review</strong><small>Objective · Human · Coach</small></span>
        </a>
        <span className="desktop-mode">Desktop preview</span>
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
        </div>

        <section className="desktop-import" aria-labelledby="import-heading">
          <span className="kicker">Local game</span>
          <h2 id="import-heading">Open a PGN study</h2>
          <p>Choose a text PGN from this computer. The first shell milestone inspects it locally; native file associations and the full review workspace follow inside Phase 6.</p>
          <label className="file-button">
            <input type="file" accept=".pgn,text/plain,application/x-chess-pgn" onChange={(event) => void importFile(event)} />
            Choose PGN file
          </label>
          <button className="example-button" onClick={() => inspectPgn(EXAMPLE_PGN, "desktop-example.pgn")}>Use a small example</button>

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
