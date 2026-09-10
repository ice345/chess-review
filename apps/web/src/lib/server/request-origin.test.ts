import { afterEach, expect, it, vi } from 'vitest';
import { requestOrigin } from './request-origin';
import { lichessOrigin } from './lichess-session';
import { sameOriginMutation } from './platform-guard';

afterEach(() => vi.unstubAllEnvs());
const headers = { host: 'chess.example.org', 'x-forwarded-host': 'chess.example.org', 'x-forwarded-proto': 'https' };
const incoming = (extra = {}, method = 'GET') => new Request('http://0.0.0.0:3000/api/platforms/lichess/session', { method, headers: { ...headers, ...extra } });
function trusted() { vi.stubEnv('APP_ORIGIN', 'https://chess.example.org'); vi.stubEnv('TRUST_PROXY_ORIGIN', '1'); }

it('ignores forwarding headers unless the deployment explicitly trusts its ingress', () => {
  vi.stubEnv('TRUST_PROXY_ORIGIN', '');
  expect(requestOrigin(incoming())).toBe('http://0.0.0.0:3000');
});
it.each(['localhost:3000', '127.0.0.1:3000', '[::1]:3000'])('accepts direct loopback Host %s despite a standalone listen URL', (host) => {
  vi.stubEnv('TRUST_PROXY_ORIGIN', '');
  const request = incoming({ host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' }, 'POST');
  expect(requestOrigin(request)).toBe(`http://${host}`);
  expect(sameOriginMutation(request)).toBe(true);
});
it.each(['evil.example:3000', 'localhost:4000', 'localhost:3000/evil', 'user@localhost:3000'])('does not widen local origin trust to %s', (host) => {
  vi.stubEnv('TRUST_PROXY_ORIGIN', '');
  expect(sameOriginMutation(incoming({ host, origin: `http://${host}` }, 'POST'))).toBe(false);
});
it('still rejects a different browser origin or cross-site request on a loopback host', () => {
  vi.stubEnv('TRUST_PROXY_ORIGIN', '');
  expect(sameOriginMutation(incoming({ host: '127.0.0.1:3000', origin: 'http://localhost:3000' }, 'POST'))).toBe(false);
  expect(sameOriginMutation(incoming({ host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'cross-site' }, 'POST'))).toBe(false);
});
it('uses the configured public HTTPS origin behind standalone and a trusted gateway', () => {
  trusted();
  expect(lichessOrigin(incoming())).toBe('https://chess.example.org');
  expect(sameOriginMutation(incoming({ origin: 'https://chess.example.org' }, 'DELETE'))).toBe(true);
  expect(sameOriginMutation(incoming({ origin: 'https://attacker.example' }, 'DELETE'))).toBe(false);
});
it.each([
  { host: 'attacker.example' }, { 'x-forwarded-host': 'attacker.example' },
  { 'x-forwarded-proto': 'http' }, { 'x-forwarded-proto': 'https,http' },
  { 'x-forwarded-host': '' }, { host: 'chess.example.org:3000' },
])('rejects inconsistent proxy headers: %j', (overrides) => {
  trusted();
  expect(() => requestOrigin(incoming(overrides))).toThrow();
  expect(sameOriginMutation(incoming({ ...overrides, origin: 'https://chess.example.org' }, 'POST'))).toBe(false);
});
it.each(['http://chess.example.org', 'https://chess.example.org/path', 'https://user@chess.example.org', ''])('fails closed with an invalid trusted origin: %s', (origin) => {
  trusted(); vi.stubEnv('APP_ORIGIN', origin);
  expect(() => requestOrigin(incoming())).toThrow();
});
