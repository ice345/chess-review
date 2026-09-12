import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { platformRequest } from "../../../../../../lib/server/platform-request";
import { providerCooldown } from "../../../../../../lib/server/platform-guard";
import { fetchProvider, readProviderJson } from "../../../../../../lib/server/platform-response";
import { LICHESS_PKCE_COOKIE, LICHESS_SESSION_COOKIE, lichessOrigin, lichessRedirectOrigin, secureCookieFor, openLichessValue, requireLichessClientId, sealLichessValue, type LichessPkceState, type LichessSession } from "../../../../../../lib/server/lichess-session";

export async function GET(request: Request) { return platformRequest(request, callback, "lichess"); }

async function callback(request: Request, signal: AbortSignal) {
  const requestUrl = new URL(request.url);
  // Every redirect below must target the visitor's real origin: behind the
  // documented Nginx/Cloudflare deployment `requestUrl.origin` is the internal
  // container address. The configured APP_ORIGIN is preferred here because the
  // case that most needs a usable error page is precisely the one where
  // `lichessOrigin()` refuses the request, so its own fallback must not be the
  // internal address.
  const fallbackOrigin = process.env.APP_ORIGIN?.trim() || lichessRedirectOrigin(request.url);
  let origin = fallbackOrigin;
  let settingsUrl = new URL("/settings", fallbackOrigin);
  let failure = "Lichess sign-in could not be completed. Try connecting again.";
  function finish(response: NextResponse) {
    response.cookies.set(LICHESS_PKCE_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://") });
    response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  try {
    origin = lichessOrigin(request);
    settingsUrl = new URL("/settings", origin);
    if (requestUrl.searchParams.has("error")) { failure = "Lichess sign-in was cancelled. You can connect again whenever you are ready."; throw new Error(); }
    const code = requestUrl.searchParams.get("code"), returnedState = requestUrl.searchParams.get("state");
    const sealedPkce = (await cookies()).get(LICHESS_PKCE_COOKIE)?.value;
    failure = "Lichess sign-in expired or did not match this browser. Start a new connection.";
    // Authorization codes are opaque; only bound their size, then let the
    // provider validate the URL-encoded value after our PKCE/state checks.
    if (!code || code.length > 2048 || !returnedState || returnedState.length > 256 || !sealedPkce) throw new Error();
    const pkce = openLichessValue<LichessPkceState>(sealedPkce);
    const age = Date.now() - Date.parse(pkce.createdAt);
    if (pkce.state !== returnedState || !Number.isFinite(age) || age < 0 || age > 10 * 60_000
      || typeof pkce.verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(pkce.verifier)
      || pkce.redirectUri !== `${origin}/api/platforms/lichess/oauth/callback`) throw new Error();
    failure = "Lichess could not finish sign-in. Try connecting again.";
    const tokenResponse = await fetchProvider("https://lichess.org/api/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: pkce.verifier, redirect_uri: pkce.redirectUri, client_id: requireLichessClientId() }),
      cache: "no-store", signal, redirect: "error",
    });
    if (tokenResponse.status === 429) { providerCooldown("lichess", tokenResponse.headers.get("Retry-After")); failure = "Lichess asked us to wait. Try connecting again in a minute."; }
    if (!tokenResponse.ok) throw new Error();
    const token = await readProviderJson<{ access_token?: unknown; token_type?: unknown; expires_in?: unknown }>(tokenResponse, signal, 32_768);
    if (typeof token.access_token !== "string" || !/^[A-Za-z0-9_]{1,2048}$/.test(token.access_token)
      || token.token_type !== undefined && String(token.token_type).toLowerCase() !== "bearer"
      || token.expires_in !== undefined && (typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0)) throw new Error();
    const accountResponse = await fetchProvider("https://lichess.org/api/account", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" }, cache: "no-store", signal, redirect: "error" });
    if (accountResponse.status === 429) providerCooldown("lichess", accountResponse.headers.get("Retry-After"));
    if (!accountResponse.ok) throw new Error();
    const account = await readProviderJson<{ id?: unknown; username?: unknown; perfs?: Record<string, { rating?: unknown }> }>(accountResponse, signal, 1_048_576);
    if (typeof account.id !== "string" || !/^[\w-]{2,32}$/.test(account.id) || typeof account.username !== "string" || account.username.length > 32) throw new Error();
    const ratings = Object.fromEntries(["bullet", "blitz", "rapid", "classical", "correspondence"].flatMap((key) => {
      const rating = account.perfs?.[key]?.rating;
      return typeof rating === "number" && Number.isFinite(rating) && rating >= 0 && rating <= 10_000 ? [[key, rating]] : [];
    }));
    const session: LichessSession = {
      accessToken: token.access_token, tokenType: "Bearer", expiresAt: new Date(Date.now() + Math.min((token.expires_in as number | undefined) ?? 365 * 86400, 365 * 86400) * 1000).toISOString(),
      account: { id: account.id, username: account.username, ...(Object.keys(ratings).length ? { ratings } : {}) },
    };
    const response = NextResponse.redirect(new URL("/settings?lichess=connected", origin));
    response.cookies.set(LICHESS_SESSION_COOKIE, sealLichessValue(session), { httpOnly: true, sameSite: "lax", secure: secureCookieFor(request), path: "/", expires: new Date(session.expiresAt) });
    return finish(response);
  } catch {
    settingsUrl.searchParams.set("lichess", "error");
    settingsUrl.searchParams.set("reason", signal.aborted ? "Lichess sign-in timed out. Try connecting again." : failure);
    return finish(NextResponse.redirect(settingsUrl));
  }
}
