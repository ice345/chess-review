export type DeploymentMode = "browser-core" | "enhanced-local";
export type LocalAiAccess = { state: "enabled"; url: string } | { state: "not-provided" | "not-configured"; message: string };

export function isLoopbackHostname(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname.toLowerCase());
}

/** Public builds default to Browser Core. Hosted AI is deliberately not a supported mode. */
export const DEPLOYMENT_MODE: DeploymentMode = process.env.NEXT_PUBLIC_APP_MODE === "enhanced-local"
  || (!process.env.NEXT_PUBLIC_APP_MODE && process.env.NODE_ENV === "development") ? "enhanced-local" : "browser-core";
export const LOCAL_AI_ENDPOINT = process.env.NEXT_PUBLIC_LOCAL_AI_URL ?? "http://127.0.0.1:8000";

export function resolveLocalAiAccess(mode: DeploymentMode, endpoint: string, hostname: string): LocalAiAccess {
  if (mode === "browser-core" || !isLoopbackHostname(hostname)) return { state: "not-provided", message: "This website provides Browser Core. Maia and generative coaching are available in Enhanced Local mode; browser review and grounded summaries are available here." };
  try {
    const url = new URL(endpoint);
    if (!["http:", "https:"].includes(url.protocol) || !isLoopbackHostname(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error();
    return { state: "enabled", url: url.href.replace(/\/$/, "") };
  } catch { return { state: "not-configured", message: "The local enhancement address is not configured correctly. Browser review remains available. See local setup help." }; }
}
export function localAiAccess(): LocalAiAccess {
  return resolveLocalAiAccess(DEPLOYMENT_MODE, LOCAL_AI_ENDPOINT, typeof window === "undefined" ? "" : window.location.hostname);
}
