# Windowlight / Bluebird V2 — design references

Status: Layout and art-direction reference.
Not pixel targets. Not shipped in any app bundle except where noted below.

| File | Screen it informs |
| --- | --- |
| `01-home.png` | Home — threshold / desk |
| `02-review-start.png` | Review Start — invitation to review |
| `03-key-moment.png` | Key Moment — one decision at a time |
| `04-practice.png` | Practice — cognitive mode change |
| `background_pic.png` | The room: the environment the other four were composed on |

These are generated art-direction mockups authored for this project. They contain
no film imagery, no character art and no official artwork from any other work.

Composition authority:
[`../../windowlight-bluebird-v2.md`](../../windowlight-bluebird-v2.md), which
adopted them as the layout reference for those four screens.

## How to read them

Take from these images:

- the composition: the route head (kicker, serif display line, lede, step trail), the
  board card with its own header and footer rows, the right-hand column of paper
  panels, and the rows of icon + label + meta that open;
- the environment: `background_pic.png` is the room the product is painted on. Its
  compressed WebP derivative is served as `apps/web/public/atmosphere/room.webp`;
- proportion, negative space, panel weight, window-light intensity and board dominance;
- which text is narrative (serif) and which is operational (sans);
- the icon family: thin line, one weight, no fill.

Do **not** take from these images:

- frosted-glass / `backdrop-filter` panels — the mockups lay translucent cards over the
  photograph and exaggerate the glass; the product keeps paper panels with a hairline and
  one soft shadow;
- the photographic still-life as a *per-screen* element — it is one fixed background for
  the whole application, never a hero image or a second layer;
- the birds, the feather and the blossom as interface motifs: they belong to the
  photograph. No interface element draws a bird or a feather;
- script quotes, decorative petals or extra ornament scattered through the interface;
- any product *fact* the images imply (a score, a count, a classification): those come from
  canonical data, never from a mockup;
- any literal film scene, character or official artwork.

## Shipping rules

- Never copy `01-home.png` … `04-practice.png` into `apps/web/public/`, and never
  reference them from application code, tests or CSS.
- `background_pic.png` is the one exception, in form only: a compressed WebP derivative is
  served as the environment. The PNG itself stays here as the design record and is never
  served or bundled.
- Playwright baselines in `e2e/__screenshots__/` are the acceptance record; these images
  are not compared against anything.
