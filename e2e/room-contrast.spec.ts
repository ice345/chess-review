import { expect, test } from "@playwright/test";
import { mockLocalAi, seedConnectedLibrary, seedReview } from "./fixtures";

/**
 * Contrast on the room, measured from the pixels the browser paints.
 *
 * The application's page is a photograph with a 6% paper wash, so the token pairs
 * asserted in `src/lib/contrast.test.ts` are not the whole contract: a word that sits
 * on the room has whatever the photograph has underneath it. This suite hides every
 * glyph (the text colour goes transparent, so each element's line box holds only its
 * background), screenshots the page, and computes the WCAG ratio between the element's
 * recorded ink and the darkest background sample behind its own line boxes.
 *
 * A regression here means a change to the wash, the rail's paper, the head's glow or an
 * ink tier pushed a word below its threshold on some part of the photograph.
 */

const SELECTORS = [
  ".brand strong",
  ".brand small",
  ".rail-nav a",
  ".rail-nav a[aria-current='page']",
  ".rail-quote",
  ".rail-foot",
  ".page-kicker",
  ".page-display",
  ".page-lede",
  ".page-steps span",
] as const;

const ROUTES = ["/", "/import", "/stats", "/history", "/training", "/settings"] as const;

type Target = {
  sel: string;
  text: string;
  box: [number, number, number, number];
  color: string;
  size: number;
  weight: number;
};

test("every word painted on the room photograph clears its contrast threshold", async ({ page }) => {
  await mockLocalAi(page, "offline");
  await seedReview(page, { visualLabels: true });
  await seedConnectedLibrary(page, 84);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const route of ROUTES) {
    await page.goto(route);
    const targets = await page.evaluate((sels): Target[] => {
      const out: Target[] = [];
      for (const sel of sels) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const style = getComputedStyle(el);
          // The glyphs' own line boxes: a rule or an icon inside the same element is
          // not the text's background.
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width < 2 || rect.height < 2) continue;
            if (rect.bottom < 0 || rect.top > innerHeight) continue;
            out.push({
              sel,
              text: (el.textContent ?? "").trim().slice(0, 22),
              box: [rect.left, rect.top, rect.right, rect.bottom],
              color: style.color,
              size: parseFloat(style.fontSize),
              weight: Number(style.fontWeight) || 400,
            });
          }
        }
      }
      return out;
    }, SELECTORS);
    expect(targets.length, `${route}: nothing to measure`).toBeGreaterThan(6);

    await page.addStyleTag({
      content:
        "*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }",
    });
    const shot = (await page.screenshot()).toString("base64");

    const measured = await page.evaluate(
      async ({ b64, targets }) => {
        const luminance = (r: number, g: number, b: number) => {
          const channel = (value: number) => {
            const v = value / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };
        const image = new Image();
        image.src = `data:image/png;base64,${b64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const dpr = canvas.width / innerWidth;

        return targets.map((target) => {
          const [r, g, b] = target.color.match(/[\d.]+/g)!.map(Number);
          const ink = luminance(r, g, b);
          const samples: number[] = [];
          const x0 = Math.max(0, Math.round(target.box[0] * dpr));
          const y0 = Math.max(0, Math.round(target.box[1] * dpr));
          const x1 = Math.min(canvas.width, Math.round(target.box[2] * dpr));
          const y1 = Math.min(canvas.height, Math.round(target.box[3] * dpr));
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * canvas.width + x) * 4;
              samples.push(luminance(pixels[i], pixels[i + 1], pixels[i + 2]));
            }
          }
          samples.sort((a, b) => a - b);
          // The second percentile is the darkest background the glyphs can sit on.
          const background = samples[Math.floor(samples.length * 0.02)] ?? 0;
          const [hi, lo] = background > ink ? [background, ink] : [ink, background];
          const large = target.size >= 24 || (target.size >= 18.66 && target.weight >= 700);
          return {
            sel: target.sel,
            text: target.text,
            size: target.size,
            need: large ? 3 : 4.5,
            ratio: Number(((hi + 0.05) / (lo + 0.05)).toFixed(2)),
          };
        });
      },
      { b64: shot, targets },
    );

    const failures = measured.filter((row) => row.ratio < row.need);
    expect(
      failures,
      `${route}:\n` +
        failures.map((f) => `  ${f.sel} ${f.size}px needs ${f.need}, measured ${f.ratio} — ${f.text}`).join("\n"),
    ).toEqual([]);
  }
});
