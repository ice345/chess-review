"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeFen, parsePgn } from "@chess-review/chess-core";
import type { SyncedGame } from "@chess-review/shared";
import { EXAMPLE_PGN } from "../lib/example-game";
import { inspectPgnImport, readPgnFile, type PgnChoice } from "../lib/pgn-import";
import {
  buildReviewRecord,
  buildReviewRecordFromSyncedGame,
  saveReviewRecord,
  type ReviewRecord,
  type ReviewRecordKind,
} from "../lib/review-library";

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface ImportPreview {
  fen: string;
  /** The input parses as the selected format. */
  previewable: boolean;
  kind: ReviewRecordKind;
  /** The field is not empty. */
  hasInput: boolean;
}

export function previewImport(kind: ReviewRecordKind, input: string): { fen: string; previewable: boolean } {
  const value = input.trim();
  if (!value) return { fen: STARTING_FEN, previewable: false };
  try {
    return { fen: kind === "fen" ? normalizeFen(value) : parsePgn(value).initialFen, previewable: true };
  } catch {
    return { fen: STARTING_FEN, previewable: false };
  }
}

/**
 * The import form. One component serves the landing desk and the /import route
 * so a rule about what may be imported exists in exactly one place.
 *
 * `latestReview` only feeds the "continue where you left off" line; the caller
 * owns the library snapshot, because loading it twice in one tree would index
 * the whole library twice.
 */
