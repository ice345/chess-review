# Web service boundaries

R4 implements Browser Core as the public release surface. This document describes
the application controls; deployment-wide enforcement and real HTTPS OAuth are
separate release acceptance gates.

## Capabilities and configuration

| Configuration | Behavior |
| --- | --- |
| Production, default or `NEXT_PUBLIC_APP_MODE=browser-core` | Browser Stockfish, PGN/FEN, review, deterministic summaries, library, tasks and backups. No local-AI network probes or generation calls. |
| Local development, default or `NEXT_PUBLIC_APP_MODE=enhanced-local` | Optional loopback Maia/Coach service, provider/model discovery and explicit model setup. Browser Core works when it is unavailable. |
| Enhanced build opened on a non-loopback hostname | Local capabilities are not provided; the app does not contact a visitor's computer. |
| Any other mode, including Hosted AI | Configuration error; no hosted AI gateway is implemented or advertised. |

`NEXT_PUBLIC_*` variables are inlined at build time. Changing a public build's
mode requires rebuilding. `NEXT_PUBLIC_LOCAL_AI_URL` is accepted only for a
loopback HTTP(S) endpoint with no credentials, query or fragment. A Browser Core
production build rejects `NEXT_PUBLIC_LOCAL_AI_TOKEN`; a local launcher handshake
must not become a public credential. Provider API keys remain in local-ai server
configuration. Local health requests time out after 5 seconds, coaching/Maia
requests after 120 seconds, explicit Maia downloads after 15 minutes. Cancellation
is propagated. No automatic model download or per-move LLM generation is added.

The interface is English. New preferences default Coach output to English;
existing Chinese preferences and matching-language cached lessons remain valid.
Changing output language affects generated/deterministic prose, not controls or
chess facts. Public Study builds summaries directly from canonical facts; it does
not require an AI account.

## Public platform API controls

All `/api/platforms/*` routes use the shared server request boundary, including
avatars, configuration, sessions, link, sync and OAuth. Controls are held in a
bounded `globalThis` state **per Node process**, never inferred from browser
throttling or cookies.

| Control | Implemented limit |
| --- | --- |
| Work requests | 120/client/minute, 240/process/minute |
| GET configuration/session metadata | 240/client/minute, 600/process/minute |
| Rate bucket memory | 10,000 entries; expired windows pruned |
| Outbound provider concurrency | One full operation per provider, including body consumption; Chess.com profile and stats are sequential |
| Pending operations | Eight per provider; extra requests receive 429 with a 5-second retry hint |
| Whole request deadline | 20 seconds, including queue wait; 504 on timeout |
| Provider 429 | Pauses the provider lane and rejects pending requests; Retry-After parsed as seconds/date, cooldown 60–3,600 seconds |
| Request body | 1 MiB streamed bytes; malformed fields/JSON 400, oversized input 413 |
| Upstream bodies | 16 MiB games/archives, 1 MiB profile/stats/account, 32 KiB OAuth token; oversized/invalid responses 502 |

Cross-origin browser mutations are rejected with 403. Requests without browser
Origin metadata still receive rate limits. Redirects from upstream API fetches
are rejected. Provider targets and monthly archive paths retain their allowlists.
429 responses preserve retry information; the client persists its last completed
page/checkpoint. Failed requests do not advance the durable checkpoint.

Forwarding headers are ignored by default and all unknown clients share one
bucket. Set `PLATFORM_CLIENT_IP_HEADER` only behind a trusted ingress that
overwrites that exact header with one validated IP and blocks direct access to
the app. Raw IPs are neither retained in buckets nor logged by this guard. An
arbitrary caller-supplied `X-Forwarded-For` cannot create new client buckets.

The process guard resets on restart and does not coordinate separate instances
or serverless isolates. A single-process beta still needs ingress request/body
limits for traffic that never reaches the handler. Multiple replicas require
shared rate enforcement and a coordinated provider queue before launch. R5 must
verify the actual hosting topology; these limits are not a distributed-service
claim.

## Lichess authorization

Configure private `LICHESS_SESSION_SECRET` (at least 24 characters), unique public
`LICHESS_CLIENT_ID`, and `APP_ORIGIN=https://<actual-host>`. APP_ORIGIN is server-only,
must be an origin without a path, and must match the request origin. Loopback
development can omit it. Public production sign-in fails closed without it.

