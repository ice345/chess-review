Status: Historical
Baseline: 2026-09-14 (refinement audit phase 6)
Superseded by: [docs/mobile.md](../mobile.md)
Do not use as the current product contract.

# Mobile parity, audit cleanup, zoom and payload acceptance

Date: 2026-09-14

Phase 6 of
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md):
the three remaining low-severity UI audit findings, one canonical asset source for
both apps, real zoom acceptance, and the measurements the audit asked for instead
of impressions.

## F6 — checkbox hit targets

The checkbox rows already had a 44 px minimum height in the notebook, practice and
backup surfaces; the Settings rows were the outstanding case, so they now use one
shared `setting-row` class with a 44 px minimum height and a 20 px box. The label
row is the touch target; the box stays small, which is what the audit asked for
rather than an oversized checkbox.

## F7 — action-link hit areas

`.text-button`/`.text-action` carried a 32 px minimum height, and the class also
had no `display`, so anchors using it ignored `min-height` entirely and rendered as
23 px line boxes. The class is now `inline-flex` with a 40 px minimum height, and
the standalone action links (`.view-history`, `.home-resume`, `.manage-accounts`,
`.view-all-moments`) follow the same rule. Inline prose links are untouched
deliberately. Because taller rows can cost horizontal space, the acceptance also
re-checks the phone overflow contract on Home, History and Settings at 390 px and
320 px.

## F8 — empty practice CTA

The practice strip no longer renders a disabled primary button when the selected
side has nothing to practise: the explanation takes the row instead, and the action
appears only when there is something to do. The existing practice specs were
updated to the new contract — they asserted a *disabled* button, which is exactly
the state the audit asked to remove.

## Mobile piece parity

The authored masters now live once, in
`packages/ui/assets/pieces/feather-porcelain-v1.1/`. `scripts/sync-piece-assets.mjs`
validates them (exactly twelve files, 512×512, PNG with an alpha channel) and
writes the Web copy under `apps/web/public/pieces/feather_porcelain_v1_1/`;
`--check` fails on any checksum drift with the exact file and the fix. The mobile
companion imports the canonical files through Vite — no copy, so no drift — and a
missing file becomes a build error rather than an empty square. CI runs the check
and asserts the mobile build output contains the twelve assets.

The Web keeps a real copy on purpose: its board renderer, PNG export canvas and
service worker all address the pieces by URL (`/pieces/...`), so the files must
exist in `public/`. That is one generated copy, not two, and the checksum check is
what keeps it honest.

## Zoom acceptance

`e2e/zoom-acceptance.spec.ts` covers 100 %, 125 %, 150 % and 200 %. Page zoom is
layout-equivalent to a smaller CSS viewport (a 1440×900 window at 150 % lays out
like 960×600), which is what the media queries see, so each level drives the
viewport at that ratio and checks: the board stays usable and inside the window, no
horizontal overflow, the transport stays touch-sized and clickable, the titlebar
disclosure stays reachable where the Settings shortcut is deliberately hidden,
Focus board and the `?` overlay open and close, and the overlay stays inside the
window. The promotion chooser is additionally checked with a CSS scale on the
document at 150 % and 200 %, because fixed and absolutely positioned overlays are
where zoom tends to break.

## Payload and offline acceptance

Both are asserted on the production standalone build, through the release suite,
because the service worker only exists there.

- The home board loads exactly twelve piece files, all from
  `/pieces/feather_porcelain_v1_1/`, with a decoded payload of 956 540 bytes
  (~934 KB), asserted under a 2 MB budget so the PNG board cannot silently grow.
- The cache contains only the current version directory, which is the property
  that makes a released art revision unreachable from an old cache.
- `--check` on the asset contract and the twelve mobile build assets are enforced
  in CI.

**No PNG optimization was applied.** Recompressing the IDAT streams at maximum
zlib level makes every one of the twelve files 1.2–3.4 % *larger*, so the authored
masters are already better compressed than a naive pass would leave them, and
re-encoding them could only risk the alpha edges the audit warned about. The
measurement is the finding.

## Still external

Low-end mobile decode time, real-device acceptance, and the deployment gates
(NUC, HTTPS, Lichess OAuth) need hardware and credentials, and remain in the
release checklist rather than being claimed here.

## Verification

- `e2e/audit-cleanup.spec.ts` measures F6 rows and boxes, F7 control heights, and
  the F8 empty/ready states, plus the phone overflow re-check.
- `e2e/zoom-acceptance.spec.ts` covers the four zoom levels and the zoomed
  promotion chooser.
- `e2e/offline.spec.ts` (release suite) covers the piece path, the payload budget
  and the cache contents on the production build.
- `node scripts/sync-piece-assets.mjs --check` passes, and was verified to fail
  with the offending file name when a copy is corrupted.
- The mobile companion was verified at runtime against its Vite dev server: the
  board renders three authored pieces decoded at their full 512 px, and the
  production build emits all twelve PNG assets.
