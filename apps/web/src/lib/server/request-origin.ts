/** Next standalone may construct request.url from its internal listen address.
 * Opt in only behind an ingress that overwrites Host and forwarding headers
 * and prevents direct access to the Node port (see deploy/nuc).
 */
export function requestOrigin(request: Request): string {
  if (process.env.TRUST_PROXY_ORIGIN !== "1") {
    const url = new URL(request.url);
    // Next may use its listen address (localhost/0.0.0.0) in request.url,
    // even when a browser opened 127.0.0.1. Accept only a loopback Host on
    // that exact port; never trust forwarded or arbitrary public hosts here.
    const loopback = (hostname: string) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
    const host = request.headers.get("host");
    if (host && (loopback(url.hostname) || ["0.0.0.0", "[::]"].includes(url.hostname))) {
      try {
        const direct = new URL(`${url.protocol}//${host}`);
        if (loopback(direct.hostname) && direct.host === host && direct.port === url.port
          && direct.pathname === "/" && !direct.username && !direct.password && !direct.search && !direct.hash) return direct.origin;
      } catch { /* Fall back to the unmodified request URL. */ }
    }
    return url.origin;
  }
  const configured = new URL(process.env.APP_ORIGIN ?? "");
  if (configured.protocol !== "https:" || configured.username || configured.password
    || configured.pathname !== "/" || configured.search || configured.hash
    || request.headers.get("host") !== configured.host
    || request.headers.get("x-forwarded-host") !== configured.host
    || request.headers.get("x-forwarded-proto") !== "https") {
    throw new Error("The trusted proxy origin does not match the configured website.");
  }
  return configured.origin;
}
