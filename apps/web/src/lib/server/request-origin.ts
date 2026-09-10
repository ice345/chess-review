/** Next standalone may construct request.url from its internal listen address.
 * Opt in only behind an ingress that overwrites Host and forwarding headers
 * and prevents direct access to the Node port (see deploy/nuc).
 */
export function requestOrigin(request: Request): string {
  if (process.env.TRUST_PROXY_ORIGIN !== "1") return new URL(request.url).origin;
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
