/* global process */

import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceRoot = join(repositoryRoot, "services", "local-ai");
const binariesRoot = join(repositoryRoot, "apps", "desktop", "src-tauri", "binaries");
const buildRoot = join(serviceRoot, "build", "desktop-sidecar");
const distRoot = join(buildRoot, "dist");
const executableExtension = process.platform === "win32" ? ".exe" : "";
const targetArgument = process.argv.find((argument) => argument.startsWith("--target="));
const targetTriple = targetArgument?.slice("--target=".length)
  ?? execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();

if (!targetTriple) throw new Error("Could not determine the native Rust target triple.");

mkdirSync(binariesRoot, { recursive: true });
rmSync(buildRoot, { recursive: true, force: true });

execFileSync("uv", [
  "run",
  "--project", serviceRoot,
  "--extra", "maia",
  "--extra", "bundle",
  "pyinstaller",
  "--noconfirm",
  "--clean",
  "--onefile",
  "--name", "chess-review-local-ai",
  "--paths", join(serviceRoot, "src"),
  "--collect-all", "maia3",
  "--collect-all", "chess_review_local_ai",
  "--distpath", distRoot,
  "--workpath", join(buildRoot, "work"),
  "--specpath", buildRoot,
  join(serviceRoot, "sidecar_entry.py"),
], { cwd: repositoryRoot, stdio: "inherit" });

const built = join(distRoot, `chess-review-local-ai${executableExtension}`);
if (!existsSync(built)) throw new Error(`PyInstaller did not create ${basename(built)}.`);
const destination = join(binariesRoot, `chess-review-local-ai-${targetTriple}${executableExtension}`);
cpSync(built, destination);
if (process.platform !== "win32") chmodSync(destination, 0o755);
process.stdout.write(`Packaged local-ai sidecar: ${destination}\n`);
