"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { normalizeFen, parsePgn } from "@chess-review/chess-core";
import type { SyncedGame, UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../hooks/use-ui-language";
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

type ImportDeskCopy = {
  chooseOneFile: string;
  couldNotReadFile: string;
  multiplePasted: string;
  couldNotImport: string;
  title: string;
  helpAria: string;
  continueLast: (title: string) => string;
  importSource: string;
  pastePgn: string;
  openFile: string;
  fromAccount: string;
  backToPgn: string;
  orPasteFen: string;
  fileNoticeGames: (name: string, n: number) => string;
  fileNoticeReady: (name: string) => string;
  chooseAGame: string;
  selectOneGame: string;
  otherGamesRemain: string;
  pasteCompletePgn: string;
  pasteExplicitFen: string;
  placeholderPgn: string;
  placeholderFen: string;
  preparingReview: string;
  analyzeGame: string;
  openEngineLab: string;
  choosePgnFile: string;
  readingFile: string;
  chooseAnotherFile: string;
  loadExample: string;
  useStarting: string;
  pgnHelp: string;
  fenHelp: string;
  libraryStays: string;
};

const COPY: Record<UiLanguage, ImportDeskCopy> = {
  en: {
    chooseOneFile: "Choose one PGN file at a time.",
    couldNotReadFile: "This file could not be read. Try again.",
    multiplePasted: "Multiple pasted games",
    couldNotImport: "This chess record could not be imported. Try again.",
    title: "Bring a game in",
    helpAria: "What this desk does with your game",
    continueLast: (title) => `Continue last review · ${title} →`,
    importSource: "Import source",
    pastePgn: "Paste PGN",
    openFile: "Open file",
    fromAccount: "From account",
    backToPgn: "Back to PGN",
    orPasteFen: "Or paste a FEN",
    fileNoticeGames: (name, n) => `${name} · ${n} games. Choose one to analyze.`,
    fileNoticeReady: (name) => `${name} · Ready to analyze.`,
    chooseAGame: "Choose a game",
    selectOneGame: "Select one game…",
    otherGamesRemain: "Other games remain in your file; they are not imported automatically.",
    pasteCompletePgn: "Paste a complete PGN",
    pasteExplicitFen: "Paste an explicit FEN",
    placeholderPgn: "Paste a PGN here",
    placeholderFen: "Paste a FEN here",
    preparingReview: "Preparing review…",
    analyzeGame: "Analyze game →",
    openEngineLab: "Open Engine Lab →",
    choosePgnFile: "Choose PGN file",
    readingFile: "Reading file…",
    chooseAnotherFile: "Choose another file",
    loadExample: "Load example game",
    useStarting: "Use starting position",
    pgnHelp: "Drop a .pgn here or paste it — analysis runs on this machine. ",
    fenHelp: "FEN opens a position study. ",
    libraryStays: "Your library stays in this browser.",
  },
  "zh-CN": {
    chooseOneFile: "一次请只选择一个 PGN 文件。",
    couldNotReadFile: "无法读取这个文件。请再试一次。",
    multiplePasted: "粘贴了多盘对局",
    couldNotImport: "无法导入这份棋谱。请再试一次。",
    title: "导入对局",
    helpAria: "这张桌子如何处理你的对局",
    continueLast: (title) => `继续上次复盘 · ${title} →`,
    importSource: "导入来源",
    pastePgn: "粘贴 PGN",
    openFile: "打开文件",
    fromAccount: "从账号",
    backToPgn: "返回 PGN",
    orPasteFen: "或粘贴 FEN",
    fileNoticeGames: (name, n) => `${name} · ${n} 盘对局。请选择一盘进行分析。`,
    fileNoticeReady: (name) => `${name} · 可以开始分析。`,
    chooseAGame: "选择一盘对局",
    selectOneGame: "请选择一盘对局…",
    otherGamesRemain: "文件中的其他对局仍保留；不会自动导入。",
    pasteCompletePgn: "粘贴完整 PGN",
    pasteExplicitFen: "粘贴明确的 FEN",
    placeholderPgn: "在此粘贴 PGN",
    placeholderFen: "在此粘贴 FEN",
    preparingReview: "正在准备复盘…",
    analyzeGame: "分析对局 →",
    openEngineLab: "打开引擎实验室 →",
    choosePgnFile: "选择 PGN 文件",
    readingFile: "正在读取文件…",
    chooseAnotherFile: "选择另一个文件",
    loadExample: "加载示例对局",
    useStarting: "使用起始局面",
    pgnHelp: "将 .pgn 拖到此处或粘贴——分析在本机运行。",
    fenHelp: "FEN 会打开局面研究。",
    libraryStays: "棋库保存在本浏览器中。",
  },
};

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
export function ImportForm({ latestReview, onPreview, surface = "paper", accountContent }: { accountContent?: ReactNode; latestReview?: ReviewRecord | undefined; onPreview?: (preview: ImportPreview) => void; surface?: "paper" | "instrument" | "embedded" }) {
  const copy = COPY[useUiLanguage()];
  const router = useRouter();
  const [kind, setKind] = useState<ReviewRecordKind>("pgn");
  const [intakeTab, setIntakeTab] = useState<"paste" | "file" | "account">("paste");
  const [input, setInput] = useState("");
  const drafts = useRef({ pgn: "", fen: "" });
  function changeKind(next: ReviewRecordKind) {
    drafts.current[kind] = input;
    setKind(next); setInput(drafts.current[next]);
    setChoices([]); setFileNotice(null); setError(null);
  }
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
    if (files.length !== 1) { setError(copy.chooseOneFile); return; }
    const file = files[0]!;
    reading.current = true; setReadingFile(true); setError(null);
    try { applyPgnChoices(await readPgnFile(file), file.name); }
    catch (cause) { setError(cause instanceof Error ? cause.message : copy.couldNotReadFile); }
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
          applyPgnChoices(games, copy.multiplePasted);
          saving.current = false; setStatus("idle"); return;
        }
      }
      const record = await saveReviewRecord(await buildReviewRecord(sourceKind, value), { restoreDeleted: true });
      if (record.kind === "pgn") window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`);
    } catch (requestError) {
      saving.current = false;
      setError(requestError instanceof Error ? requestError.message : copy.couldNotImport);
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

  const pasteLabel = kind === "pgn" ? copy.pasteCompletePgn : copy.pasteExplicitFen;

  return (
    <>
    <form
      className={`import-card${surface === "paper" ? " paper-panel" : surface === "instrument" ? " instrument-panel" : ""}${dragging ? " drag-active" : ""}`}
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
        <h2 id="import-title">{copy.title}</h2>
        <Link className="import-help-link" href="/help" aria-label={copy.helpAria}>?</Link>
      </div>
      {latestReview && <Link className="home-resume" href={latestReview.kind === "pgn" ? `/review/${latestReview.id}` : `/review/${latestReview.id}/engine`}>{copy.continueLast(latestReview.title)}</Link>}
      <div className="source-tabs" role="group" aria-label={copy.importSource}>
        <button type="button" disabled={busy} aria-pressed={kind === "pgn" && intakeTab === "paste"} className={kind === "pgn" && intakeTab === "paste" ? "active" : ""} onClick={() => { setIntakeTab("paste"); if (kind !== "pgn") { changeKind("pgn"); } }}>{copy.pastePgn}</button>
        <button type="button" disabled={busy} aria-pressed={intakeTab === "file"} className={intakeTab === "file" ? "active" : ""} onClick={() => { setIntakeTab("file"); if (kind !== "pgn") { changeKind("pgn"); } fileInput.current?.click(); }}>{copy.openFile}</button>
        <button type="button" disabled={busy} aria-pressed={intakeTab === "account"} className={intakeTab === "account" ? "active" : ""} onClick={() => { setIntakeTab("account"); if (accountContent) return; const target = document.getElementById("import-accounts") ?? document.getElementById("home-sources") ?? document.querySelector(".home-sources"); target?.scrollIntoView({ block: "nearest" }); }}>{copy.fromAccount}</button>
      </div>
      <div className="import-input-body" hidden={intakeTab === "account" && Boolean(accountContent)}>
      <div className="import-fen-toggle">
        <button type="button" className="text-button" disabled={busy} onClick={() => { setIntakeTab("paste"); if (kind === "fen") { changeKind("pgn"); } else { changeKind("fen"); } setChoices([]); setFileNotice(null); setError(null); }}>
          {kind === "fen" ? copy.backToPgn : copy.orPasteFen}
        </button>
      </div>
      {fileNotice && <p className="import-file-notice" role="status">{choices.length > 1 ? copy.fileNoticeGames(fileNotice, choices.length) : copy.fileNoticeReady(fileNotice)}</p>}
      {choices.length > 1 && <label className="game-choice"><span id="pgn-choice-label">{copy.chooseAGame}</span><select disabled={busy} aria-labelledby="pgn-choice-label" aria-describedby="pgn-choice-help" value={choices.findIndex((choice) => choice.pgn === input)} onChange={(event) => setInput(choices[Number(event.target.value)]?.pgn ?? "")}>
        <option value={-1} disabled>{copy.selectOneGame}</option>{choices.map((choice, index) => <option key={index} value={index}>{choice.label}</option>)}
      </select><small id="pgn-choice-help">{copy.otherGamesRemain}</small></label>}
      <label className="import-field">
        <span className="sr-only">{pasteLabel}</span>
        <textarea
          value={input}
          disabled={busy}
          aria-label={pasteLabel}
          aria-describedby={error ? "import-error" : "import-help"}
          aria-invalid={Boolean(error)}
          onChange={(event) => { setInput(event.target.value); setChoices([]); setFileNotice(null); setError(null); }}
          placeholder={kind === "pgn" ? copy.placeholderPgn : copy.placeholderFen}
          spellCheck={false}
        />
      </label>
      {error && <p id="import-error" className="error" role="alert">{error}</p>}
      <div className="import-actions">
        <button type="submit" className="primary import-submit" disabled={!ready || busy}>
          {status === "saving" ? copy.preparingReview : kind === "pgn" ? copy.analyzeGame : copy.openEngineLab}
        </button>
        <input ref={fileInput} type="file" accept=".pgn" aria-label={copy.choosePgnFile} hidden onChange={(event) => { if (event.target.files?.length) void chooseFile(event.target.files); event.target.value = ""; }} />
        {(fileNotice || readingFile) && (
          <button type="button" className="text-button file-import-trigger" disabled={busy} onClick={() => fileInput.current?.click()}>
            {readingFile ? copy.readingFile : copy.chooseAnotherFile}
          </button>
        )}
      </div>
      <button type="button" className="secondary import-example" disabled={busy} onClick={kind === "pgn" ? loadExample : loadStartingPosition}>
        {kind === "pgn" ? copy.loadExample : copy.useStarting}
      </button>
      <small id="import-help" className="import-note">{kind === "pgn" ? copy.pgnHelp : copy.fenHelp}{copy.libraryStays}</small>
      </div>
    </form>
    {accountContent && <div id="import-accounts" hidden={intakeTab !== "account"}>{accountContent}</div>}
    </>
  );
}

/** Open a game that already exists in a connected account, as a review record. */
export async function openSyncedGameRecord(game: SyncedGame): Promise<string> {
  const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game), { restoreDeleted: true });
  window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
  return record.id;
}
