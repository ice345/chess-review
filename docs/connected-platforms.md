# Connected platforms

Connected accounts import games; they do not supply chess truth and do not trigger analysis unless the user enables the conservative sync policy.

## Provider boundary

`apps/web/src/lib/platforms/provider.ts` exposes one browser-facing interface for linking, incremental sync and disconnect. Provider responses normalize into `PlatformAccount`, `ExternalGameReference`, `SyncedGame` and `PlatformSyncState`. Canonical Stockfish analysis remains in the existing analysis/cache path.

## Chess.com

Chess.com linking uses a public username. The UI labels it unverified because the [official Published Data API](https://www.chess.com/news/view/published-data-api) does not prove account ownership. Server route handlers request the official profile, stats, archive index and monthly game archives serially with a recognizable user agent. Sync uses the previous sync time, visits only relevant recent archives, deduplicates by external game ID and does not auto-run Stockfish by default.

No scraping, credential collection or private endpoint is used.

## Lichess

Lichess uses OAuth 2 Authorization Code with PKCE for a public client, following the [official Lichess API specification](https://github.com/lichess-org/api/blob/master/doc/specs/lichess-api.yaml):

- authorization endpoint: `https://lichess.org/oauth`
- token endpoint: `https://lichess.org/api/token`
- challenge method: `S256`
- no client secret and no refresh-token assumption
- empty/minimal scope for identity and the user's public game export

Configure `LICHESS_CLIENT_ID` and `LICHESS_SESSION_SECRET` in `apps/web/.env.local`; `apps/web/.env.example` documents both values. The verifier/state lives in a short-lived encrypted HttpOnly cookie. The access token lives only in a separate encrypted HttpOnly cookie. Disconnect attempts remote token revocation and always clears the local session. A future Tauri implementation must use OS credential storage.

The sync route requests reverse-chronological NDJSON with PGN embedded, a bounded maximum, optional `since`, and no server analysis/evaluation payload. On `429`, the UI reports the rate limit instead of parallel retrying.

## Analysis policy

Account sync stores PGN and metadata first. Automatic objective analysis is Off by default. The optional newest 1/3/5 policy processes games sequentially with the same Browser Stockfish queue and deterministic cache identity used by manual reviews. Maia and Coach are never run automatically.
