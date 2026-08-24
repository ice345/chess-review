import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stylesDirectory = join(process.cwd(), "src/app/styles");
const styles = Object.fromEntries(
  readdirSync(stylesDirectory)
    .filter((file) => file.endsWith(".css"))
    .map((file) => [file, readFileSync(join(stylesDirectory, file), "utf8")]),
);

const ownership = {
  ".review-shell": "review-shell.css",
  ".review-titlebar": "review-shell.css",
  ".review-workspace": "review-shell.css",
  ".context-panel": "review-shell.css",
  ".board-stage": "review-workspace.css",
  ".board-wrap": "review-workspace.css",
  ".move-dock": "review-workspace.css",
  ".eval-bar": "review-semantics.css",
  ".board-quality-badge": "review-semantics.css",
  ".dual-verdict": "review-semantics.css",
  ".route-heading": "review-panels.css",
  ".overview-tab": "review-panels.css",
  ".service-dot": "review-panels.css",
  ".engine-config": "review-panels.css",
  ".analysis-lens-panel": "human-lens.css",
  ".human-model-status": "utilities.css",
} as const;

function selectorDeclaration(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}(?=[\\s,{>:#.])`, "m");
}

describe("review stylesheet ownership", () => {
  it("keeps former global review selectors in one named feature stylesheet", () => {
    expect(existsSync(join(process.cwd(), "src/app/globals.css"))).toBe(false);

    for (const [selector, expectedOwner] of Object.entries(ownership)) {
      const owners = Object.entries(styles)
        .filter(([, contents]) => selectorDeclaration(selector).test(contents))
        .map(([file]) => file);
      expect(owners, selector).toEqual([expectedOwner]);
    }
  });
});
