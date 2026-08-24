"use client";

import type { MoveClassification } from "@chess-review/shared";
import { QUALITY_META, QualityIcon } from "@chess-review/ui";

const CLASSIFICATIONS = Object.keys(QUALITY_META) as MoveClassification[];
const SIZES = [20, 24, 28, 36] as const;
const BACKGROUNDS = [
  { name: "Warm paper", className: "paper" },
  { name: "Mist", className: "mist" },
  { name: "Chess light", className: "light-square" },
  { name: "Chess dark", className: "dark-square" },
] as const;

export default function QualityIconFixturePage() {
  return (
    <main className="quality-fixture-page">
      <header><span>LOCAL VISUAL FIXTURE</span><h1>Move Quality · Annotation System V3</h1><p>Four geometric families keep every objective classification legible at 20, 24, 28 and 36 px.</p></header>
      <div className="quality-fixture-grid">
        {CLASSIFICATIONS.map((classification) => (
          <section key={classification}>
            <div><QualityIcon classification={classification} size={36} /><strong>{QUALITY_META[classification].label}</strong><small>{QUALITY_META[classification].motif}</small></div>
            {BACKGROUNDS.map((background) => (
              <article className={background.className} key={background.name}>
                <span>{background.name}</span>
                {SIZES.map((size) => <QualityIcon classification={classification} size={size} key={size} />)}
              </article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
