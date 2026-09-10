/** Liveness and immutable build identity only; no provider calls or secrets. */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", release: process.env.APP_RELEASE ?? "development" }, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
