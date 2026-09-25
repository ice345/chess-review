"use client";

import type { MoveClassification, UiLanguage } from "@chess-review/shared";
import { QUALITY_META, QualityIcon, qualityLabel } from "@chess-review/ui";
import { useUiLanguage } from "../../../hooks/use-ui-language";

const CLASSIFICATIONS = Object.keys(QUALITY_META) as MoveClassification[];
const SIZES = [20, 24, 28, 36] as const;
const BACKGROUNDS = [
  { id: "paper", className: "paper" },
  { id: "mist", className: "mist" },
  { id: "light-square", className: "light-square" },
  { id: "dark-square", className: "dark-square" },
] as const;

type FixtureCopy = {
  kicker: string;
  heading: string;
  intro: string;
  backgrounds: Record<(typeof BACKGROUNDS)[number]["id"], string>;
};

const COPY: Record<UiLanguage, FixtureCopy> = {
  en: {
    kicker: "LOCAL VISUAL FIXTURE",
    heading: "Move Quality · Annotation System V3",
    intro: "Four geometric families keep every objective classification legible at 20, 24, 28 and 36 px.",
    backgrounds: {
      paper: "Warm paper",
      mist: "Mist",
      "light-square": "Chess light",
      "dark-square": "Chess dark",
    },
  },
  "zh-CN": {
    kicker: "本地视觉样张",
    heading: "着法质量 · 标注系统 V3",
    intro: "四组几何家族让每一种客观分类在 20、24、28 和 36 px 下都清晰可辨。",
    backgrounds: {
      paper: "暖色纸面",
      mist: "薄雾",
      "light-square": "浅色棋格",
      "dark-square": "深色棋格",
    },
  },
};

export default function QualityIconFixturePage() {
  const language = useUiLanguage();
  const copy = COPY[language];
  return (
    <main className="quality-fixture-page">
      <header><span>{copy.kicker}</span><h1>{copy.heading}</h1><p>{copy.intro}</p></header>
      <div className="quality-fixture-grid">
        {CLASSIFICATIONS.map((classification) => (
          <section key={classification}>
            <div><QualityIcon classification={classification} size={36} language={language} /><strong>{qualityLabel(classification, language)}</strong><small>{QUALITY_META[classification].motif}</small></div>
            {BACKGROUNDS.map((background) => (
              <article className={background.className} key={background.id}>
                <span>{copy.backgrounds[background.id]}</span>
                {SIZES.map((size) => <QualityIcon classification={classification} size={size} key={size} language={language} />)}
              </article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
