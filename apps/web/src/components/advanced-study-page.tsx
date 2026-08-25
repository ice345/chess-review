"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildAdvancedStudyReport, type RecurringWeakness } from "@chess-review/analysis";
import type { StudyWeaknessKind, TrainingQueueItemV1, TrainingQueueStatus } from "@chess-review/shared";
import { QUALITY_META, QualityIcon } from "@chess-review/ui";
import { AppHeader } from "./app-header";
import { loadStudyPlayerLibraries, type StudyPlayerLibrary } from "../lib/advanced-study-library";
import {
  createTrainingQueueItem,
  listTrainingQueue,
  removeTrainingQueueItem,
  saveTrainingQueueItem,
  trainingQueueItemId,
  transitionTrainingQueueItem,
} from "../lib/training-queue";

const WEAKNESS_COPY: Record<StudyWeaknessKind, { title: string; description: string }> = {
  "opening-decisions": {
    title: "Opening decisions",
    description: "Repeated objective errors before the structural middlegame boundary.",
  },
  "middlegame-decisions": {
    title: "Middlegame decisions",
    description: "Repeated objective errors in structurally complex middlegame positions.",
  },
  "endgame-decisions": {
    title: "Endgame decisions",
    description: "Repeated objective errors after the canonical structural endgame boundary.",
  },
  "missed-opportunities": {
    title: "Missed opportunities",
    description: "Repeated Miss, Missed win or Missed mate classifications from Stockfish evidence.",
  },
};

function formattedAccuracy(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(1);
}

function gameCountLabel(count: number): string {
  return `${count} ${count === 1 ? "game" : "games"}`;
}

function queueActionLabel(status: TrainingQueueStatus): string {
  if (status === "queued") return "Start";
  if (status === "in-progress") return "Complete";
  return "Reopen";
}

function nextQueueStatus(status: TrainingQueueStatus): TrainingQueueStatus {
  if (status === "queued") return "in-progress";
  if (status === "in-progress") return "completed";
  return "queued";
}

