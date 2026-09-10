#!/usr/bin/env python3
"""Read-only local ingress checks. OAuth redirects are inspected, never followed."""
import json
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def require(condition, message):
    # These are release gates, so they must also run with PYTHONOPTIMIZE set.
    if not condition:
        raise RuntimeError(message)


def verify(values, current):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def get(path, headers=None):
        req = urllib.request.Request(f"http://127.0.0.1:{values['PORT']}{path}", headers={'Host': values['DOMAIN'], **(headers or {})})
        try:
            return opener.open(req, timeout=10)
        except urllib.error.HTTPError as error:
            return error

    with get('/api/healthz') as response:
        require(response.status == 200, 'Ingress check failed: response.status == 200')
        require(json.load(response) == {'status': 'ok', 'release': current['release']}, "Ingress check failed: json.load(response) == {'status': 'ok', 'release': current['release']}")
    with get('/help') as response:
        require(response.status == 200, 'Ingress check failed: response.status == 200')
        require(response.headers.get('X-Content-Type-Options') == 'nosniff', "Ingress check failed: response.headers.get('X-Content-Type-Options') == 'nosniff'")
        require(response.headers.get('X-Powered-By') is None, "Ingress check failed: response.headers.get('X-Powered-By') is None")
    with get('/', {'Host': 'wrong.example.org'}) as response:
        require(response.status == 421, 'Ingress check failed: response.status == 421')
    with get('/settings', {'X-Forwarded-Proto': 'http'}) as response:
        require(response.status == 308, 'Ingress check failed: response.status == 308')
        require(response.headers['Location'] == f"https://{values['DOMAIN']}/settings", 'Ingress check failed: response.headers[\'Location\'] == f"https://{values[\'DOMAIN\']}/settings"')
    with get('/engine/stockfish.wasm') as response:
        require(response.status == 200, 'Ingress check failed: response.status == 200')
        require(response.headers.get_content_type() == 'application/wasm', "Ingress check failed: response.headers.get_content_type() == 'application/wasm'")
        require(response.read(4) == b'\x00asm', "Ingress check failed: response.read(4) == b'\\x00asm'")
    with get('/engine/stockfish.js') as response:
        require(response.status == 200, 'Ingress check failed: response.status == 200')
        require('javascript' in response.headers.get_content_type(), "Ingress check failed: 'javascript' in response.headers.get_content_type()")
    with get('/api/platforms/lichess/config') as response:
        require(response.status == 200, 'Ingress check failed: response.status == 200')
        require(response.headers['Cache-Control'] == 'no-store', "Ingress check failed: response.headers['Cache-Control'] == 'no-store'")
        require(response.headers['Referrer-Policy'] == 'no-referrer', "Ingress check failed: response.headers['Referrer-Policy'] == 'no-referrer'")
        require(json.load(response)['configured'] == bool(values.get('LICHESS_CLIENT_ID')), "Ingress check failed: json.load(response)['configured'] == bool(values.get('LICHESS_CLIENT_ID'))")
    if values.get('LICHESS_CLIENT_ID'):
        with get('/api/platforms/lichess/oauth/start', {'X-Forwarded-Host': 'attacker.example', 'X-Real-IP': '1.2.3.4'}) as response:
            require(response.status in (302, 307), f'OAuth start returned {response.status}')
            location = urllib.parse.urlsplit(response.headers['Location'])
            require(location.scheme == 'https' and location.netloc == 'lichess.org', "Ingress check failed: location.scheme == 'https' and location.netloc == 'lichess.org'")
            query = urllib.parse.parse_qs(location.query)
            require(query['redirect_uri'] == [f"https://{values['DOMAIN']}/api/platforms/lichess/oauth/callback"], 'Ingress check failed: query[\'redirect_uri\'] == [f"https://{values[\'DOMAIN\']}/api/platforms/lichess/oauth/callback"]')
            require(query['code_challenge_method'] == ['S256'], "Ingress check failed: query['code_challenge_method'] == ['S256']")
            cookie = response.headers['Set-Cookie'].lower()
            require('httponly' in cookie and 'secure' in cookie and ('samesite=lax' in cookie), "Ingress check failed: 'httponly' in cookie and 'secure' in cookie and ('samesite=lax' in cookie)")


def main():
    from release import config, health, read_state
    values = config()
    current = read_state().get('current')
    if not current:
        raise SystemExit('Deploy a release first.')
    health(values, current['release'], timeout=5)
    verify(values, current)
    print('PASS: local proxy, host isolation, HTTPS redirect, WASM/worker, API headers and configured OAuth start.')
    print('Actual Cloudflare HTTPS, account authorization and physical devices still require external acceptance.')


if __name__ == '__main__':
    main()
