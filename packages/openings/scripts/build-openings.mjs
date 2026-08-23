import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { Chess } from "chess.js";

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = path.resolve(packageDirectory, "../..");
const sourceDirectory = path.join(repositoryRoot, "references/chess-openings");
const outputPath = path.join(packageDirectory, "src/generated/openings.json");
const index = new Map();

for (const volume of ["a", "b", "c", "d", "e"]) {
  const contents = await readFile(path.join(sourceDirectory, `${volume}.tsv`), "utf8");
  for (const [lineNumber, row] of contents.split(/\r?\n/).entries()) {
    if (lineNumber === 0 || row.trim() === "") continue;
    const [eco, name, pgn] = row.split("\t");
    if (!eco || !name || !pgn) throw new Error(`Malformed ${volume}.tsv row ${lineNumber + 1}`);
    const board = new Chess();
    board.loadPgn(pgn, { strict: false });
    const epd = board.fen().split(" ").slice(0, 4).join(" ");
    index.set(epd, [eco, name]);
  }
}

const compact = [...index.entries()]
  .map(([epd, [eco, name]]) => [epd, eco, name])
  .sort((left, right) => left[0].localeCompare(right[0]));

await writeFile(outputPath, `${JSON.stringify(compact)}\n`, "utf8");
process.stdout.write(`Generated ${compact.length} opening positions at ${outputPath}\n`);
