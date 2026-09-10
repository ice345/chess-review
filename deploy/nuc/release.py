#!/usr/bin/env python3
"""Single-host releases. Stdlib only; never shell-evaluate .env or print secrets."""
import argparse
import fcntl
import json
import hashlib
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
STATE = ROOT / '.state'
ENV_FILE = ROOT / '.env'


def run(args, *, env=None, capture=False):
    return subprocess.run(args, cwd=ROOT, env=env, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def save(path, data):
    tmp = path.with_suffix('.tmp')
    with tmp.open('w') as output:
        output.write(json.dumps(data, indent=2) + '\n')
        output.flush()
        os.fsync(output.fileno())
    tmp.chmod(0o600)
    tmp.replace(path)
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def read_state():
    path = STATE / 'release.json'
    return json.loads(path.read_text()) if path.exists() else {}


def config():
    values = {}
    allowed = {'DOMAIN', 'PORT', 'LICHESS_CLIENT_ID', 'LICHESS_SESSION_SECRET'}
    for line in ENV_FILE.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if not sep or key not in allowed or key in values:
            raise ValueError('Invalid or duplicate .env key. Use the provided .env.example format.')
        values[key] = value.strip()
    domain = values.get('DOMAIN', '')
    if len(domain) > 253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', domain):
        raise ValueError('Set DOMAIN to your lowercase public hostname, without scheme, port, or path.')
    port = values.get('PORT', '8080')
    if not port.isdigit() or not 1024 <= int(port) <= 65535:
        raise ValueError('PORT must be between 1024 and 65535.')
    if not re.fullmatch(r'[a-zA-Z0-9_.-]{0,253}', values.get('LICHESS_CLIENT_ID', '')):
        raise ValueError('LICHESS_CLIENT_ID must be blank or a simple unique public ID (hostname recommended).')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{32,256}', values.get('LICHESS_SESSION_SECRET', '')):
        raise ValueError('Run init to generate the private session key; preserve it across releases.')
    if ENV_FILE.stat().st_mode & 0o077:
        raise ValueError('Protect configuration first: chmod 600 deploy/nuc/.env')
    values.setdefault("PORT", "8080")
    values.setdefault("LICHESS_CLIENT_ID", "")
    return values


def compose(values, image, *args, capture=False):
    # File is deliberately empty: do not let Compose evaluate the user's .env.
    env = {**os.environ, **values, 'APP_IMAGE': image}
    return run(['docker', 'compose', '--env-file', '/dev/null', '--project-name', 'chess-review',
                '--file', str(ROOT / 'compose.yaml'), *args], env=env, capture=capture)


def health(values, release, timeout=60):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + timeout
    while True:
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{values['PORT']}/api/healthz", headers={'Host': values['DOMAIN']})
            with opener.open(req, timeout=3) as response:
                body = json.load(response)
                if body == {'status': 'ok', 'release': release} and response.headers.get('Cache-Control') == 'no-store':
                    return
        except (OSError, ValueError):
            pass
        if time.monotonic() >= deadline:
            raise RuntimeError('Gateway did not return the expected healthy release. Inspect container logs.')
        time.sleep(1)


def start(values, target):
    compose(values, target['image'], 'up', '-d', '--wait', '--wait-timeout', '90', 'web')
    # Force recreation also refreshes the bind mount after an atomic config write.
    compose(values, target['image'], 'up', '-d', '--force-recreate', 'gateway')
    health(values, target['release'])
    from smoke import verify
    try:
        verify(values, target)
    except (AssertionError, OSError, ValueError) as error:
        raise RuntimeError('Ingress smoke checks failed; the release was not promoted.') from error


def inspect_image(reference, pull):
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_./:@-]*', reference):
        raise ValueError('Invalid image reference.')
    if pull:
        run(['docker', 'pull', reference])
    detail = json.loads(run(['docker', 'image', 'inspect', reference], capture=True))[0]
    if detail['Os'] != 'linux' or detail['Architecture'] != 'amd64':
        raise ValueError('NUC requires a Linux amd64 image. Use build.sh off-device.')
    release = (detail['Config'].get('Labels') or {}).get('org.opencontainers.image.version', '')
    if not release or release == 'unknown':
        raise ValueError('Image needs a unique RELEASE_ID. Use build.sh IMAGE RELEASE_ID.')
    return {'image': detail['Id'], 'release': release, 'reference': reference}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init')
    deploy = sub.add_parser('deploy')
    deploy.add_argument('image')
    deploy.add_argument('--pull', action='store_true', help='Pull from registry; otherwise use a built/loaded local image.')
    for command in ['check', 'status', 'rollback']:
        sub.add_parser(command)
    args = parser.parse_args()
    STATE.mkdir(mode=0o700, exist_ok=True)
    with (STATE / 'lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another release command is running.') from None
        if args.command == 'init':
            if ENV_FILE.exists():
                print('Existing .env preserved. Edit DOMAIN; the session key has not been changed.')
                return
            content = (ROOT / '.env.example').read_text().replace('LICHESS_SESSION_SECRET=\n', f'LICHESS_SESSION_SECRET={secrets.token_urlsafe(48)}\n')
            fd = os.open(ENV_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w') as out:
                out.write(content)
            print('Created private .env. Set DOMAIN and optional LICHESS_CLIENT_ID before deploying.')
            return
        values = config()
        digest = hashlib.sha256(json.dumps(values, sort_keys=True).encode())
        for filename in ['compose.yaml', 'nginx.conf.template']:
            digest.update((ROOT / filename).read_bytes())
        config_hash = digest.hexdigest()
        state = read_state()
        current = state.get('current')
        if args.command in ['check', 'status']:
            if state.get('pending'):
                raise RuntimeError('An interrupted deployment is recorded. Run rollback before proceeding.')
            if not current:
                raise RuntimeError('No successful release recorded yet.')
            if args.command == 'check':
                health(values, current['release'], timeout=5)
                print(f"Healthy release: {current['release']}")
            else:
                print(json.dumps(state, indent=2))
                compose(values, current['image'], 'ps')
            return
        if args.command == 'rollback':
            target = state.get('pending', {}).get('previous') if state.get('pending') else state.get('previous')
            if not target:
                if state.get('pending') and not current:
                    compose(values, state['pending']['target']['image'], 'stop', 'gateway', 'web')
                    save(STATE / 'release.json', {})
                    print('Stopped interrupted first deployment. Ready to retry.')
                    return
                raise RuntimeError('No previous healthy release is available.')
        else:
            if state.get('pending'):
                raise RuntimeError('An interrupted deployment exists. Run rollback first.')
            target = inspect_image(args.image, args.pull)
        if current and any(state.get(key) != values[key] for key in ['DOMAIN', 'PORT']):
            raise ValueError('DOMAIN/PORT changed since deployment. Restore them for image upgrades; migrate hostnames separately.')
        if current and target['image'] == current['image'] and state.get('configHash') == config_hash and not state.get('pending'):
            health(values, current['release'], timeout=5)
            print('This immutable image and configuration are already healthy; no containers changed.')
            return
        nginx = (ROOT / 'nginx.conf.template').read_text().replace('__DOMAIN__', values['DOMAIN'])
        config_file = STATE / 'nginx.conf'
        config_file.write_text(nginx)
        config_file.chmod(0o644)  # Readable by the unprivileged gateway container; contains no secrets.
        compose(values, target['image'], 'run', '--rm', '--no-deps', 'gateway', '-t')
        save(STATE / 'release.json', {**state, 'pending': {'target': target, 'previous': current}})
        try:
            start(values, target)
        except (Exception, KeyboardInterrupt):
            print('Release failed; restoring the last healthy image.', file=sys.stderr)
            if current:
                start(values, current)
                save(STATE / 'release.json', {key: value for key, value in state.items() if key != 'pending'})
            else:
                compose(values, target['image'], 'stop', 'gateway', 'web')
                save(STATE / 'release.json', {})
            raise
        save(STATE / 'release.json', {'current': target, 'previous': current, 'DOMAIN': values['DOMAIN'], 'PORT': values['PORT'], 'configHash': config_hash})
        print(f"Healthy release: {target['release']}. Cloudflare origin: http://127.0.0.1:{values['PORT']}")


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Release error: {error}', file=sys.stderr)
        sys.exit(1)
