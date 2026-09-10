import { cpSync, existsSync } from "node:fs";
import process from "node:process";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const web = path.join(root, "apps/web");
const standalone = path.join(web, ".next/standalone/apps/web");
if (!existsSync(path.join(standalone, "server.js"))) throw new Error("Run pnpm --filter @chess-review/web build first.");
cpSync(path.join(web, "public"), path.join(standalone, "public"), { recursive: true });
cpSync(path.join(web, ".next/static"), path.join(standalone, ".next/static"), { recursive: true });
const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit", env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: process.argv[2] ?? "3001" },
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
