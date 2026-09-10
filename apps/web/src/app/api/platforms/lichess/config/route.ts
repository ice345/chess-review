import { platformRequest } from "../../../../../lib/server/platform-request";
import { lichessOrigin } from "../../../../../lib/server/lichess-session";

export async function GET(request: Request) {
  return platformRequest(request, async () => {
    const clientId = process.env.LICHESS_CLIENT_ID?.trim();
    const secret = process.env.LICHESS_SESSION_SECRET;
    let validOrigin = false;
    try { lichessOrigin(request); validOrigin = true; } catch { /* Optional on this deployment. */ }
    return Response.json({ configured: Boolean(validOrigin && clientId && secret && secret.length >= 24), publicClientId: clientId ?? null });
  });
}
