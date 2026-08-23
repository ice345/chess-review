import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  LICHESS_PKCE_COOKIE,
  LICHESS_SESSION_COOKIE,
  openLichessValue,
  requireLichessClientId,
  sealLichessValue,
  type LichessPkceState,
  type LichessSession,
} from "../../../../../../lib/server/lichess-session";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const settingsUrl = new URL("/settings", requestUrl.origin);
  try {
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    const cookieStore = await cookies();
    const sealedPkce = cookieStore.get(LICHESS_PKCE_COOKIE)?.value;
    if (!code || !returnedState || !sealedPkce) throw new Error("OAuth callback state is missing or expired.");
    const pkce = openLichessValue<LichessPkceState>(sealedPkce);
    if (pkce.state !== returnedState || Date.now() - Date.parse(pkce.createdAt) > 10 * 60_000) throw new Error("OAuth callback state did not match.");
    const tokenResponse = await fetch("https://lichess.org/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: pkce.verifier,
        redirect_uri: pkce.redirectUri,
        client_id: requireLichessClientId(),
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error(`Lichess token exchange failed (${tokenResponse.status}).`);
    const token = await tokenResponse.json() as { access_token: string; token_type?: string; expires_in?: number };
    const accountResponse = await fetch("https://lichess.org/api/account", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" }, cache: "no-store" });
    if (!accountResponse.ok) throw new Error(`Lichess account request failed (${accountResponse.status}).`);
    const account = await accountResponse.json() as { id: string; username: string; profile?: { realName?: string } };
    const session: LichessSession = {
      accessToken: token.access_token,
      tokenType: token.token_type ?? "Bearer",
      expiresAt: new Date(Date.now() + (token.expires_in ?? 365 * 24 * 60 * 60) * 1000).toISOString(),
      account: { id: account.id, username: account.username, ...(account.profile?.realName ? { displayName: account.profile.realName } : {}) },
    };
    const response = NextResponse.redirect(new URL("/settings?lichess=connected", requestUrl.origin));
    response.cookies.set(LICHESS_SESSION_COOKIE, sealLichessValue(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/",
      expires: new Date(session.expiresAt),
    });
    response.cookies.set(LICHESS_PKCE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    settingsUrl.searchParams.set("lichess", "error");
    settingsUrl.searchParams.set("reason", error instanceof Error ? error.message.slice(0, 180) : "OAuth failed");
    return NextResponse.redirect(settingsUrl);
  }
}
