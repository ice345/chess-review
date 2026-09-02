# Connected platforms

Connected accounts import games; they do not supply chess truth. An explicit
full-history import queues local objective Stockfish analysis after syncing;
Maia and Coach remain on-demand.

## Provider boundary

`apps/web/src/lib/platforms/provider.ts` exposes one browser-facing interface for linking, incremental/full-history sync and disconnect. Provider responses normalize into `PlatformAccount`, `ExternalGameReference`, `SyncedGame` and `PlatformSyncState`. Canonical Stockfish analysis remains in the existing analysis/cache path.

## Chess.com

Chess.com linking uses a public username. The UI labels it unverified because the [official Published Data API](https://www.chess.com/news/view/published-data-api) does not prove account ownership. Server route handlers request the official profile, stats, archive index and monthly game archives serially with a recognizable user agent.

Incremental sync uses the previous completion time and only relevant archives.
Full-history sync walks every monthly archive newest-first. The first request
lists archives and returns `0/N` with an empty game page so the Settings and Home
progress UI can show a total before any monthly archive is downloaded. Later
requests fetch at most one 100-game archive page and return a checkpoint
containing the archive year-month and in-archive offset (`cc2:YYYY-MM:offset`).
Monthly archive URLs are re-validated as `https://api.chess.com/pub/player/<user>/games/<year>/<month>`
before the server fetches them. The browser commits games
and sync state after every page, and Home refreshes its recent-game list from
those commits, so Pause, browser close, provider error and 429 handling can
resume without restarting the archive walk. External game IDs deduplicate pages.

No scraping, credential collection or private endpoint is used.

Copied Chess.com PGNs and history imports also fetch both players' public
avatars from `https://api.chess.com/pub/player/{username}`. Only HTTPS hosts on
`images.chesscomfiles.com` and `chess.com` are returned to the client.

## Lichess

Lichess uses OAuth 2 Authorization Code with PKCE for a public client, following the [official Lichess API specification](https://github.com/lichess-org/api/blob/master/doc/specs/lichess-api.yaml):

- authorization endpoint: `https://lichess.org/oauth`
- token endpoint: `https://lichess.org/api/token`
- challenge method: `S256`
- no client secret and no refresh-token assumption
- empty/minimal scope for identity and the user's public game export

Configure `LICHESS_CLIENT_ID` and `LICHESS_SESSION_SECRET` in `apps/web/.env.local`; `apps/web/.env.example` documents both values. The verifier/state lives in a short-lived encrypted HttpOnly cookie. The access token lives only in a separate encrypted HttpOnly cookie. Disconnect attempts remote token revocation and always clears the local session. A future Tauri implementation must use OS credential storage.

Copied Lichess PGNs may also request public profile photos from
`https://lichess.org/api/user/{username}`. Many Lichess accounts have none;
when an image is present only HTTPS hosts on `lichess1.org` and `lichess.org`
are returned.

The sync route requests reverse-chronological NDJSON with PGN embedded, a bounded
maximum of 100, optional incremental `since`, an exclusive `until` checkpoint,
and no server analysis/evaluation payload. Full history repeatedly advances the
oldest timestamp. Requests are strictly serial. On `429`, the last durable cursor
and a parsed `Retry-After` time are persisted; Resume continues from that cursor
instead of retrying in parallel.

## Analysis policy

Every completed sync — incremental or full-history — creates or reuses an
`unanalyzed` history job for that account and starts it at low priority. The
scope selects never-analyzed games only, so repeat syncs are no-ops when nothing
is waiting: importing history fills Training without any manual per-game step.
The optional newest 1/3/5 sequential policy remains a conservative alternative.

Before a job is created, candidates are partitioned by chess-rules parsability.
A provider PGN that fails parsing (for example a missing king in the FEN header)
can never produce an analysis, so it is listed on the job as an excluded item —
visible and distinguished from failures on the Training page — instead of
consuming the retryable failure loop forever. The job runs at most two objective
game analyses in parallel, persists each success immediately, and keeps
item-level failures independent from the successful Training report. Maia and
Coach are never run automatically. Full-history tools live in Settings; Home
shows a compact connected-identity summary.

`PlatformSyncState` stores mode, opaque cursor, incremental `since`, imported
count, completed batches, provider progress, retry time and status. A state left
as `syncing` by a closed browser is converted to `paused` on the next load.

The Library filters the full local collection but mounts it progressively in
60-record pages. This avoids rendering thousands of rows at once while retaining
local source/status/time-control/result filters.
