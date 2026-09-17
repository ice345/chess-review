import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "../../components/app-header";
import { FEEDBACK_URL, PROJECT_URL } from "../../lib/site-info";
import { REVIEW_SHORTCUT_GROUPS, shortcutKeysLabel, shortcutsInGroup } from "../../lib/review-shortcuts";

export const metadata: Metadata = { title: "Help and data privacy", description: "What works in your browser, how to keep your chess library, and where optional connected services send data." };
export default function HelpPage() {
  return <main className="page-scroll utility-page"><AppHeader />
    <section className="utility-heading"><span className="kicker">Using Open Chess Review</span><h1>Help and data privacy</h1><p>A free, open-source personal review and coaching workspace. Start with a game, understand a decision, and return to it later.</p></section>
    <article className="help-content">
      <nav aria-label="Help topics"><a href="#first-review">First review</a><a href="#capabilities">Capabilities</a><a href="#shortcuts">Review shortcuts</a><a href="#your-data">Your data</a><a href="#enhanced-local">Enhanced Local</a><a href="#feedback">Feedback</a></nav>
      <section id="first-review"><h2>Your first review</h2><ol>
        <li><Link href="/">Import a PGN file, paste PGN/FEN, or open the example game.</Link> Multi-game PGNs let you choose a game before importing.</li>
        <li>Choose Analyze game. Browser Stockfish builds the review; you can cancel and retry. A saved game is only labelled analyzed when a compatible complete result exists.</li>
        <li>Open a key decision, inspect its move evidence and explore continuations. Open Notebook to save a personal note, bookmark or line through the selected position. Return to the game to leave a temporary exploration branch.</li>
        <li>Visit <Link href="/training">Training</Link> to find recurring decisions across analyzed games. Add a task, start its source position, and confirm each review. Continue picks up the first pending position.</li>
        <li>Use <Link href="/settings">Settings → Local data → Library backup</Link> before changing browsers or clearing site data. A review URL alone does not transfer a game to another browser.</li>
      </ol></section>
      <section id="capabilities"><h2>What is available</h2>
        <p><strong>Browser Core</strong> provides PGN/FEN, Stockfish, move review, Accuracy, opening and phase information, charts, deterministic summaries, exports, saved position reviews, personal notebooks and library backup. No AI installation is required. This beta has no Open Chess Review sign-in, cloud library sync, online play or paid subscription.</p>
        <p><strong>Enhanced Local</strong> adds Maia human predictions and optional generative explanations through a service on your own computer. The public website does not provide hosted AI and does not connect to your computer's AI service.</p>
        <p>Stockfish supplies objective evaluations. Maia predicts human choices; it is not an objective evaluator. The Coach explains structured evidence and cannot override it. Position-review counts record your acknowledgements, not correct answers, mastery, or Elo improvement.</p>
        <p>FEN studies have no game history, so use Engine Lab for position analysis. PGN is required for whole-game Accuracy and move-review history. Engine Lab also carries the Opening Explorer, which looks up what other players do from the current position in a public lichess.org database.</p>
      </section>
      <section id="shortcuts"><h2>Review shortcuts</h2>
        <p>These work anywhere in Review unless you are typing in a field or a control owns the keys. Press <kbd>?</kbd> inside a review to open the same list without leaving the board.</p>
        {REVIEW_SHORTCUT_GROUPS.map((group) => (
          <div className="help-shortcut-group" key={group}>
            <h3>{group}</h3>
            <dl>{shortcutsInGroup(group).map((shortcut) => (
              <div key={shortcut.action}><dt><kbd>{shortcutKeysLabel(shortcut)}</kbd></dt><dd>{shortcut.label}</dd></div>
            ))}</dl>
          </div>
        ))}
      </section>
      <section id="your-data"><h2>Your data and connected services</h2>
        <dl className="data-destinations">
          <div><dt>Games and progress</dt><dd>PGN/FEN, completed analysis, imported games, review tasks, saved notebooks and cached avatar URLs are stored in this browser's IndexedDB. Preferences use localStorage. Other devices and browsers do not receive a copy automatically. Clearing browser data or private-browsing storage can remove this library.</dd></div>
          <div><dt>Backup files</dt><dd>JSON backups contain games, FEN studies, original PGN where present, settings, saved review progress and notebooks (notes, bookmarks and legal lines). Backup v2 includes notebooks and accepts older v1 files. Unsaved drafts are excluded. Restore validates the entire file and previews duplicate/conflict handling. It excludes accounts, OAuth sessions, credentials, derived analysis caches, generated lessons, avatars and running job logs. Keep the file somewhere you control; it contains game and player information.</dd></div>
          <div><dt>Chess.com</dt><dd>Linking a public username requests its public profile and games through this website's server. This does not verify account ownership and is not a Chess.com login. Website requests can include the username and sync checkpoint.</dd></div>
          <div><dt>Lichess</dt><dd>When this deployment offers sign-in, you authorize directly on lichess.org using PKCE. The access token is held in an encrypted HttpOnly cookie and used server-side to retrieve your account and games. It is excluded from library backups. Disconnect clears this browser's session and attempts remote revocation; if Lichess cannot confirm it, revoke the application in <a href="https://lichess.org/account/oauth/token" rel="noreferrer">Lichess account settings</a>.</dd></div>
          <div><dt>Player avatars</dt><dd>Recognized Chess.com/Lichess game metadata may trigger public profile lookups through this website. Your browser then loads an allowlisted platform image directly. Those services receive the relevant network request.</dd></div>
          <div><dt>Maia and local coaching</dt><dd>Enhanced Local sends selected positions, candidate moves and target Elo to your local service. Coach requests send structured facts; a game summary includes game headers, player names and move data. Local Ollama handles those facts on your machine.</dd></div>
          <div><dt>Optional API coaching</dt><dd>Only in Enhanced Local, choosing an API provider and requesting a lesson forwards those structured facts through your local gateway to its configured provider. The provider's retention and account settings apply. Provider keys belong in that gateway's server configuration. No lesson is requested automatically for each move.</dd></div>
          <div><dt>Opening Explorer</dt><dd>When you open the Explorer panel in Engine Lab, the current position, the chosen database and the chosen population (rating floor and speeds) are sent to lichess.org&rsquo;s public opening explorer through this website&rsquo;s server, and the answer is cached in this browser. No game, PGN, username or account identifier leaves this machine, and the panel says so before you use it. The explorer has required an API token since March 2026, so this deployment needs one configured; without it the panel says the lookup is unconfigured instead of failing silently. Clearing the analysis cache also clears that cache.</dd></div>
          <div><dt>Website requests</dt><dd>The host receives page/API requests, IP address and normal request metadata. Platform sync passes game responses through the server; this app has no server database for your library. Hosting access logs may retain request metadata. Application feedback is sent only when you submit it yourself.</dd></div>
        </dl>
        <p>Delete review removes its local references, notebook and progress. Clear analysis cache keeps your original games; Reset all local data removes the local library and preferences. Disconnecting a platform lets you keep imported games or delete their linked data. Use a backup first when you want a recoverable copy.</p>
      </section>
      <section id="enhanced-local"><h2>Enhanced Local setup</h2>
        <p>This optional workflow is for a local checkout on your computer. <a href={`${PROJECT_URL}#readme`} rel="noreferrer">Follow the project setup guide</a> to install its prerequisites.</p>
        <ol><li>Run <code>pnpm dev</code> from the repository for the managed local workspace. Use <code>pnpm dev:web</code> for the web app alone; <code>pnpm dev:local-ai</code> starts only optional services.</li><li>Open the localhost address printed by the launcher, then Settings → Local enhancements. It distinguishes an unreachable service, an uninstalled model and a ready provider.</li><li>Select an installed Ollama model. Missing models require your explicit download action; the launcher never pulls one automatically. Maia downloads also require the Download model button.</li><li>For API coaching, configure the provider on the local gateway before selecting it in Settings. API credentials are never entered into a public website bundle.</li></ol>
        <p>The browser cannot start native processes. A missing model or unreachable local service does not block Browser Core. This release supports local loopback enhancement addresses; an arbitrary remote AI URL is not a hosted service configuration.</p>
      </section>
      <section id="recovery"><h2>If something stops working</h2><ul><li>Storage upgrade waiting: close other tabs for this website, then reload. For a storage error, enable site storage and retry; avoid clearing data before exporting a backup.</li><li>Restore preview changed: another tab saved data. Refresh the preview and inspect its conflicts before restoring.</li><li>Sync paused or rate limited: wait for the indicated retry time, then resume from the saved checkpoint. Reconnect if your Lichess session expired.</li><li>Analysis interrupted: keep the source game in History, close unnecessary analysis work and retry. Deeper analysis can take longer.</li></ul></section>
      <section id="feedback"><h2>Report a problem</h2><p>Include the page, what you expected, what happened, browser/version and steps to reproduce. Add a minimal example game only if you want to share it. Reports on GitHub are public; keep tokens, cookies and personal backup files out of the issue.</p><a className="primary-link" href={FEEDBACK_URL} rel="noreferrer">Open a bug report →</a><p>Review the report before submitting it. Nothing is sent automatically.</p></section>
    </article>
  </main>;
}