export function AdvancedStudyPage() {
  const [players, setPlayers] = useState<StudyPlayerLibrary[] | null>(null);
  const [playerKey, setPlayerKey] = useState("");
  const [queue, setQueue] = useState<TrainingQueueItemV1[]>([]);
  const [openingLimit, setOpeningLimit] = useState(12);
  const [workingItem, setWorkingItem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const working = useRef(false);

  useEffect(() => {
    let active = true;
    void loadStudyPlayerLibraries().then((nextPlayers) => {
      if (!active) return;
      setPlayers(nextPlayers);
      setPlayerKey((current) => current && nextPlayers.some(({ key }) => key === current) ? current : nextPlayers[0]?.key ?? "");
    }).catch((error) => {
      if (!active) return;
      setPlayers([]);
      setNotice(error instanceof Error ? error.message : "Unable to load advanced study data.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setOpeningLimit(12);
    if (!playerKey) {
      setQueue([]);
      return;
    }
    void listTrainingQueue(playerKey).then((items) => {
      if (active) setQueue(items);
    }).catch((error) => {
      if (!active) return;
      setNotice(error instanceof Error ? error.message : "Unable to load the training queue.");
    });
    return () => { active = false; };
  }, [playerKey]);

  const player = players?.find(({ key }) => key === playerKey) ?? null;
  const report = useMemo(() => player ? buildAdvancedStudyReport(player.games) : null, [player]);
  const queueIds = useMemo(() => new Set(queue.map(({ id }) => id)), [queue]);

  async function addWeakness(weakness: RecurringWeakness) {
    if (!player || working.current) return;
    const item = createTrainingQueueItem(player.key, weakness);
    working.current = true;
    setWorkingItem(item.id);
    setNotice(null);
    try {
      await saveTrainingQueueItem(item);
      setQueue(await listTrainingQueue(player.key));
      setNotice(`${WEAKNESS_COPY[weakness.kind].title} added to the training queue.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to add the training item.");
    } finally {
      working.current = false;
      setWorkingItem(null);
    }
  }

  async function transition(item: TrainingQueueItemV1) {
    if (!player || working.current) return;
    working.current = true;
    setWorkingItem(item.id);
    setNotice(null);
    try {
      await saveTrainingQueueItem(transitionTrainingQueueItem(item, nextQueueStatus(item.status)));
      setQueue(await listTrainingQueue(player.key));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the training item.");
    } finally {
      working.current = false;
      setWorkingItem(null);
    }
  }

  async function remove(item: TrainingQueueItemV1) {
    if (!player || working.current) return;
    working.current = true;
    setWorkingItem(item.id);
    setNotice(null);
    try {
      await removeTrainingQueueItem(item.id);
      setQueue(await listTrainingQueue(player.key));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to remove the training item.");
    } finally {
      working.current = false;
      setWorkingItem(null);
    }
  }

  const loading = players === null;
  return (
    <main className="page-scroll study-page">
      <AppHeader />
      <section className="utility-heading study-heading">
        <div>
          <span className="kicker">Advanced study</span>
          <h1>Progress and training</h1>
          <p>Cross-game patterns derived only from saved canonical reviews.</p>
        </div>
        {players && players.length > 0 && <label className="study-player-select">
          <span>Player</span>
          <select aria-label="Study player" value={playerKey} onChange={(event) => setPlayerKey(event.target.value)}>
            {players.map((candidate) => <option value={candidate.key} key={candidate.key}>{candidate.name} · {gameCountLabel(candidate.games.length)}</option>)}
          </select>
        </label>}
      </section>

      {notice && <p className="study-notice" role="status">{notice}</p>}
      {loading ? <section className="study-empty">Loading saved reviews…</section> : !player || !report ? (
        <section className="study-empty">
          <strong>No analyzed games yet</strong>
          <span>Complete objective reviews to build trends, repertoire and training evidence.</span>
          <Link className="primary-link" href="/history">Open History</Link>
        </section>
      ) : <div className="study-sections">
        <section className="study-overview" aria-labelledby="trend-heading">
          <header className="study-section-heading">
            <div><span className="kicker">Multi-game trends</span><h2 id="trend-heading">Canonical form</h2></div>
            <small>{report.engineConfigurations.map((configuration) => `SF ${configuration.stockfishVersion} · d${configuration.depth} · ${configuration.multiPv}PV (${configuration.gameCount})`).join(" · ")}</small>
          </header>
          <div className="study-metrics">
            <article><span>Games</span><strong>{report.trends.summary.gameCount}</strong><small>{report.trends.summary.analyzedMoveCount} player moves</small></article>
            <article><span>Average Accuracy</span><strong>{formattedAccuracy(report.trends.summary.averageAccuracy)}</strong><small>Mean of canonical game Accuracy</small></article>
            <article><span>Recent form</span><strong>{report.trends.summary.accuracyChange === undefined ? "—" : `${report.trends.summary.accuracyChange >= 0 ? "+" : ""}${report.trends.summary.accuracyChange.toFixed(1)}`}</strong><small>Recent block vs prior block</small></article>
            <article><span>Training</span><strong>{queue.filter(({ status }) => status !== "completed").length}</strong><small>{queue.filter(({ status }) => status === "completed").length} completed</small></article>
          </div>
          <ol className="study-trend-chart" aria-label="Accuracy trend by game">
            {report.trends.games.slice(-20).map((point) => <li key={point.gameId}>
              <span className="trend-value">{formattedAccuracy(point.accuracy)}</span>
              <span className="trend-track"><i style={{ height: `${Math.max(2, point.accuracy ?? 0)}%` }} /></span>
              <Link href={`/review/${point.gameId}`} title={point.title} aria-label={`${point.title}, Accuracy ${formattedAccuracy(point.accuracy)}`}><span>{point.result === "unknown" ? "·" : point.result[0]?.toUpperCase()}</span></Link>
            </li>)}
          </ol>
          <div className="phase-metrics">
            {(["opening", "middlegame", "endgame"] as const).map((phase) => <div key={phase}><span>{phase}</span><strong>{formattedAccuracy(report.trends.summary.phaseAccuracy[phase])}</strong></div>)}
          </div>
        </section>

        <section className="study-repertoire" aria-labelledby="repertoire-heading">
          <header className="study-section-heading"><div><span className="kicker">Opening repertoire</span><h2 id="repertoire-heading">Your recurring positions</h2></div><small>White and Black are never merged.</small></header>
          {report.repertoire.length === 0 ? <p className="study-section-empty">No recognized openings in these analyzed games.</p> : <div className="repertoire-list">
            {report.repertoire.slice(0, openingLimit).map((opening) => <article key={opening.key}>
              <span className={`repertoire-color ${opening.color}`}>{opening.color === "white" ? "W" : "B"}</span>
              <div><small>{opening.eco} · {opening.color}</small><strong>{opening.name}</strong>{opening.variation && <span>{opening.variation}</span>}</div>
              <dl><div><dt>Games</dt><dd>{opening.gameCount}</dd></div><div><dt>Score</dt><dd>{opening.scoreRate === undefined ? "—" : `${opening.scoreRate.toFixed(0)}%`}</dd></div><div><dt>Opening Accuracy</dt><dd>{formattedAccuracy(opening.averageOpeningAccuracy)}</dd></div><div><dt>Error rate</dt><dd>{opening.openingErrorRate.toFixed(1)}%</dd></div></dl>
            </article>)}
            {openingLimit < report.repertoire.length && <button type="button" className="secondary" onClick={() => setOpeningLimit((limit) => limit + 12)}>Show more openings</button>}
          </div>}
        </section>

        <section className="study-weaknesses" aria-labelledby="weakness-heading">
          <header className="study-section-heading"><div><span className="kicker">Recurring weaknesses</span><h2 id="weakness-heading">Evidence across games</h2></div><small>Requires the same signal in at least two different games.</small></header>
          {report.weaknesses.length === 0 ? <p className="study-section-empty">No recurring weakness has crossed the two-game evidence threshold.</p> : <div className="weakness-grid">
            {report.weaknesses.map((weakness) => {
              const itemId = trainingQueueItemId(player.key, weakness.kind);
              return <article key={weakness.kind}>
                <div className="weakness-head"><span className="weakness-priority">P{weakness.priority}</span><div><strong>{WEAKNESS_COPY[weakness.kind].title}</strong><p>{WEAKNESS_COPY[weakness.kind].description}</p></div></div>
                <div className="weakness-metrics"><span>{weakness.incidentCount} incidents</span><span>{weakness.gameCount} games</span><span>−{weakness.averageWinPercentLoss.toFixed(1)} avg Win%</span></div>
                <ul>{weakness.evidence.slice(0, 3).map((evidence) => <li key={`${evidence.gameId}:${evidence.ply}`}><QualityIcon classification={evidence.classification} size={22} /><span><strong>{evidence.san} · {QUALITY_META[evidence.classification].label}</strong><small>{evidence.phase} · ply {evidence.ply} · −{evidence.winPercentLoss.toFixed(1)} Win%</small></span><Link href={`/review/${evidence.gameId}/moves?ply=${evidence.ply}`}>Review →</Link></li>)}</ul>
                <button type="button" className="secondary" disabled={queueIds.has(itemId) || workingItem !== null} onClick={() => void addWeakness(weakness)}>{queueIds.has(itemId) ? "In training queue" : workingItem === itemId ? "Adding…" : "Add to training queue"}</button>
              </article>;
            })}
          </div>}
        </section>

        <section className="study-queue" aria-labelledby="queue-heading">
          <header className="study-section-heading"><div><span className="kicker">Training queue</span><h2 id="queue-heading">Deliberate practice</h2></div><small>Progress is stored in this browser.</small></header>
          {queue.length === 0 ? <p className="study-section-empty">Add a recurring weakness to create your first training task.</p> : <div className="training-list">
            {queue.map((item) => <article key={item.id} className={item.status}>
              <div><span className="training-status">{item.status.replace("-", " ")}</span><strong>{WEAKNESS_COPY[item.weaknessKind].title}</strong><small>Priority {item.priority} · {item.evidence.length} saved positions</small></div>
              <div className="training-sources">{item.evidence.slice(0, 3).map((evidence) => <Link key={`${evidence.gameId}:${evidence.ply}`} href={`/review/${evidence.gameId}/moves?ply=${evidence.ply}`}>{evidence.san} · ply {evidence.ply}</Link>)}</div>
              <div className="training-actions"><button type="button" className="primary" disabled={workingItem !== null} onClick={() => void transition(item)}>{workingItem === item.id ? "Saving…" : queueActionLabel(item.status)}</button><button type="button" className="text-button" disabled={workingItem !== null} onClick={() => void remove(item)}>Remove</button></div>
            </article>)}
          </div>}
        </section>
      </div>}
    </main>
  );
}