S256 PKCE uses a random state/verifier in a 10-minute AES-GCM encrypted HttpOnly,
SameSite=Lax cookie, with Secure on HTTPS. The callback verifies state, age and
the exact redirect URI before token exchange. Tokens/account fields are checked
at runtime. A separate encrypted HttpOnly session cookie expires at the provider
expiry capped to one year (one year if omitted); expiry is checked before sync.
No refresh token is assumed. Session JSON contains public account data only.

Cancellation, missing/tampered/expired state, invalid responses and exchange
timeouts return a recoverable Settings message and clear the PKCE cookie.
Callback redirects contain predefined messages, not provider response bodies,
authorization codes or tokens. A guard rejection before the callback handler may
return a 429/504 response; starting a new connection replaces the old challenge.
All platform responses are no-store and no-referrer.

Disconnect clears the browser cookies even if upstream revocation fails after
the request is admitted. The UI distinguishes local disconnection from confirmed
remote revocation and links to Lichess's application controls. A rejected
cross-origin or rate-limited request does not claim successful disconnection.

## Product disclosures and metadata

`/help`, linked from Home and Settings, explains first review, capability limits,
browser storage and backups, platform username/identity distinctions, avatar
requests, optional local/API coaching, and manual feedback. Whole-game coaching
can send headers, player names and moves, not just one position. The public
feedback link opens a GitHub issue template; nothing is submitted automatically.

Page metadata provides accurate title/description/Open Graph/Twitter summary.
Personal utility/review pages are noindex/nofollow; robots.txt excludes APIs and
personal routes. These are crawler hints, not access controls. Responses use
nosniff, same-origin framing and a strict referrer policy; API routes use the
stricter no-referrer policy. Worker isolation headers are unchanged.

## Validation and external boundaries

`e2e/r4.spec.ts` checks local capability states, independent output language,
help layout and API headers. After a Browser Core production build, run:

```sh
pnpm test:e2e --config playwright.browser-core.config.ts
```

The separate configuration starts the standalone production artifact on port 3001 and cannot reuse a
development server. It checks an uncached real Stockfish review and grounded
summary with zero localhost AI requests. R5 CI uses `playwright.release.config.ts` after the browser workflows, covering Chromium, Firefox, WebKit and mobile viewport emulation.

The deterministic OAuth route tests exercise actual handlers with fixture
provider responses; they are not real account authorization. R5 must complete
an interactive Lichess login/sync/cancel/disconnect on the actual HTTPS domain,
check proxy-origin handling, Secure cookies and host limits, and record the
deployed version. No hosted AI service or public deployment was created in R4.

Upstream constraints: [Chess.com Published Data API](https://www.chess.com/news/view/published-data-api)
describes serial requests and recognizable user agents;
[Lichess's official API specification](https://github.com/lichess-org/api/blob/master/doc/specs/lichess-api.yaml)
documents serial use, 429 backoff, PKCE S256 and token behavior. The conservative
local bounds above are this application's choices, not provider quota promises.

## R5 single-host ingress

The [Debian / Cloudflare Tunnel deployment](../deploy/nuc/README.md) supplies
one standalone Node process behind an unprivileged Nginx container. Only the
proxy's host-loopback port is published. It validates the fixed public host,
overwrites forwarding headers, applies request/connection/body limits and
forwards Cloudflare's validated client address as `X-Real-IP`. The app opts into
`TRUST_PROXY_ORIGIN=1`: public origin resolution requires exact configured
Host / X-Forwarded-Host and HTTPS protocol headers. Default direct deployments
continue ignoring forwarded origin headers. This is needed because Next
standalone constructs request URLs from its internal listen address.

Do not expose the Node port or make the gateway publicly reachable: all host
users and Docker administrators are inside the trust boundary. A same-zone
Cloudflare Worker capable of altering address headers also changes that boundary.
The release script verifies liveness/version and can roll back images; the
local smoke checks verify actual proxy headers and OAuth start without following
the external authorization redirect. Actual Cloudflare HTTPS and signed-in
account flows remain a separate deployment acceptance step.

## Local address validation follow-up (2026-09-10)

Direct local requests may use localhost, 127.0.0.1 or IPv6 loopback even when Next
constructs its request URL from a different listen address. `requestOrigin` accepts
only a loopback Host on the same protocol/port in that case. It does not accept an
arbitrary Host or forwarded host, and browser Origin must still match exactly.
Public Cloudflare/NGINX ingress continues to require the explicit trusted-proxy
configuration. A mismatch now explains the website-origin failure instead of
implying Chess.com could not be reached. Saved games are unaffected.
