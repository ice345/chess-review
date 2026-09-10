import { platformRequest } from "../../../../../../lib/server/platform-request";
import { NextResponse } from "next/server";
import {
  base64UrlSha256,
  lichessOrigin,
  LICHESS_PKCE_COOKIE,
  randomBase64Url,
  requireLichessClientId,
  sealLichessValue,
  type LichessPkceState,
} from "../../../../../../lib/server/lichess-session";

export async function GET(request: Request) { return platformRequest(request, start); }

async function start(request: Request) {
  try {
    const clientId = requireLichessClientId();
    const requestUrl = new URL(lichessOrigin(request));
    const redirectUri = `${requestUrl.origin}/api/platforms/lichess/oauth/callback`;
    const verifier = randomBase64Url(48);
    const state = randomBase64Url(24);
    const pkce: LichessPkceState = { state, verifier, redirectUri, createdAt: new Date().toISOString() };
    const authorization = new URL("https://lichess.org/oauth");
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("code_challenge_method", "S256");
    authorization.searchParams.set("code_challenge", base64UrlSha256(verifier));
    authorization.searchParams.set("scope", "");
    authorization.searchParams.set("state", state);
    const response = NextResponse.redirect(authorization);
    response.cookies.set(LICHESS_PKCE_COOKIE, sealLichessValue(pkce), {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error && /Open the configured/.test(error.message) ? error.message : "Lichess sign-in is not configured for this website. PGN import remains available." }, { status: 503 });
  }
}
