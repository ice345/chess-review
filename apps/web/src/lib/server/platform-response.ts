/** Error bodies are never exposed; close them before releasing a provider lane. */
export async function fetchProvider(url: string | URL, options: RequestInit): Promise<Response> {
  const response = await fetch(url, options);
  if (!response.ok) await response.body?.cancel();
  return response;
}

/** Bounded provider bodies, separate from user-input errors (oversize upstream = 502). */
export async function readProviderText(response: Response, signal: AbortSignal, limit = 16 * 1024 * 1024): Promise<string> {
  const advertised = Number(response.headers.get("content-length"));
  if (advertised > limit) { await response.body?.cancel(); throw new Error("Platform response is too large."); }
  if (!response.body) return "";
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read(); signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Platform response is too large."); }
      chunks.push(value);
    }
    const data = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(data);
  } finally { signal.removeEventListener("abort", abort); reader.releaseLock(); }
}
export async function readProviderJson<T>(response: Response, signal: AbortSignal, limit?: number): Promise<T> {
  return JSON.parse(await readProviderText(response, signal, limit)) as T;
}
