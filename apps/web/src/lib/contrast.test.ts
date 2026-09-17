import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The ink contract from the 2026-09-15 audit: functional text must clear 4.5:1
 * against every surface it can sit on, and decorative ink is allowed to fail
 * because it never carries words a visitor needs.
 *
 * The numbers are computed from `tokens.css` rather than duplicated here, so a
 * palette change fails this test instead of silently shipping.
 */
const tokens = readFileSync(join(process.cwd(), "src/app/styles/tokens.css"), "utf8");

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
  if (!match?.[1]) throw new Error(`Token --${name} is not a hex colour in tokens.css`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const [dark, light] = [luminance(foreground), luminance(background)].sort((left, right) => left - right);
  return (light! + 0.05) / (dark! + 0.05);
}

const SURFACES = ["surface-page", "surface-paper", "surface-raised", "wash-blue", "wash-pink", "wash-sage", "wash-cream"] as const;
const FUNCTIONAL_INK = ["ink-primary", "ink-secondary", "ink-muted"] as const;

describe("ink contrast contract", () => {
  it("keeps every functional ink above 4.5:1 on every surface", () => {
    for (const ink of FUNCTIONAL_INK) {
      for (const surface of SURFACES) {
        const ratio = contrast(token(ink), token(surface));
        expect(ratio, `--${ink} on --${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps accent links above 4.5:1 where they are used as text", () => {
    for (const surface of SURFACES) {
      const ratio = contrast(token("accent-primary"), token(surface));
      // The accent is the primary action colour. It clears the threshold on the
      // page and paper surfaces it is used on; on the tinted washes the product
      // uses ink-primary instead, which is checked above.
      if (surface === "surface-page" || surface === "surface-paper" || surface === "surface-raised") {
        expect(ratio, `--accent-primary on --${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps decorative ink labelled as decorative", () => {
    // Faint ink is documented as decoration. If a future change makes it pass,
    // this test says so and the comment in tokens.css must change with it.
    const faint = contrast(token("ink-faint"), token("surface-page"));
    expect(faint).toBeLessThan(4.5);
    expect(tokens).toContain("Decorative only");
  });
});
