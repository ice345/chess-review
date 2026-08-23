export async function GET() {
  const clientId = process.env.LICHESS_CLIENT_ID?.trim();
  const secret = process.env.LICHESS_SESSION_SECRET;
  return Response.json({
    configured: Boolean(clientId && secret && secret.length >= 24),
    publicClientId: clientId ?? null,
  });
}