export function ImportForm({ latestReview, onPreview, surface = "paper" }: { latestReview?: ReviewRecord | undefined; onPreview?: (preview: ImportPreview) => void; surface?: "paper" | "instrument" }) {
  const router = useRouter();
  const [kind, setKind] = useState<ReviewRecordKind>("pgn");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [readingFile, setReadingFile] = useState(false);
  const reading = useRef(false);
  const [choices, setChoices] = useState<PgnChoice[]>([]);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = status === "saving" || readingFile;

  function applyPgnChoices(next: PgnChoice[], notice: string) {
    setKind("pgn"); setChoices(next.length > 1 ? next : []);
    setInput(next.length === 1 ? next[0]!.pgn : "");
    setFileNotice(notice); setError(null);
  }

  async function chooseFile(files: FileList | File[]) {
    if (saving.current || reading.current) return;
    if (files.length !== 1) { setError("Choose one PGN file at a time."); return; }
    const file = files[0]!;
    reading.current = true; setReadingFile(true); setError(null);
    try { applyPgnChoices(await readPgnFile(file), file.name); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This file could not be read. Try again."); }
    finally { reading.current = false; setReadingFile(false); }
  }

  const preview = useMemo(() => previewImport(kind, input), [kind, input]);
  const ready = input.trim() !== "";

  // The caller may render a board beside the form. Held in a ref so an unstable
  // callback identity cannot re-fire the effect on every render.
  const previewListener = useRef(onPreview);
  useEffect(() => { previewListener.current = onPreview; });
  useEffect(() => { previewListener.current?.({ ...preview, kind, hasInput: ready }); }, [preview, kind, ready]);

  async function openReview(value = input, sourceKind = kind) {
    if (saving.current || reading.current) return;
    saving.current = true;
    setStatus("saving");
    setError(null);
    try {
      if (sourceKind === "pgn") {
        const games = inspectPgnImport(value);
        if (games.length > 1) {
          applyPgnChoices(games, "Multiple pasted games");
          saving.current = false; setStatus("idle"); return;
        }
      }
      const record = await saveReviewRecord(await buildReviewRecord(sourceKind, value), { restoreDeleted: true });
      if (record.kind === "pgn") window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`);
    } catch (requestError) {
      saving.current = false;
      setError(requestError instanceof Error ? requestError.message : "This chess record could not be imported. Try again.");
      setStatus("idle");
    }
  }

  function loadExample() {
    setKind("pgn");
    setInput(EXAMPLE_PGN); setChoices([]); setFileNotice(null);
    setError(null);
    void openReview(EXAMPLE_PGN, "pgn");
  }

  function loadStartingPosition() {
    setKind("fen");
    setInput(STARTING_FEN);
    setError(null);
  }

  return (
    <form
      className={`import-card ${surface === "instrument" ? "instrument-panel" : "paper-panel"}${dragging ? " drag-active" : ""}`}
      aria-busy={busy}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files); }}
      aria-labelledby="import-title"
      onSubmit={(event) => {
        event.preventDefault();
        void openReview();
      }}
    >
      <div className="import-heading">
        <h2 id="import-title">Bring a game in</h2>
        <Link className="import-help-link" href="/help" aria-label="What this desk does with your game">?</Link>
      </div>
      {latestReview && <Link className="home-resume" href={latestReview.kind === "pgn" ? `/review/${latestReview.id}` : `/review/${latestReview.id}/engine`}>Continue last review · {latestReview.title} →</Link>}
      <div className="source-tabs" role="group" aria-label="Import source">
        <button type="button" disabled={busy} aria-pressed={kind === "pgn"} className={kind === "pgn" ? "active" : ""} onClick={() => { if (kind === "pgn") return; setKind("pgn"); setInput(""); setChoices([]); setFileNotice(null); setError(null); }}>PGN</button>
        <button type="button" disabled={busy} aria-pressed={kind === "fen"} className={kind === "fen" ? "active" : ""} onClick={() => { if (kind === "fen") return; setKind("fen"); setInput(""); setChoices([]); setFileNotice(null); setError(null); }}>FEN</button>
      </div>
      {fileNotice && <p className="import-file-notice" role="status">{fileNotice}{choices.length > 1 ? ` · ${choices.length} games. Choose one to analyze.` : " · Ready to analyze."}</p>}
      {choices.length > 1 && <label className="game-choice"><span id="pgn-choice-label">Choose a game</span><select disabled={busy} aria-labelledby="pgn-choice-label" aria-describedby="pgn-choice-help" value={choices.findIndex((choice) => choice.pgn === input)} onChange={(event) => setInput(choices[Number(event.target.value)]?.pgn ?? "")}>
        <option value={-1} disabled>Select one game…</option>{choices.map((choice, index) => <option key={index} value={index}>{choice.label}</option>)}
      </select><small id="pgn-choice-help">Other games remain in your file; they are not imported automatically.</small></label>}
      <label className="import-field">
        <span className="sr-only">{kind === "pgn" ? "Paste a complete PGN" : "Paste an explicit FEN"}</span>
        <textarea
          value={input}
          disabled={busy}
          aria-label={kind === "pgn" ? "Paste a complete PGN" : "Paste an explicit FEN"}
          aria-describedby={error ? "import-error" : "import-help"}
          aria-invalid={Boolean(error)}
          onChange={(event) => { setInput(event.target.value); setChoices([]); setFileNotice(null); setError(null); }}
          placeholder={kind === "pgn" ? "Paste a complete PGN…\n[Event \"Casual game\"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 …" : "Paste an explicit FEN…"}
          spellCheck={false}
        />
      </label>
      {error && <p id="import-error" className="error" role="alert">{error}</p>}
      <div className="import-actions">
        <button type="submit" className="primary import-submit" disabled={!ready || busy}>
          {status === "saving" ? "Preparing review…" : kind === "pgn" ? "Analyze game →" : "Open Engine Lab →"}
        </button>
        <input ref={fileInput} type="file" accept=".pgn" aria-label="Choose PGN file" hidden onChange={(event) => { if (event.target.files?.length) void chooseFile(event.target.files); event.target.value = ""; }} />
        <button type="button" className="text-button file-import-trigger" disabled={busy} onClick={() => fileInput.current?.click()}>{readingFile ? "Reading file…" : "Open PGN file"}</button>
      </div>
      <button type="button" className="secondary import-example" disabled={busy} onClick={kind === "pgn" ? loadExample : loadStartingPosition}>
        {kind === "pgn" ? "Load example game" : "Use starting position"}
      </button>
      <small id="import-help" className="import-note">{kind === "pgn" ? "Drop a .pgn here or paste it — analysis runs on this machine. " : "FEN opens a position study. "}Your library stays in this browser.</small>
    </form>
  );
}

/** Open a game that already exists in a connected account, as a review record. */
export async function openSyncedGameRecord(game: SyncedGame): Promise<string> {
  const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game), { restoreDeleted: true });
  window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
  return record.id;
}
