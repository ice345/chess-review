import type { EngineScore, StockfishMoveAnalysis, UiLanguage } from "@chess-review/shared";

export function formatEngineScore(value: StockfishMoveAnalysis | EngineScore | null): string {
  if (!value) return "—";
  const score = "score" in value ? value.score : value;
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `−M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

const AGE_COPY: Record<UiLanguage, {
  justNow: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
}> = {
  en: {
    justNow: "just now",
    minutes: (n) => `${n} min ago`,
    hours: (n) => `${n} h ago`,
    days: (n) => `${n} d ago`,
  },
  "zh-CN": {
    justNow: "刚刚",
    minutes: (n) => `${n} 分钟前`,
    hours: (n) => `${n} 小时前`,
    days: (n) => `${n} 天前`,
  },
};

/**
 * How old a cached third-party answer is, in words.
 *
 * Position lookups age, and saying how old an answer is matters more than the
 * exact timestamp, so the same wording is used wherever such an answer is shown.
 */
export function describeFetchAge(fetchedAt: string, language: UiLanguage): string {
  const elapsed = Date.now() - Date.parse(fetchedAt);
  const copy = AGE_COPY[language];
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return copy.justNow;
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return copy.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return copy.hours(hours);
  return copy.days(Math.round(hours / 24));
}
