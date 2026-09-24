"use client";

import Link from "next/link";
import { ProviderMark, QUALITY_META, QualityIcon } from "@chess-review/ui";
import { decisionReviewHref, trainingQueueItemId } from "../../lib/training-queue";
import { useStatsStudy } from "../../hooks/use-stats-study";
import { HistoryAnalysisControls, HistoryJobsPanel } from "./history-jobs";
import { ScopeFilters } from "./scope-filters";
import { NAV_GROUPS, WEAKNESS_COPY, formatted } from "./study-helpers";

/** Stats Growth band: ratings / openings / mistakes inventory≠growth report. */
export function StatsStudyPanel() {
  const study = useStatsStudy();
  const {
    player,
    accounts,
    syncedGames,
    filters,
    setFilters,
    scopeOpen,
    setScopeOpen,
    activeTab,
    selectView,
    listLimit,
    setListLimit,
    freshness,
    setFreshness,
    jobAccountScope,
    setJobAccountScope,
    cacheBytes,
    workingItem,
    jobWorking,
    notice,
    timeClasses,
    openingOptions,
    selectedAccountIds,
    eligibleSynced,
    historyJobGroups,
    startHistoryAnalysis,
    controlJob,
    removeHistoryRun,
    clearFinishedRuns,
    addWeakness,
    loading,
    analysisStatus,
    scopeGameCount,
    report,
    queueIds,
    playerSelect,
    showStudyReport,
    showRunHistory,
    canAnalyzeHistory,
    unanalyzedEligibleCount,
    summaries,
    primaryRating,
    observedPhases,
    strongestPhase,
    needsWorkPhase,
    highlightCounts,
    brilliantMoves,
    criticalMoves,
  } = study;

  return (
    <section className="study-report-section" aria-labelledby="stats-your-game-title">
      <header className="study-report-heading">
        <div>
          <h2 id="stats-your-game-title">Your game</h2>
          <p>How you play, from the games this browser has analyzed.</p>
        </div>
        {playerSelect}
      </header>
      {analysisStatus && <p className="study-analysis-status" role="status">{analysisStatus}</p>}
      {notice && <p className="study-notice" role="status">{notice}</p>}
      {loading ? <section className="study-empty">Loading…</section> : (summaries?.length ?? 0) === 0 ? (
        <section className="study-empty">Analyze a game to see how you play.</section>
      ) : player === null ? (
        <section className="study-empty">Loading selected player…</section>
      ) : !showStudyReport ? (showRunHistory || canAnalyzeHistory ? <section className="study-runs-only">
        {canAnalyzeHistory && <>
          <div className="history-analysis-heading"><span>Analyse imported games</span></div>
          <p className="quiet-empty">{unanalyzedEligibleCount} of {eligibleSynced.length} imported games in this scope have no objective analysis yet.</p>
          <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={() => startHistoryAnalysis(player?.accountId ? [player.accountId] : selectedAccountIds)} /></div>
        </>}
        {showRunHistory && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}
      </section> : null) : <>
      <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} gameCount={scopeGameCount} open={scopeOpen} onToggle={setScopeOpen} />
      <div className="study-notebook-body">
      <nav className="study-nav study-nav-quiet" aria-label="Your game views">

        {NAV_GROUPS.map((group) => <div key={group.id} className="study-nav-group">{group.label ? <p className="study-nav-label">{group.label}</p> : <p className="study-nav-label study-nav-label-spacer" aria-hidden="true"> </p>}<div className="study-nav-tabs">{group.tabs.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => selectView(tab.id)}>{tab.label}</button>)}</div></div>)}
      </nav>
      {!player || !report ? <section className="study-empty">Loading selected player…</section> : <div className="study-sections">
        {activeTab === "overview" && <section className="study-overview" id="player-profile">
          <article className="study-paper study-profile">
            <header className="study-profile-heading">
              <div>
                <span className="eyebrow">Player profile</span>
                <h2>{player.name}</h2>
                <p className="study-profile-source">
                  {primaryRating ? (
                    <>
                      <ProviderMark provider={primaryRating.provider} decorative />
                      {primaryRating.provider === "chesscom" ? "Chess.com" : "Lichess"} · {primaryRating.timeClass}
                    </>
                  ) : "Objective analysis profile"}
                </p>
              </div>
              <button type="button" className="text-button" onClick={() => selectView("ratings")}>View rating & form →</button>
            </header>
            <dl className="study-profile-facts">
              <div><dt>Current observed rating</dt><dd>{primaryRating?.currentRating ?? "—"}</dd><small>{primaryRating?.recentRange ? `Recent range ${primaryRating.recentRange.low}–${primaryRating.recentRange.high}` : "No platform rating in this scope"}</small></div>
              <div><dt>Form</dt><dd>{report.overview.summary.accuracyChange === undefined ? "—" : `${report.overview.summary.accuracyChange >= 0 ? "+" : ""}${report.overview.summary.accuracyChange.toFixed(1)}`}</dd><small>Accuracy trend · {formatted(report.overview.summary.averageAccuracy)} average per game</small></div>
              <div><dt>Next meaningful target</dt><dd>{primaryRating?.stabilizeTarget ?? primaryRating?.nextTarget ?? "—"}</dd><small>{primaryRating?.stabilizeTarget && primaryRating.nextTarget ? `Stabilize ${primaryRating.stabilizeTarget} · then ${primaryRating.nextTarget}` : "Build a larger rated sample"}</small></div>
              <div><dt>Analysis coverage</dt><dd>{report.coverage.state === "empty" ? "—" : `${report.coverage.analyzedGames}/${report.coverage.eligibleGames}`}</dd><small>{report.coverage.state === "empty" ? "No games in this scope" : `${formatted(report.coverage.coverageRate, "%")} current · ${primaryRating?.confidence ?? "low"} confidence`}</small></div>
            </dl>
            {primaryRating?.performanceRating !== undefined && <p className="study-profile-note">Estimated recent performance {primaryRating.performanceRating} from {primaryRating.performanceSampleSize} games with both opponent rating and result.</p>}
          </article>
          {observedPhases.length > 0 && <div className="study-phase-row">
            {observedPhases.map(({ phase, profile }) => {
              const strongest = observedPhases.length > 1 && strongestPhase?.phase === phase;
              const focus = observedPhases.length > 1 && needsWorkPhase?.phase === phase && !strongest;
              const wash = phase === "opening" ? "mist" : phase === "middlegame" ? "pink" : "sage";
              const conversion = profile.advantageOpportunities > 0 ? Math.round((100 * profile.advantagePreserved) / profile.advantageOpportunities) : undefined;
              const detail = phase === "endgame" && conversion !== undefined
                ? `${conversion}% advantages preserved`
                : phase === "middlegame"
                  ? `${formatted(profile.errorRate, "%")} decision errors`
                  : `${formatted(profile.errorRate, "%")} errors`;
              return <article key={phase} className="study-wash" data-wash={wash}><span className="eyebrow">{phase}</span><strong>{formatted(profile.averageAccuracy)}</strong><small>{strongest ? "Strongest phase" : focus ? "Primary improvement area" : `${profile.moveCount} moves`} · average move Accuracy</small><p>{detail}</p></article>;
            })}
          </div>}
          <article className="study-paper study-focus">
            <header><span className="eyebrow">Focus now</span><button type="button" className="text-button" onClick={() => selectView("plan")}>Open plan →</button></header>
            {report.trainingPlan.length > 0 ? <ol>{report.trainingPlan.slice(0, 3).map((item) => <li key={item.weaknessKind}><strong>{item.title}</strong><small>{item.rationale}</small>{item.evidence[0] && <Link href={decisionReviewHref(item.evidence[0])}>{item.evidence[0].san} · ply {item.evidence[0].ply}</Link>}</li>)}</ol> : <p>Keep collecting analyzed games to establish a reliable training focus.</p>}
          </article>
          <article className="study-highlights-summary">
            <header><span className="eyebrow">Highlights</span><button type="button" className="text-button" onClick={() => selectView("highlights")}>View Highlights →</button></header>
            <p><span><strong>{highlightCounts?.brilliant ?? 0}</strong> Brilliant</span><span><strong>{highlightCounts?.critical ?? 0}</strong> Critical</span><span><strong>{highlightCounts?.comebacks ?? 0}</strong> Comebacks</span><span><strong>{highlightCounts?.conversions ?? 0}</strong> Clean conversions</span></p>
          </article>
          <div className="study-form-summary">
            <div className="study-form-heading">
              <p className="study-ink-stats">
                <span><strong>{report.overview.summary.gameCount}</strong> Games</span>
                <span><strong>{formatted(report.overview.summary.averageAccuracy)}</strong> Accuracy per game</span>
                <span><strong>{report.coverage.state === "empty" ? "—" : formatted(report.coverage.coverageRate, "%")}</strong> Coverage</span>
              </p>
              <p className="study-trend-legend">Result under each bar: <span data-result="win">W win</span><span data-result="draw">D draw</span><span data-result="loss">L loss</span></p>
            </div>
            <ol className="study-trend-chart" aria-label="Accuracy by game, with win, draw, or loss under each bar">{report.overview.games.slice(-18).map((point) => <li key={point.gameId} data-result={point.result}><span className="trend-track"><i style={{ height: `${Math.max(2, point.accuracy ?? 0)}%` }} /></span><Link href={`/review/${point.gameId}`} aria-label={`${point.title}, ${point.result === "win" ? "win" : point.result === "draw" ? "draw" : point.result === "loss" ? "loss" : "unknown result"}, Accuracy ${formatted(point.accuracy)}`}>{point.result === "win" ? "W" : point.result === "draw" ? "D" : point.result === "loss" ? "L" : ""}</Link></li>)}</ol>
          </div>
        </section>}

        {activeTab === "ratings" && <section id="rating-form"><header className="study-section-heading"><h2>Rating & Form</h2><small>Platform rating and time controls stay separate. Performance is an estimate, never derived from Accuracy.</small></header>{report.ratings.length === 0 ? <p className="study-section-empty">No rating evidence in this population.</p> : report.ratings.map((band) => <article key={band.key} className="study-paper study-rating-band"><span className="eyebrow">{band.provider === "chesscom" ? "Chess.com" : "Lichess"} · {band.timeClass}</span><strong className="study-rating-primary">{band.currentRating ?? "—"}</strong><p>{band.recentRange ? `Recent range ${band.recentRange.low}–${band.recentRange.high}` : "No recent range"} · {band.sampleSize} games · {band.confidence} confidence</p><dl className="study-profile-facts"><div><dt>Estimated recent performance</dt><dd>{band.performanceRating ?? "—"}</dd><small>Matched sample {band.performanceSampleSize}</small></div><div><dt>Score</dt><dd>{formatted(report.overview.scoreRate, "%")}</dd><small>Accuracy {formatted(report.overview.summary.averageAccuracy)}</small></div><div><dt>Next meaningful target</dt><dd>{band.stabilizeTarget ?? band.nextTarget ?? "—"}</dd><small>{band.stabilizeTarget && band.nextTarget ? `Stabilize ${band.stabilizeTarget} · then ${band.nextTarget}` : "Need a larger rated sample"}</small></div></dl></article>)}</section>}

        {activeTab === "openings" && <section id="openings"><header className="study-section-heading"><h2>Openings</h2><small>What you play, and how well you play it.</small></header>{report.openings.length === 0 ? <p className="study-section-empty">No recognized openings.</p> : <><div className="repertoire-list">{report.openings.slice(0, listLimit).map((opening) => <article key={opening.key}><span className={`repertoire-color ${opening.color}`}>{opening.color === "white" ? "W" : "B"}</span><div><small>{opening.eco} · {formatted(opening.share, "%")}</small><strong>{opening.name}</strong>{opening.variation && <span>{opening.variation}</span>}<span>{opening.gameCount} games · {opening.wins}W {opening.draws}D {opening.losses}L</span></div><dl><div><dt>Accuracy</dt><dd>{formatted(opening.averageAccuracy)}</dd></div><div><dt>Recent</dt><dd>{formatted(opening.recentAccuracy)}</dd></div><div><dt>Win% loss</dt><dd>{formatted(opening.averageWinPercentLoss)}</dd></div><div><dt>Errors</dt><dd>{formatted(opening.errorRate, "%")}</dd></div></dl><div className="training-sources">{opening.problemPositions.slice(0, 3).map((item) => <Link key={`${item.gameId}:${item.ply}`} href={decisionReviewHref(item)}>{item.san} · ply {item.ply}</Link>)}</div></article>)}</div>{report.openings.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>Show more openings</button>}</>}</section>}

        {(activeTab === "middlegame" || activeTab === "endgame") && (() => {
          const phase = report.phases[activeTab];
          const endgame = activeTab === "endgame";
          const evidence = report.mistakes.filter((item) => item.phase === activeTab).slice(0, 8);
          return <section id={activeTab}><header className="study-section-heading"><h2>{endgame ? "Endgame" : "Middlegame"}</h2><small>{endgame ? "How well you convert and defend late positions. No tablebase claims." : "How good your decisions are after the opening."}</small></header>
            <div className="study-metric-groups">
              <section className="study-wash" data-wash="mist"><h3>Decision quality</h3><dl><div><dt>Moves</dt><dd>{phase.moveCount}</dd></div><div><dt>Error rate</dt><dd>{formatted(phase.errorRate, "%")}</dd></div><div><dt>Average Win% loss</dt><dd>{formatted(phase.averageWinPercentLoss)}</dd></div>{!endgame && <div><dt>Decision errors</dt><dd>{phase.errorCount}</dd></div>}</dl></section>
              <section className="study-wash" data-wash="cream"><h3>Recent form</h3><dl><div><dt>Average move Accuracy</dt><dd>{formatted(phase.averageAccuracy)}</dd></div><div><dt>Recent average move Accuracy</dt><dd>{formatted(phase.recentAccuracy)}</dd></div></dl><small>{`Arithmetic mean of ${phase.accuracyMetric.sampleMoves} moves from ${phase.accuracyMetric.sampleGames} games. Review shows the canonical single-game phase Accuracy, which is a different measure.`}</small></section>
              <section className="study-wash" data-wash="sage"><h3>{endgame ? "Conversion" : "Advantages"}</h3><dl><div><dt>Advantages preserved</dt><dd>{phase.advantagePreserved}/{phase.advantageOpportunities}</dd></div>{endgame && <div><dt>Defensive holds</dt><dd>{phase.defensiveHolds}/{phase.defensivePositions}</dd></div>}</dl></section>
              <section className="study-wash" data-wash="pink"><h3>{endgame ? "Missed wins / mates" : "Opportunities"}</h3><dl><div><dt>Missed opportunities</dt><dd>{phase.missedOpportunities}</dd></div></dl>{evidence.length > 0 && <ul className="study-evidence-list">{evidence.map((item) => <li key={`${item.gameId}:${item.ply}`}><QualityIcon classification={item.classification} size={20} /><span><strong title={item.san}>{item.san}</strong><small>−{item.winPercentLoss.toFixed(1)} Win%</small></span><Link href={decisionReviewHref(item)}>Review →</Link></li>)}</ul>}</section>
            </div>
          </section>;
        })()}

        {activeTab === "mistakes" && <section id="mistakes"><header className="study-section-heading"><h2>Mistakes</h2><small>Which decisions deserve review.</small></header>{report.mistakes.length === 0 ? <p className="study-section-empty">No errors in this population.</p> : <><ul className="study-evidence-list">{report.mistakes.slice(0, listLimit).map((item) => <li key={`${item.gameId}:${item.ply}`}><QualityIcon classification={item.classification} size={22} /><span><strong title={item.san}>{item.san} · {QUALITY_META[item.classification].label}</strong><small>{item.phase} · −{item.winPercentLoss.toFixed(1)} Win% · {new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={decisionReviewHref(item)}>Review →</Link></li>)}</ul>{report.mistakes.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>Show more mistakes</button>}</>}</section>}

        {activeTab === "highlights" && <section id="highlights"><header className="study-section-heading"><h2>Highlights</h2><small>Notable chess moments, grouped by kind.</small></header>{report.specialMoves.length + report.gameHighlights.length === 0 ? <p className="study-section-empty">No verified highlights in this population.</p> : <div className="study-highlight-groups">
          <section data-kind="brilliant"><h3>Brilliant <small>{brilliantMoves.length}</small></h3>{brilliantMoves.length === 0 ? <p className="study-section-empty">None in this population.</p> : <ul className="study-highlight-cards">{brilliantMoves.slice(0, 6).map((item) => <li key={`${item.gameId}:${item.ply}`} className="study-highlight-card" data-kind="brilliant"><QualityIcon classification="brilliant" size={22} /><span><strong>{item.san}</strong><small>{new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Open in Review →</Link></li>)}</ul>}</section>
          <section data-kind="critical"><h3>Critical <small>{criticalMoves.length}</small></h3>{criticalMoves.length === 0 ? <p className="study-section-empty">None in this population.</p> : <ul className="study-highlight-cards">{criticalMoves.slice(0, listLimit).map((item) => <li key={`${item.gameId}:${item.ply}`} className="study-highlight-card" data-kind="critical"><QualityIcon classification="great" size={22} /><span><strong>{item.san}</strong><small>{new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Open in Review →</Link></li>)}</ul>}{criticalMoves.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>View more critical moments</button>}</section>
          {(["comeback", "save", "clean-conversion", "best-game"] as const).map((kind) => {
            const items = report.gameHighlights.filter((item) => item.kind === kind);
            if (items.length === 0) return null;
            return <section key={kind} data-kind={kind}><h3>{kind.replaceAll("-", " ")} <small>{items.length}</small></h3><ul className="study-highlight-cards">{items.slice(0, 6).map((item) => <li key={`${item.kind}:${item.gameId}`} className="study-highlight-card" data-kind={kind}><span><strong>{item.title}</strong><small>{item.accuracy === undefined ? "" : `${item.accuracy.toFixed(1)} Accuracy`}</small></span><Link href={item.referencePly ? `/review/${item.gameId}/moves?ply=${item.referencePly}` : `/review/${item.gameId}`}>Open →</Link></li>)}</ul></section>;
          })}
        </div>}</section>}

        {activeTab === "plan" && <section id="training-plan"><header className="study-section-heading"><h2>Plan</h2><small>Ranked from measurable source positions.</small></header>{report.trainingPlan.length === 0 ? <p className="study-section-empty">No recurring weakness has enough evidence yet.</p> : <div className="weakness-grid">{report.weaknesses.map((weakness, index) => { const itemId = trainingQueueItemId(player.key, weakness.kind); return <article key={weakness.kind}><div className="weakness-head"><span className="weakness-priority">{index + 1}</span><div><strong>{WEAKNESS_COPY[weakness.kind].title}</strong><p>{WEAKNESS_COPY[weakness.kind].description}</p></div></div><div className="weakness-metrics"><span>{formatted(weakness.frequency, "%")} of games</span><span>{weakness.confidence} confidence</span><span>{weakness.trend}</span></div><ul>{weakness.evidence.slice(0, 5).map((item) => <li key={`${item.gameId}:${item.ply}`}><span><strong title={item.san}>{item.san}</strong><small>{item.phase} · −{item.winPercentLoss.toFixed(1)} Win%</small></span><Link href={decisionReviewHref(item)}>Review →</Link></li>)}</ul><button type="button" className="text-button" disabled={queueIds.has(itemId) || workingItem !== null} onClick={() => void addWeakness(weakness)}>{queueIds.has(itemId) ? "In queue" : "Add to queue"}</button></article>; })}</div>}

        </section>}

        {activeTab === "coverage" && <section id="coverage"><header className="study-section-heading"><h2>Coverage</h2><small>{report.algorithmVersion} · {report.objectiveAlgorithmVersion}</small></header><div className="study-metrics"><article><span>Eligible</span><strong>{report.coverage.eligibleGames}</strong></article><article><span>Current</span><strong>{report.coverage.analyzedGames}</strong><small>{formatted(report.coverage.coverageRate, "%")}</small></article><article><span>Stale</span><strong>{report.coverage.staleGames}</strong></article><article><span>Failed</span><strong>{report.coverage.failedGames}</strong></article></div>{report.coverage.providers && report.coverage.providers.length > 0 && <div className="coverage-provider-grid">{report.coverage.providers.map((item) => <article key={item.provider}><strong>{item.provider === "chesscom" ? "Chess.com" : "Lichess"}</strong><span>{item.analyzedGames}/{item.eligibleGames} current</span><small>{item.staleGames} stale · {item.failedGames} failed</small></article>)}</div>}<p className="study-section-empty">{report.coverage.state === "empty" ? "No imported games match this scope yet, so there is nothing to cover." : report.coverage.partial ? "This report is partial. Conclusions use only current compatible analyses." : `This filtered population has complete current analysis coverage: ${report.coverage.analyzedGames} of ${report.coverage.eligibleGames} games.`}{report.coverage.excludedGames > 0 ? ` ${report.coverage.excludedGames} provider game${report.coverage.excludedGames === 1 ? "" : "s"} with invalid PGN ${report.coverage.excludedGames === 1 ? "is" : "are"} excluded and do not keep this range incomplete.` : ""}{filters.openingKeys.length > 0 ? " Opening is known only for current analyses, so coverage remains based on the broader synced scope." : ""} Local objective cache: {(cacheBytes / 1024 / 1024).toFixed(1)} MB.</p>
          {accounts.length > 0 && <div className="history-analysis-controls"><label><span>Account scope</span><select value={jobAccountScope} onChange={(event) => setJobAccountScope(event.target.value as "selected" | "all")}><option value="all">All connected accounts</option><option value="selected" disabled={!player.accountId}>Selected account</option></select></label><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={startHistoryAnalysis} /></div>}
          <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />
        </section>}
      </div>}
        </div>
      </>}
    </section>
  );
}
