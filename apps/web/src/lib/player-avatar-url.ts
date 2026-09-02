import type { ExternalPlatform } from "@chess-review/shared";

export const AVATAR_HOSTS: Record<ExternalPlatform, readonly string[]> = {
  chesscom: ["images.chesscomfiles.com"],
  lichess: ["images.lichess1.org", "lichess1.org"],
};

export function allowedAvatarUrl(provider: ExternalPlatform, value: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return undefined;
  return AVATAR_HOSTS[provider].includes(parsed.hostname) ? parsed.toString() : undefined;
}
