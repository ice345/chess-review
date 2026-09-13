import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { normalizeFen, parsePgn, type NormalizedGame } from "@chess-review/chess-core";
import {
  MOBILE_ENDPOINT_PROTOCOL_VERSION,
  resolveMobileCapabilities,
  type CoachLanguage,
  type MobileCapabilityId,
  type MobileDecisionReason,
  type MobileEndpointManifestV1,
  type MobileExecutionLane,
} from "@chess-review/shared";
import { BlueBishopMark, WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { isTauri } from "@tauri-apps/api/core";
import { Chessboard } from "react-chessboard";

const EXAMPLE_PGN = `[Event "Mobile companion"]
[White "Blue Bishop"]
[Black "Pocket Study"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *`;

const DEMO_MANIFEST: MobileEndpointManifestV1 = {
  protocolVersion: MOBILE_ENDPOINT_PROTOCOL_VERSION,
  endpointId: "paired-endpoint-preview",
  objective: { available: true, gameAnalysisVersion: 1, stockfishVersion: "18" },
  human: { available: true, maiaModels: ["maia3-5m", "maia3-23m", "maia3-79m"] },
  coach: { available: true, languages: ["en", "zh-CN"] },
};

type Language = CoachLanguage;
type ImportedStudy =
  | { kind: "game"; fileName: string; game: NormalizedGame }
  | { kind: "position"; fileName: string; fen: string };

const copy = {
  en: {
    eyebrow: "Phase 8 · companion feasibility",
    title: "Your review, lighter on the move.",
    intro: "Import and inspect locally. Reuse canonical facts first. Ask a paired engine only when a feature truly needs it.",
    native: "Tauri mobile shell",
    preview: "Browser preview",
    language: "简体中文",
    privacy: "No game or credential leaves this device in this feasibility slice.",
    importTitle: "Pocket study",
    importBody: "Paste a PGN or explicit FEN. Chess rules run in the shared chess-core package, even offline.",
    inputLabel: "PGN or FEN",
    inputPlaceholder: "Paste PGN moves or a six-field FEN…",
    inspect: "Open study",
    choose: "Choose PGN",
    example: "Use example",
    noStudy: "No study open",
    noStudyBody: "Import remains fully on-device.",
    gameReady: "Game ready",
    plies: "plies",
    positionReady: "Position ready",
    parsedBy: "parsed by shared chess-core",
    invalid: "That input is not a readable PGN or FEN.",
    recentMoves: "Moves",
    boardLabel: "Imported position",
    first: "First",
    previous: "Previous",
    next: "Next",
    last: "Last",
    navigation: "Game navigation",
    capabilityTitle: "Capability routing",
    capabilityBody: "This planning simulator exercises the shipped mobile-policy-v1 resolver. It sends no network request.",
    cached: "Canonical review is cached",
    deviceEngine: "Device Stockfish probe passed",
    paired: "Trusted endpoint is paired",
    online: "Network available",
    offline: "Network offline",
    sourceTitle: "Facts stay separated",
    sourceBody: "Stockfish owns objective quality. Maia predicts human choices. Coach explains supplied evidence.",
    footnote: "Heavy Maia and language models are not assumed to fit an ordinary phone.",
  },
  "zh-CN": {
    eyebrow: "Phase 8 · 移动端可行性实现",
    title: "把复盘轻装带在身边。",
    intro: "本地导入与查看，优先复用规范化事实；只有确实需要时，才调用已配对的分析端点。",
    native: "Tauri 移动端壳",
    preview: "浏览器预览",
    language: "English",
    privacy: "此可行性版本不会把棋局或凭据发送出设备。",
    importTitle: "随身棋局",
    importBody: "粘贴 PGN 或明确的 FEN。即使离线，规则解析仍由共享 chess-core 完成。",
    inputLabel: "PGN 或 FEN",
    inputPlaceholder: "粘贴 PGN 着法或六字段 FEN…",
    inspect: "打开棋局",
    choose: "选择 PGN",
    example: "使用示例",
    noStudy: "尚未打开棋局",
    noStudyBody: "导入过程完全在设备上完成。",
    gameReady: "棋局已就绪",
    plies: "半回合",
    positionReady: "局面已就绪",
    parsedBy: "由共享 chess-core 解析",
    invalid: "无法将输入识别为有效的 PGN 或 FEN。",
    recentMoves: "着法",
    boardLabel: "已导入局面",
    first: "开始",
    previous: "上一步",
    next: "下一步",
    last: "结束",
    navigation: "棋局导航",
    capabilityTitle: "能力路由",
    capabilityBody: "此规划模拟器运行已实现的 mobile-policy-v1，不会发送网络请求。",
    cached: "已有规范化复盘缓存",
    deviceEngine: "设备 Stockfish 探测通过",
    paired: "已配对可信端点",
    online: "网络可用",
    offline: "当前离线",
    sourceTitle: "事实来源始终分离",
    sourceBody: "Stockfish 负责客观棋力判断，Maia 预测人类选择，Coach 只解释已有证据。",
    footnote: "普通手机不默认承载重型 Maia 或语言模型。",
  },
} as const;

const capabilityNames: Record<Language, Record<MobileCapabilityId, string>> = {
  en: {
    "game-import": "PGN / FEN import",
    "review-navigation": "Board review",
    "objective-analysis": "Objective analysis",
    "human-analysis": "Human prediction",
    coach: "Grounded coach",
    training: "Training queue",
  },
  "zh-CN": {
    "game-import": "PGN / FEN 导入",
    "review-navigation": "棋盘复盘",
    "objective-analysis": "客观分析",
    "human-analysis": "人类下法预测",
    coach: "有依据的教练",
    training: "训练队列",
  },
};

const laneNames: Record<Language, Record<MobileExecutionLane, string>> = {
  en: { device: "On device", cache: "From cache", remote: "Paired endpoint", deterministic: "Deterministic", unavailable: "Unavailable" },
  "zh-CN": { device: "设备本地", cache: "读取缓存", remote: "配对端点", deterministic: "确定性文本", unavailable: "暂不可用" },
};

const reasonNames: Record<Language, Record<MobileDecisionReason, string>> = {
  en: {
    "local-rules": "Shared legal chess parser",
    "local-review-data": "Imported game is present",
    "canonical-cache": "No new compute needed",
    "device-stockfish": "Verified worker + WASM path",
    "trusted-remote-stockfish": "Versioned Stockfish facts",
    "trusted-remote-maia": "Elo-conditioned Maia service",
    "trusted-remote-coach": "Grounded language service",
    "deterministic-grounded-copy": "No model claim is invented",
    "requires-game": "Import a game or position first",
    "requires-canonical-analysis": "Needs completed objective facts",
    "requires-capable-stockfish": "Needs cache, a proven device engine or pairing",
    "requires-trusted-remote-maia": "Maia stays off ordinary phones",
  },
  "zh-CN": {
    "local-rules": "共享合法棋步解析器",
    "local-review-data": "已导入棋局",
    "canonical-cache": "无需重新计算",
    "device-stockfish": "Worker + WASM 探测已通过",
    "trusted-remote-stockfish": "版本化 Stockfish 事实",
    "trusted-remote-maia": "按 Elo 调节的 Maia 服务",
    "trusted-remote-coach": "基于证据的语言服务",
    "deterministic-grounded-copy": "不虚构模型结论",
    "requires-game": "请先导入棋局或局面",
    "requires-canonical-analysis": "需要已完成的客观分析",
    "requires-capable-stockfish": "需要缓存、可用设备引擎或可信端点",
    "requires-trusted-remote-maia": "普通手机不承载 Maia",
  },
};

function defaultLanguage(): Language {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function readStudy(value: string, fileName: string): ImportedStudy {
  const input = value.trim();
  if (!input) throw new Error("empty input");
  try {
    const game = parsePgn(input);
    if (game.plies.length > 0) return { kind: "game", fileName, game };
  } catch {
    // An explicit FEN gets a second, rules-layer parse below.
  }
  return { kind: "position", fileName, fen: normalizeFen(input) };
}

export function App() {
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const [input, setInput] = useState("");
  const [study, setStudy] = useState<ImportedStudy | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [error, setError] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [cachedAnalysis, setCachedAnalysis] = useState(false);
  const [deviceEngine, setDeviceEngine] = useState(false);
  const [pairedEndpoint, setPairedEndpoint] = useState(false);
  const text = copy[language];

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  function inspect(value = input, fileName = "pasted-study") {
    try {
      setStudy(readStudy(value, fileName));
      setCurrentPly(0);
      setInput(value);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    inspect(await file.text(), file.name);
    event.target.value = "";
  }

  const decisions = useMemo(() => resolveMobileCapabilities({
    cache: {
      game: study !== null,
      objective: cachedAnalysis,
      human: false,
      coach: false,
      training: cachedAnalysis,
    },
    deviceStockfishReady: deviceEngine,
    selectedMaiaModel: "maia3-5m",
    language,
    ...(pairedEndpoint ? {
      remote: {
        online,
        secureTransport: true,
        authenticated: true,
        manifest: DEMO_MANIFEST,
      },
    } : {}),
  }), [cachedAnalysis, deviceEngine, language, online, pairedEndpoint, study]);

  const moves = study?.kind === "game" ? study.game.plies.slice(0, 12) : [];
  const totalPlies = study?.kind === "game" ? study.game.plies.length : 0;
  const positionFen = study?.kind === "game"
    ? currentPly === 0 ? study.game.initialFen : study.game.plies[currentPly - 1]?.fenAfter ?? study.game.finalFen
    : study?.fen;

  return (
    <main className="mobile-shell">
      <header className="mobile-header">
        <a className="brand" href="#top" aria-label="Open Chess Review mobile home">
          <span className="brand-mark"><BlueBishopMark size={27} decorative /></span>
          <span><strong>Open Chess Review</strong><small>Mobile companion</small></span>
        </a>
        <button type="button" className="language-button" onClick={() => setLanguage((current) => current === "en" ? "zh-CN" : "en")}>{text.language}</button>
      </header>

      <section className="mobile-hero" id="top">
        <div className="runtime-line">
          <span>{text.eyebrow}</span>
          <i />
          <span>{isTauri() ? text.native : text.preview}</span>
        </div>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
        <div className="boundary-row" aria-label={text.sourceTitle}>
          <span className="objective">Stockfish</span>
          <span className="human">Maia</span>
          <span className="coach">Coach</span>
        </div>
      </section>

      <section className="study-card" aria-labelledby="study-heading">
        <div className="section-heading">
          <span>01</span>
          <div><h2 id="study-heading">{text.importTitle}</h2><p>{text.importBody}</p></div>
        </div>
        <label className="input-label" htmlFor="study-input">{text.inputLabel}</label>
        <textarea id="study-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={text.inputPlaceholder} rows={6} />
        <div className="study-actions">
          <button type="button" className="primary-action" onClick={() => inspect()}>{text.inspect}</button>
          <label className="secondary-action"><input type="file" accept=".pgn,text/plain,application/x-chess-pgn" onChange={(event) => void importFile(event)} />{text.choose}</label>
          <button type="button" className="text-action" onClick={() => inspect(EXAMPLE_PGN, "mobile-example.pgn")}>{text.example}</button>
        </div>
        <div className={`study-result ${error ? "error" : study ? "ready" : "idle"}`} role="status" aria-live="polite">
          {error ? <><strong>{text.invalid}</strong><span>{text.noStudyBody}</span></> : study?.kind === "game" ? <>
            <strong>{text.gameReady} · {study.game.plies.length} {text.plies}</strong>
            <span>{study.fileName} · {study.game.headers.White ?? "White"} — {study.game.headers.Black ?? "Black"} · {text.parsedBy}</span>
          </> : study?.kind === "position" ? <>
            <strong>{text.positionReady}</strong><span>{study.fen} · {text.parsedBy}</span>
          </> : <><strong>{text.noStudy}</strong><span>{text.noStudyBody}</span></>}
        </div>
        {positionFen && <div className="board-preview" aria-label={text.boardLabel}>
          <Chessboard options={{
            position: positionFen,
            allowDragging: false,
            allowDrawingArrows: false,
            animationDurationInMs: 140,
            ...WINDOWLIGHT_BOARD_APPEARANCE,
          }} />
          {study?.kind === "game" && <div className="board-controls" aria-label={text.navigation}>
            <button type="button" onClick={() => setCurrentPly(0)} disabled={currentPly === 0}>{text.first}</button>
            <button type="button" onClick={() => setCurrentPly((ply) => Math.max(0, ply - 1))} disabled={currentPly === 0}>{text.previous}</button>
            <span>{currentPly} / {totalPlies}</span>
            <button type="button" onClick={() => setCurrentPly((ply) => Math.min(totalPlies, ply + 1))} disabled={currentPly === totalPlies}>{text.next}</button>
            <button type="button" onClick={() => setCurrentPly(totalPlies)} disabled={currentPly === totalPlies}>{text.last}</button>
          </div>}
        </div>}
        {moves.length > 0 && <div className="move-preview"><span>{text.recentMoves}</span><ol>{moves.map((move) => <li key={move.ply} className={currentPly === move.ply ? "active" : undefined}><button type="button" onClick={() => setCurrentPly(move.ply)}><small>{move.moveNumber}{move.color === "black" ? "…" : "."}</small>{move.san}</button></li>)}</ol></div>}
      </section>

      <section className="capability-section" aria-labelledby="capability-heading">
        <div className="section-heading">
          <span>02</span>
          <div><h2 id="capability-heading">{text.capabilityTitle}</h2><p>{text.capabilityBody}</p></div>
        </div>
        <div className="scenario-controls">
          <label><input type="checkbox" checked={cachedAnalysis} onChange={(event) => setCachedAnalysis(event.target.checked)} /><span>{text.cached}</span></label>
          <label><input type="checkbox" checked={deviceEngine} onChange={(event) => setDeviceEngine(event.target.checked)} /><span>{text.deviceEngine}</span></label>
          <label><input type="checkbox" checked={pairedEndpoint} onChange={(event) => setPairedEndpoint(event.target.checked)} /><span>{text.paired}</span></label>
          <em className={online ? "online" : "offline"}>{online ? text.online : text.offline}</em>
        </div>
        <div className="capability-grid">
          {decisions.map((decision) => <article key={decision.capability} className={`capability-card lane-${decision.lane}`}>
            <div><span>{capabilityNames[language][decision.capability]}</span><strong>{laneNames[language][decision.lane]}</strong></div>
            <p>{reasonNames[language][decision.reason]}</p>
          </article>)}
        </div>
      </section>

      <section className="source-card" aria-labelledby="source-heading">
        <div className="source-icon"><BlueBishopMark size={38} decorative /></div>
        <div><h2 id="source-heading">{text.sourceTitle}</h2><p>{text.sourceBody}</p><small>{text.footnote}</small></div>
      </section>

      <footer><span>mobile-policy-v1</span><p>{text.privacy}</p></footer>
    </main>
  );
}
