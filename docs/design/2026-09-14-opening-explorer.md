Status: Historical
Baseline: 2026-09-14 (refinement audit phase 4), with the 2026-09-16 token addendum
Superseded by: [docs/ui-spec.md](../ui-spec.md)
Do not use as the current product contract.

# Opening Explorer

Date: 2026-09-14

Phase 4 of
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md):
the largest feature gap against mature analysis platforms, implemented small, in
one place, with the network call declared rather than assumed.

## What changed

- `packages/openings/src/explorer.ts` owns the contract and the normalization for
  public lichess.org explorer payloads. It performs no network request, so the
  same validated structure is available to any surface, and the opening package
  keeps the domain boundary it already had.
- `GET /api/explorer` is the only code that talks to lichess.org. It validates the
  request, forwards only the position identity (EPD), the chosen database and the
  chosen population, validates the upstream payload, and reports an unusable payload as
  `502 unusable response`. It runs through the existing `platformRequest`
  wrapper, so it inherits the same-origin check, the shared rate limit, the
  bounded timeout, `Cache-Control: no-store` and error logging that never records
  request content.
- `lib/opening-explorer.ts` caches answers in the new `opening-explorer`
  IndexedDB store (database version 9) keyed by database plus population plus
  position identity.
- `components/review/opening-explorer-panel.tsx` renders the panel and
  `EngineRoutePanel` gained **Engine | Explorer** tabs.
- Help gained an *Opening Explorer* data destination and a capabilities sentence;
  `ui-spec.md` and `data-model.md` describe the behaviour and the store.

## Decisions worth recording

**The server is the only party that talks to lichess.org.** A direct browser call
would have been one line shorter and would have put a third-party host in the
page's origin path, out of reach of the deployment's rate limit, and outside the
place where payloads are validated. Proxying also makes the privacy statement
concrete: only `/api/explorer?fen=…&source=…` leaves the machine, and Help can say
exactly that.

**An unusable payload is an error, not a partial table.** A row that fails
validation would otherwise become "0 games" for a real move, which reads as data
rather than as a failure. The normalizer therefore rejects the whole payload and
the panel shows the failure.

**A stale answer is shown only with its age.** The cache has a 24-hour lifetime;
when a refresh fails, the older answer is displayed with `Cached answer · fetched 3
d ago`. Silently serving old numbers as current would be the kind of claim this
project avoids elsewhere.

**The Explorer is hidden while an answer is owed.** The most common moves from the
prompt position can be the best move, so showing them during "Learn from your
mistakes" would answer the exercise. The tabs simply do not exist during a
session, which is the same rule the engine panel already follows with its own
hidden-lines message.

**No new package.** `packages/openings` already owns opening-domain data and
recognition; a separate explorer package would have split one boundary for no
gain. This is the documented choice the audit allowed.

## Population filters (audit P01, stage 2)

The panel used to send one fixed population (blitz/rapid/classical, 1600+) with no
way to see a different census, and the coverage line said "human club games rated
1600+" for every answer. The population is now a choice, and it is part of the
answer's identity:

- `ExplorerPopulationV1 { ratingFloor, speeds }` lives in `packages/openings`, with
  the rating buckets, the speed allowlist, the canonical key, the label and the query
  encoding beside it. A value the contract does not define is rejected (`parseExplorerPopulation`
  returns null and the route answers 400) instead of being silently rounded to a
  population nobody asked for.
- The cache key is `database + population + position` (`explorerCacheKey`), so an
  answer for "rapid among 2000+" can never be served as "all speeds at every rating".
- `lib/server/explorer-upstream.ts` is the only place that builds the lichess.org
  request, and it omits a bound rather than sending an empty one. The masters cohort
  is one elite database with no rating buckets: it takes the speeds and never a
  rating floor.
- The panel shows a rating select for the players database and a speed preset for
  both, and repeats the population in the line above the numbers.

Verification: `packages/openings/src/explorer.test.ts` (buckets, order-insensitive
key, label, parsing round-trip), `apps/web/src/lib/server/explorer-upstream.test.ts`
(defaults, omitted bounds, masters never rated) and `e2e/opening-explorer.spec.ts`
(the controls change the request and the line above the numbers, and the rating
control disappears with the masters database).

