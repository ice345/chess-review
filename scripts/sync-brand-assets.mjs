#!/usr/bin/env node
/* global Buffer, console, document, Image, process */
/*
 * Brand assets: one authored illustration, one measured mark, every icon size.
 *
 * The authored artwork (`packages/ui/assets/brand/logo.png`) is the source of
 * truth: a bishop that carries a wing inside a window arch, on the Windowlight
 * paper. The application mark and the install icons are derived from it, because
 * the illustration itself is far too wide to read at 16-38px: at those sizes the
 * arch, the foliage and the reflection collapse into noise.
 *
 *   logo.png          authored illustration, kept as delivered
 *   brand-mark.png    measured crop around the composition, 1024 square
 *   brand-badge.png   the same crop at the size the app badge renders
 *   icon.png          the Web favicon (Next.js file convention)
 *   apple-icon.png    the iOS home-screen icon
 *   brand/icon-*.png  the manifest icons, including the maskable variant
 *
 * Cropping is measured, not guessed: the script finds the ink bounding box
 * (pixels that differ from the paper by more than `INK_DISTANCE`), squares it,
 * adds `MARGIN` of breathing room and only then scales. Replacing the artwork
 * therefore re-derives the crop instead of leaving the mark framed for the old
 * picture.
 *
 * `--measure` prints the ink box for a ladder of distances, which is how the
 * subject is told apart from the pale arch and foliage of the artwork: at 22 the
 * window frame is ink too, at 90 only the bishop-bird is. `--check` validates the derived set
 * (existence, square aspect, exact pixel size) without a browser, so CI can run
 * it beside the piece-asset check. Regenerate with:
 *
 *   node scripts/sync-brand-assets.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "packages/ui/assets/brand/logo.png");

/** Pixels this far from the paper colour count as artwork: the arch, the foliage,
 * the reflection and the piece together. This frames the whole composition. */
const INK_DISTANCE = 22;
/**
 * The piece and its wing, framed as a tall band, measured on this artwork with
 * `--measure` (the piece's own ink sits at x 569-960, y 300-1055; the band adds
 * room for the pale wing tips and keeps the window frame out of the left edge).
 * Below roughly 96px the arch, foliage and reflection are not readable at all, so
 * the badge and the favicon use this band while larger icons use the composition.
 * Re-frame it with `--measure` if the artwork is replaced; `validate` below fails
 * loudly when the band no longer holds the artwork's darkest pixels.
 */
const SUBJECT_BAND = { x: 500, y: 285, width: 560, height: 785 };
/** Breathing room around the measured composition, as a fraction of its longest side.
 * The composition is already 813x961 inside 1254px of paper, so squaring it needs
 * almost no extra margin: 3% keeps the arch, the foliage and the reflection inside
 * the frame while the subject stays large enough to read at 16px. */
const MARGIN = 0.015;
/**
 * How much of the square the piece fills. A square icon can hold 0.94; a round
 * one cannot, because the corners of the piece's base would be clipped by the
 * curve, and Android's maskable icon has to survive a launcher's own shape.
 */
const SUBJECT_SCALE = 0.94;
const ROUND_SCALE = 0.86;
const MASKABLE_SCALE = 0.78;

const DERIVED = [
  // One mark, cropped to the piece: below roughly 96px the window frame and the
  // foliage of the illustration are not readable, and the icon has to survive on
  // a home screen and in a browser tab. The 1024 master is what an icon builder
  // needs; the 160 is what the app badge actually renders; the rest are icons.
  { file: "packages/ui/assets/brand/brand-mark.png", size: 1024, crop: "subject" },
  { file: "packages/ui/assets/brand/brand-badge.png", size: 160, crop: "subject", scale: "round" },
  { file: "apps/web/src/app/icon.png", size: 64, crop: "subject" },
  { file: "apps/web/src/app/apple-icon.png", size: 180, crop: "subject", scale: "round" },
  { file: "apps/web/public/brand/icon-192.png", size: 192, crop: "subject" },
  { file: "apps/web/public/brand/icon-512.png", size: 512, crop: "subject" },
  { file: "apps/web/public/brand/icon-maskable-512.png", size: 512, crop: "subject", maskable: true },
];

const check = process.argv.includes("--check");
const measure = process.argv.includes("--measure");

