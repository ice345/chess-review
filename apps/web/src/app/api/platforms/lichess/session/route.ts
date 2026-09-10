import { fetchProvider } from "../../../../../lib/server/platform-response";
import { cookies } from "next/headers";
import type { PlatformAccount } from "@chess-review/shared";
import { acquireProvider, providerCooldown } from "../../../../../lib/server/platform-guard";
import { platformRequest } from "../../../../../lib/server/platform-request";
import { LICHESS_PKCE_COOKIE, LICHESS_SESSION_COOKIE, readLichessSession } from "../../../../../lib/server/lichess-session";

export async function GET(request: Request) {
  return platformRequest(request, async () => {
    try {
      const sealed = (await cookies()).get(LICHESS_SESSION_COOKIE)?.value;
      if (!sealed) return Response.json({ connected: false });
      const session = readLichessSession(sealed);
      const account: PlatformAccount = {
        id: `lichess:${session.account.id}`, provider: "lichess", username: session.account.username,
        ...(session.account.displayName ? { displayName: session.account.displayName } : {}),
        ...(session.account.avatarUrl ? { avatarUrl: session.account.avatarUrl } : {}),
        authMode: "oauth-pkce", verified: true, linkedAt: new Date().toISOString(),
        ...(session.account.ratings ? { ratings: session.account.ratings } : {}),
      };
      return Response.json({ connected: true, account, expiresAt: session.expiresAt });
    } catch { return Response.json({ connected: false, expired: true }); }
  });
}

export async function DELETE(request: Request) {
  // Clearing this browser's session must still work if upstream revocation is
  // unavailable or busy; the client receives an explicit remote-revocation flag.
  return platformRequest(request, async (_request, signal) => {
    const cookieStore = await cookies(), sealed = cookieStore.get(LICHESS_SESSION_COOKIE)?.value;
    let remoteRevoked = !sealed;
    try {
      if (sealed) {
        const session = readLichessSession(sealed);
        let release: (() => void) | undefined;
        try {
          release = await acquireProvider("lichess", signal);
          const result = await fetchProvider("https://lichess.org/api/token", { method: "DELETE", headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store", signal, redirect: "error" });
          remoteRevoked = result.ok || result.status === 401;
          if (result.status === 429) providerCooldown("lichess", result.headers.get("Retry-After"));
          await result.body?.cancel();
        } finally { release?.(); }
      }
    } catch { /* Local disconnect still clears expired/unreadable sessions. */ }
    for (const name of [LICHESS_SESSION_COOKIE, LICHESS_PKCE_COOKIE]) cookieStore.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:" });
    return Response.json({ ok: true, remoteRevoked });
  });
}
