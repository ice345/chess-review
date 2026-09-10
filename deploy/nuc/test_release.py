"""Configuration and recovery regressions; Docker integration is exercised separately."""
import contextlib
import io
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import release

SOURCE = Path(__file__).resolve().parent
A = {'image': 'sha256:aaa', 'release': 'a', 'reference': 'chess:a'}
B = {'image': 'sha256:bbb', 'release': 'b', 'reference': 'chess:b'}


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ['.env.example', 'nginx.conf.template', 'compose.yaml']:
            shutil.copyfile(SOURCE / name, self.root / name)
        for name, value in [('ROOT', self.root), ('STATE', self.root / '.state'), ('ENV_FILE', self.root / '.env')]:
            patcher = patch.object(release, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.call('init')
        path = self.root / '.env'
        path.write_text(path.read_text().replace('DOMAIN=\n', 'DOMAIN=chess.example.org\n'))

    def call(self, *args):
        with patch('sys.argv', ['release.py', *args]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            release.main()

    def state(self, **extra):
        value = {'current': A, 'previous': None, 'DOMAIN': 'chess.example.org', 'PORT': '8080', **extra}
        release.save(release.STATE / 'release.json', value)
        return value

    def test_init_preserves_private_key_and_never_outputs_it(self):
        before = release.ENV_FILE.read_text()
        self.call('init')
        self.assertEqual(release.ENV_FILE.read_text(), before)
        self.assertEqual(release.ENV_FILE.stat().st_mode & 0o777, 0o600)
        self.assertGreaterEqual(len(release.config()['LICHESS_SESSION_SECRET']), 32)

    def test_rejects_shell_values_invalid_domain_and_world_readable_secrets(self):
        original = release.ENV_FILE.read_text()
        for domain in ['https://chess.example.org', 'chess.example.org/path', '$(touch PWNED)', 'x;echo hello', '']:
            release.ENV_FILE.write_text(original.replace('chess.example.org', domain))
            with self.assertRaises(ValueError):
                release.config()
        self.assertFalse((self.root / 'PWNED').exists())
        release.ENV_FILE.write_text(original)
        release.ENV_FILE.chmod(0o644)
        with self.assertRaises(ValueError):
            release.config()

    def test_failed_update_restores_current_and_does_not_promote_failure(self):
        previous = self.state()
        attempts = []
        def start(values, target):
            attempts.append(target)
            if target == B:
                raise RuntimeError('unhealthy')
        with patch.object(release, 'inspect_image', return_value=B), patch.object(release, 'compose'), patch.object(release, 'start', side_effect=start):
            with self.assertRaises(RuntimeError):
                self.call('deploy', 'chess:b')
        self.assertEqual(attempts, [B, A])
        self.assertEqual(release.read_state(), previous)

    def test_success_records_immutable_previous_and_rollback_swaps_versions(self):
        self.state()
        with patch.object(release, 'inspect_image', return_value=B), patch.object(release, 'compose'), patch.object(release, 'start'):
            self.call('deploy', 'chess:b')
            self.assertEqual(release.read_state()['current'], B)
            self.assertEqual(release.read_state()['previous'], A)
            self.call('rollback')
        self.assertEqual(release.read_state()['current'], A)
        self.assertEqual(release.read_state()['previous'], B)

    def test_failed_recovery_keeps_pending_for_operator_retry(self):
        self.state(previous=B)
        with patch.object(release, 'compose'), patch.object(release, 'start', side_effect=RuntimeError('Docker unavailable')):
            with self.assertRaises(RuntimeError):
                self.call('rollback')
        self.assertEqual(release.read_state()['pending'], {'target': B, 'previous': A})

    def test_same_image_reapplies_changed_configuration_and_skips_identical_redeploy(self):
        self.state()
        with patch.object(release, 'inspect_image', return_value=A), patch.object(release, 'compose'), patch.object(release, 'health'), patch.object(release, 'start') as start:
            self.call('deploy', 'chess:a')
            self.assertEqual(start.call_count, 1)
            self.call('deploy', 'chess:a')
            self.assertEqual(start.call_count, 1)
            release.ENV_FILE.write_text(release.ENV_FILE.read_text().replace('LICHESS_CLIENT_ID=\n', 'LICHESS_CLIENT_ID=chess.example.org\n'))
            self.call('deploy', 'chess:a')
            self.assertEqual(start.call_count, 2)
            template = self.root / 'nginx.conf.template'
            template.write_text(template.read_text() + '\n# updated ingress limits\n')
            self.call('deploy', 'chess:a')
            self.assertEqual(start.call_count, 3)

    def test_domain_migration_is_rejected_even_for_the_same_image(self):
        self.state()
        release.ENV_FILE.write_text(release.ENV_FILE.read_text().replace('DOMAIN=chess.example.org', 'DOMAIN=new.example.org'))
        with patch.object(release, 'inspect_image', return_value=A), patch.object(release, 'start') as start:
            with self.assertRaises(ValueError):
                self.call('deploy', 'chess:a')
        start.assert_not_called()

    def test_interrupted_first_deploy_can_be_stopped_without_an_old_version(self):
        release.save(release.STATE / 'release.json', {'pending': {'target': B, 'previous': None}})
        with patch.object(release, 'compose') as compose:
            self.call('rollback')
        self.assertIn('stop', compose.call_args.args)
        self.assertEqual(release.read_state(), {})


if __name__ == '__main__':
    unittest.main()
