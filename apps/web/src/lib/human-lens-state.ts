import type { UiLanguage } from "@chess-review/shared";
import type { MaiaAvailability } from "./local-ai";

export type MaiaServiceState = "checking" | MaiaAvailability | "offline" | "not-provided" | "not-configured";

const SERVICE_COPY: Record<UiLanguage, Record<MaiaServiceState, string>> = {
  en: {
    "not-provided": "Maia is not provided by this website. Browser Stockfish remains fully available. Learn about Enhanced Local in Help.",
    "not-configured": "Local enhancements are not configured correctly. Browser Stockfish remains fully available. Check local setup in Help.",
    checking: "Checking the optional Maia capability…",
    available: "Maia-3 is ready for this position.",
    "not-installed": "Local runtime found; Maia-3 is not installed. Browser Stockfish remains fully available.",
    error: "Maia could not initialize. Browser Stockfish remains fully available.",
    offline: "Local Maia service is offline. Browser Stockfish remains fully available.",
  },
  "zh-CN": {
    "not-provided": "本网站不提供 Maia。浏览器 Stockfish 仍然完全可用。可在帮助中了解本地增强。",
    "not-configured": "本地增强未正确配置。浏览器 Stockfish 仍然完全可用。请在帮助中查看本地设置。",
    checking: "正在检查可选的 Maia 能力…",
    available: "Maia-3 已为此局面就绪。",
    "not-installed": "已找到本地运行时；尚未安装 Maia-3。浏览器 Stockfish 仍然完全可用。",
    error: "Maia 无法初始化。浏览器 Stockfish 仍然完全可用。",
    offline: "本地 Maia 服务离线。浏览器 Stockfish 仍然完全可用。",
  },
};

export function humanLensServiceCopy(state: MaiaServiceState, language: UiLanguage): string {
  return SERVICE_COPY[language][state];
}