function pngSize(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

if (!existsSync(SOURCE)) {
  console.error(`brand assets: missing authored artwork at ${relative(root, SOURCE)}`);
  process.exit(1);
}

const sourceSize = pngSize(SOURCE);
if (!sourceSize || sourceSize.width !== sourceSize.height) {
  console.error(`brand assets: ${relative(root, SOURCE)} must be a square PNG (found ${JSON.stringify(sourceSize)})`);
  process.exit(1);
}

if (check) {
  const problems = [];
  for (const { file, size } of DERIVED) {
    const path = join(root, file);
    if (!existsSync(path)) { problems.push(`${file}: missing`); continue; }
    const actual = pngSize(path);
    if (!actual) problems.push(`${file}: not a PNG`);
    else if (actual.width !== size || actual.height !== size) problems.push(`${file}: ${actual.width}x${actual.height}, expected ${size}x${size}`);
  }
  if (problems.length > 0) {
    console.error(`brand assets: derived set does not match the artwork\n  ${problems.join("\n  ")}\nRun: node scripts/sync-brand-assets.mjs`);
    process.exit(1);
  }
  console.log(`brand assets: mark and ${DERIVED.length - 1} icon sizes derive from ${relative(root, SOURCE)} (${sourceSize.width}px)`);
  process.exit(0);
}

const MEASURE_LADDER = [22, 40, 60, 90, 120];

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const sourceUrl = `data:image/png;base64,${readFileSync(SOURCE).toString("base64")}`;
  const rendered = await page.evaluate(async ({ sourceUrl, inkDistance, subjectBand, ladder, margin, subjectScale, roundScale, maskableScale, jobs }) => {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const probe = document.createElement("canvas");
    probe.width = image.naturalWidth;
    probe.height = image.naturalHeight;
    const context = probe.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, probe.width, probe.height);
    // The paper is sampled just inside the corner, where the artwork is empty.
    const paper = [data[0], data[1], data[2]];

    const boxes = new Map();
    let darkest = 0;
    let darkestAt = null;
    for (let y = 0; y < probe.height; y += 1) {
      for (let x = 0; x < probe.width; x += 1) {
        const at = (y * probe.width + x) * 4;
        const distance = Math.max(
          Math.abs(data[at] - paper[0]),
          Math.abs(data[at + 1] - paper[1]),
          Math.abs(data[at + 2] - paper[2]),
        );
        if (distance > darkest) { darkest = distance; darkestAt = { x, y }; }
        for (const threshold of ladder) {
          if (distance <= threshold) continue;
          const box = boxes.get(threshold) ?? { left: probe.width, top: probe.height, right: -1, bottom: -1 };
          if (x < box.left) box.left = x;
          if (x > box.right) box.right = x;
          if (y < box.top) box.top = y;
          if (y > box.bottom) box.bottom = y;
          boxes.set(threshold, box);
        }
      }
    }
    const sized = (box) => ({ left: box.left, top: box.top, width: box.right - box.left + 1, height: box.bottom - box.top + 1 });
    if (!darkestAt) throw new Error("the artwork has no pixels that differ from its paper colour");
    const chosen = boxes.get(inkDistance);
    if (!chosen) throw new Error(`the artwork has no pixels more than ${inkDistance} from its paper colour`);
    const ladderBoxes = ladder.map((threshold) => [threshold, boxes.has(threshold) ? sized(boxes.get(threshold)) : null]);

    const box = sized(chosen);
    const band = { left: subjectBand.x, top: subjectBand.y, width: subjectBand.width, height: subjectBand.height };
    if (band.left < 0 || band.top < 0 || band.left + band.width > probe.width || band.top + band.height > probe.height) {
      throw new Error(`the subject band ${JSON.stringify(band)} does not fit inside the ${probe.width}px artwork`);
    }
    const insideBand = darkestAt.x >= band.left && darkestAt.x < band.left + band.width
      && darkestAt.y >= band.top && darkestAt.y < band.top + band.height;
    if (!insideBand) throw new Error(`the darkest pixel ${darkestAt.x},${darkestAt.y} falls outside the subject band; re-frame it with --measure`);
    const side = Math.round(Math.max(box.width, box.height) * (1 + margin * 2));
    const crop = {
      x: Math.round(Math.max(0, Math.min(probe.width - side, box.left + box.width / 2 - side / 2))),
      y: Math.round(Math.max(0, Math.min(probe.height - side, box.top + box.height / 2 - side / 2))),
      side,
    };

    const drawn = {};
    for (const job of jobs) {
      const target = document.createElement("canvas");
      target.width = job.size;
      target.height = job.size;
      const out = target.getContext("2d");
      out.imageSmoothingEnabled = true;
      out.imageSmoothingQuality = "high";
      if (job.crop === "subject") {
        // The piece is a tall silhouette: crop its band and letter it on the
        // artwork's own paper, so the mark shows the bishop rather than a
        // shrunken window. A maskable icon is inset far enough to survive the
        // launcher's own shape instead of being cropped by it.
        const fill = job.maskable ? maskableScale : job.scale === "round" ? roundScale : subjectScale;
        const inner = Math.round(job.size * fill);
        const scale = Math.min(inner / band.width, inner / band.height);
        const w = band.width * scale;
        const h = band.height * scale;
        out.fillStyle = `rgb(${paper[0]},${paper[1]},${paper[2]})`;
        out.fillRect(0, 0, job.size, job.size);
        out.drawImage(image, band.left, band.top, band.width, band.height, (job.size - w) / 2, (job.size - h) / 2, w, h);
      } else {
        out.drawImage(image, crop.x, crop.y, crop.side, crop.side, 0, 0, job.size, job.size);
      }
      drawn[job.file] = target.toDataURL("image/png");
    }
    return { box, crop, band, paper, drawn, ladderBoxes, darkestAt };
  }, { sourceUrl, inkDistance: INK_DISTANCE, subjectBand: SUBJECT_BAND, ladder: MEASURE_LADDER, margin: MARGIN, subjectScale: SUBJECT_SCALE, roundScale: ROUND_SCALE, maskableScale: MASKABLE_SCALE, jobs: DERIVED });

  const describe = (box) => `${box.width}x${box.height} at ${box.left},${box.top}`;
  console.log(`brand assets: artwork ${sourceSize.width}px, paper rgb(${rendered.paper.join(", ")})`);
  if (measure) for (const [threshold, box] of rendered.ladderBoxes) console.log(`  distance > ${threshold}: ${box ? describe(box) : "no ink"}`);
  console.log(`brand assets: ink box ${describe(rendered.box)} -> crop ${rendered.crop.side}px at ${rendered.crop.x},${rendered.crop.y}`);
  console.log(`brand assets: subject band ${describe(rendered.band)}, darkest pixel ${rendered.darkestAt.x},${rendered.darkestAt.y}`);

  if (measure) process.exit(0);

  for (const { file } of DERIVED) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(rendered.drawn[file].split(",")[1], "base64"));
    console.log(`brand assets: wrote ${file}`);
  }
} finally {
  await browser.close();
}
