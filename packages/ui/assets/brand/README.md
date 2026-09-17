# Brand artwork

`logo.png` is the authored product illustration as delivered: a bishop whose wing
follows the piece's diagonal, standing in a window arch with faint foliage and a
reflection, on the Windowlight paper. It is the source of truth for the mark.

Everything else in this directory is derived by
`node scripts/sync-brand-assets.mjs` and must not be edited by hand:

| File | Purpose |
| --- | --- |
| `logo.png` | Authored artwork, 1254². Kept as delivered. |
| `brand-mark.png` | 1024² mark. Input for `tauri icon` and any future large placement. |
| `brand-badge.png` | 160² mark. The file the app badge actually renders. |

The Web favicon, the iOS icon and the manifest icons are written into
`apps/web/` by the same script. `--check` verifies every derived file exists at
its exact size, so an artwork revision cannot land in one place only; CI runs it
next to the piece-asset check.

## Why the mark is a crop

The illustration is drawn to be looked at, not to survive a 16px browser tab:
below roughly 96px the arch, the foliage and the reflection collapse into a grey
smudge around a very small piece. The script therefore measures the artwork and
derives the mark instead of shipping the whole picture:

- the **composition** box is the ink bounding box (pixels more than 22 from the
  paper colour), which is what `--measure` reports for re-framing new art;
- the **subject** band is the piece and its wing (measured at x 569-960,
  y 300-1055, framed as `SUBJECT_BAND` with room for the pale wing tips), and it
  is what every derived file uses.

The band is validated on every run: if the artwork is replaced and the darkest
pixels no longer fall inside the band, generation fails instead of producing a
badly framed mark. Re-frame with `node scripts/sync-brand-assets.mjs --measure`,
which prints the ink box for a ladder of distances.

The mark keeps the window frame that crosses behind the wing as a faint
background, so the icon still carries the artwork's air at 180px and above while
the piece stays readable at 16px.

## Regenerating

```sh
node scripts/sync-brand-assets.mjs            # rewrite mark and icons
node scripts/sync-brand-assets.mjs --check    # verify sizes (no browser needed)
node scripts/sync-brand-assets.mjs --measure  # print ink boxes, write nothing
```

Generation renders through the Playwright Chromium that the end-to-end suite
already installs; `--check` reads PNG headers only.

Replacing the mark means regenerating the desktop icon set as well, because
Tauri keeps its own raster set:

```sh
pnpm --filter @chess-review/desktop exec tauri icon packages/ui/assets/brand/brand-mark.png
```
