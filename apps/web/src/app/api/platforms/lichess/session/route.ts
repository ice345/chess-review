import { cookies } from "next/headers";
import type { PlatformAccount } from "@chess-review/shared";
import { LICHESS_SESSION_COOKIE, openLichessValue, type LichessSession } from "../../../../../lib/server/lichess-session";

export async function GET() {
  try {
    const sealed = (await cookies()).get(LICHESS_SESSION_COOKIE)?.value;
    if (!sealed) return Response.json({ connected: false });
    const session = openLichessValue<LichessSession>(sealed);
    if (Date.parse(session.expiresAt) <= Date.now()) return Response.json({ connected: false, expired: true });
    const account: PlatformAccount = {
      id: `lichess:${session.account.id}`,
      provider: "lichess",
      username: session.account.username,
      ...(session.account.displayName ? { displayName: session.account.displayName } : {}),
      ...(session.account.avatarUrl ? { avatarUrl: session.account.avatarUrl } : {}),
      authMode: "oauth-pkce",
      verified: true,
      linkedAt: new Date().toISOString(),
      ...(session.account.ratings ? { ratings: session.account.ratings } : {}),
    };
    return Response.json({ connected: true, account, expiresAt: session.expiresAt });
  } catch {
    return Response.json({ connected: false });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(LICHESS_SESSION_COOKIE)?.value;
  if (sealed) {
    try {
      const session = openLichessValue<LichessSession>(sealed);
      await fetch("https://lichess.org/api/token", { method: "DELETE", headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" });
    } catch {
      // Local logout still succeeds when the remote token has already expired.
    }
  }
  cookieStore.set(LICHESS_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
