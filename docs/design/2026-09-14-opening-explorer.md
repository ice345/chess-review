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
  request, forwards only the position identity (EPD) and the chosen database,
  validates the upstream payload, and reports an unusable payload as
  `502 unusable response`. It runs through the existing `platformRequest`
  wrapper, so it inherits the same-origin check, the shared rate limit, the
  bounded timeout, `Cache-Control: no-store` and error logging that never records
  request content.
- `lib/opening-explorer.ts` caches answers in the new `opening-explorer`
  IndexedDB store (database version 9) keyed by database plus position identity.
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
  counts, split, opening name, fetch age, the privacy note, frequency order, the
  exact query parameters (only `fen` and `source`), playing a move into a
  variation, switching database, the empty-position copy, a rate-limit error
  instead of an empty table, and the panel being absent during practice.