## Upstream authentication (2026-09-16)

Since 2026-03-03 the Lichess opening explorer answers anonymous requests with
`401 Authorization Required` (point 2.6 read: the DDoS protection moved rate limiting
to the account layer; the service stays free at about 25 requests per minute).
This deployment sent no token, so every lookup failed.

- `LICHESS_EXPLORER_TOKEN` is deployment configuration; `explorerRequestHeaders()` is
  the only place the token is put on a request, and it never reaches the browser or a
  response body.
- Without a token the route answers `503` with `unconfigured: true` instead of letting
  the upstream 401 through, and the panel reports **"This deployment has no Lichess
  explorer token, so the lookup cannot run."** — a configuration state, not a rate
  limit and not "this position has no games".
- The panel's other states are unchanged, and a cached answer still stands in when a
  lookup fails.

Verification: `apps/web/src/lib/server/explorer-upstream.test.ts` (the bearer header on
every request) and `e2e/opening-explorer.spec.ts` (the unconfigured state is its own
message). The authenticated upstream call itself needs a token in the environment and
was not exercised here.

## Recovery and state (audit P01, stage 1)

The panel's state is named rather than inferred: `loading`, `fresh`, `stale`
(cached, refresh failed, age shown), `empty`, `offline`, `rate-limited` and
`failed`. A client lookup that produces no answer throws
`ExplorerRequestError` with a `kind`, so the panel can tell unreachable,
rate-limited and generic failures apart without matching message text.

**The retry is the panel's own.** Each failure, the empty position and the stale
answer offer **Retry explorer**, which re-issues only this panel's request — and,
because the visitor asked again, asks the endpoint rather than reusing a
still-fresh cached census. Nothing reloads the route, re-runs the game review or
touches the board or the stored analysis. That is what keeps a third-party lookup
from degrading Review.

**A late answer is never relabelled.** Each lookup is keyed by the position and
the database, and a monotonic run id decides which lookup may write. A superseded
answer is dropped and the panel returns to `loading`, so the numbers on screen
always describe the position named beside them.

**The numbers state their context.** The panel names the database, the population
it covers (the chosen population, e.g. "rated 1600+ · blitz, rapid, classical", or
"human master games"), the sample size
and the board's FEN. Database frequency is never presented as best-move advice,
and it does not replace Maia probabilities or Stockfish evaluations.

Rating and time-control filters shipped in stage 2 (see *Population filters* above),
so the request carries the position identity (EPD), the database and the chosen
`ExplorerPopulationV1` (rating floor and speeds; masters takes speeds only). The
deployment also needs `LICHESS_EXPLORER_TOKEN`, added server-side and never exposed
to the browser. The population line above the numbers repeats whichever census the
answer describes.

## Verification

- `packages/openings/src/explorer.test.ts` covers normalization: counts,
  percentages, frequency ordering, the 12-move cap, the empty position, a rejected
  partial payload, malformed FEN moves, and a malformed opening name being dropped
  instead of failing the position.
- `apps/web/src/lib/opening-explorer.test.ts` runs against `fake-indexeddb` and
  covers the client contract: one fetch per fresh position, one entry per
  database, revalidation after the lifetime expires, the stale-labelled fallback
  when the refresh fails, failure rather than invention when nothing is cached,
  and rejection of a payload version this build does not understand. This test
  caught a real defect — the out-of-line key was not passed to `put`, so nothing
  was ever cached.
- `e2e/opening-explorer.spec.ts` drives the real panel with a mocked endpoint:
  counts, split, opening name, fetch age, the database/population/position context,
  the privacy note, frequency order, the exact query parameters (only `fen`, `source`,
  `rating` and `speeds`), playing a move into a variation, switching database, the
  empty-position copy, a rate-limit error instead of an empty table, failure-then-retry and
  offline-then-retry in place (the document is never reloaded and the cached
  analysis is still loaded), a previous position's answer being dropped when the
  visitor moves on, and the panel being absent during practice. The
  previous-position case was checked to fail when the discard guard is removed.
