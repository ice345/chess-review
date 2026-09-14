#!/usr/bin/env node
/* global Buffer, console, process */
/*
 * Feather Porcelain piece assets: one canonical source, validated copies.
 *
 * The authored 512x512 RGBA PNGs live once, in
 * `packages/ui/assets/pieces/feather-porcelain-v1.1/`. The Web app serves them
 * from `public/`, because its board renderer, PNG export and service worker all
 * address them by URL; the mobile app imports the canonical files through Vite,
 * so it needs no copy at all.
 *
 * `--check` verifies the canonical set (the expected twelve files, 512x512, PNG
 * with an alpha channel) and that the Web copy is byte-identical, so an art
 * revision cannot land in one place only. It exits non-zero with the exact
 * mismatch. Without `--check` it writes the Web copy, skipping files that already
 * match.
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = join(root, "packages/ui/assets/pieces/feather-porcelain-v1.1");
const WEB_COPY = join(root, "apps/web/public/pieces/feather_porcelain_v1_1");
const KEYS = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
const EXPECTED_SIZE = 512;

const check = process.argv.includes("--check");
const problems = [];

function pngHeader(bytes) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!bytes.subarray(0, 8).equals(signature)) return null;
  // IHDR follows the signature: length(4) type(4) width(4) height(4) depth(1) colourType(1)
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];
  return { width, height, colorType };
}

function validate(file, label) {
  const bytes = readFileSync(file);
  const header = pngHeader(bytes);
  if (!header) {
    problems.push(`${label} is not a PNG file: ${relative(root, file)}`);
    return null;
  }
  // Colour type 6 is RGBA: the pieces must keep their transparency.
  if (header.width !== EXPECTED_SIZE || header.height !== EXPECTED_SIZE || header.colorType !== 6) {
    problems.push(`${label} must be ${EXPECTED_SIZE}x${EXPECTED_SIZE} RGBA (got ${header.width}x${header.height}, colour type ${header.colorType}): ${relative(root, file)}`);
  }
  return createHash("sha256").update(bytes).digest("hex");
}

if (!existsSync(CANONICAL)) problems.push(`Missing canonical asset directory: ${relative(root, CANONICAL)}`);
else {
  const present = readdirSync(CANONICAL).filter((name) => name.endsWith(".png")).map((name) => name.replace(/\.png$/, ""));
  const missing = KEYS.filter((key) => !present.includes(key));
  const extra = present.filter((key) => !KEYS.includes(key));
  if (missing.length > 0) problems.push(`Canonical set is missing: ${missing.join(", ")}`);
  if (extra.length > 0) problems.push(`Canonical set has unexpected files: ${extra.join(", ")}`);
}

const canonicalHashes = new Map();
if (problems.length === 0) {
  for (const key of KEYS) {
    const hash = validate(join(CANONICAL, `${key}.png`), "Canonical asset");
    if (hash) canonicalHashes.set(key, hash);
  }
}

if (problems.length === 0 && check) {
  if (!existsSync(WEB_COPY)) problems.push(`Missing Web piece copy: ${relative(root, WEB_COPY)}`);
  else {
    for (const key of KEYS) {
      const file = join(WEB_COPY, `${key}.png`);
      if (!existsSync(file)) {
        problems.push(`Web copy is missing ${key}.png`);
        continue;
      }
      const hash = validate(file, "Web copy asset");
      if (hash && hash !== canonicalHashes.get(key)) problems.push(`Web copy of ${key}.png differs from the canonical asset. Run: node scripts/sync-piece-assets.mjs`);
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`piece assets: ${problem}`);
  process.exit(1);
}

if (check) {
  console.log(`piece assets: canonical set and Web copy match (${KEYS.length} files)`);
} else {
  mkdirSync(WEB_COPY, { recursive: true });
  let written = 0;
  for (const key of KEYS) {
    const source = join(CANONICAL, `${key}.png`);
    const target = join(WEB_COPY, `${key}.png`);
    const canonical = canonicalHashes.get(key);
    const current = existsSync(target) ? createHash("sha256").update(readFileSync(target)).digest("hex") : null;
    if (current !== canonical) {
      copyFileSync(source, target);
      written += 1;
    }
  }
  // A manifest is not needed: the checksums are derived from the files themselves,
  // so there is no second list that can go stale.
  writeFileSync(join(WEB_COPY, "README.md"), "Generated from `packages/ui/assets/pieces/feather-porcelain-v1.1/` by `node scripts/sync-piece-assets.mjs`. Do not edit these files by hand.\n");
  console.log(`piece assets: Web copy up to date (${written} of ${KEYS.length} files written)`);
}
