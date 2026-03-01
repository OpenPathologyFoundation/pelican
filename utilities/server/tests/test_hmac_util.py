"""Tests for the HMAC utility module."""

import hashlib
import hmac

from large_image_server.hmac_util import compute_file_hmac, verify_file_hmac


class TestComputeFileHmac:

    def test_known_input(self, tmp_path):
        """Verify HMAC against a known value computed independently."""
        f = tmp_path / 'test.bin'
        content = b'hello world'
        f.write_bytes(content)

        key = 'test-secret'
        expected = hmac.new(key.encode(), content, hashlib.sha256).hexdigest()

        result = compute_file_hmac(f, key)
        assert result == expected

    def test_empty_file(self, tmp_path):
        """HMAC of an empty file should still be a valid hex digest."""
        f = tmp_path / 'empty.bin'
        f.write_bytes(b'')

        result = compute_file_hmac(f, 'key')
        assert len(result) == 64  # SHA-256 hex digest length

    def test_large_file_streaming(self, tmp_path):
        """File larger than chunk size (64KB) is processed correctly."""
        f = tmp_path / 'large.bin'
        # Write 128KB of data (two full chunks)
        content = b'\xab' * 131072
        f.write_bytes(content)

        key = 'streaming-key'
        expected = hmac.new(key.encode(), content, hashlib.sha256).hexdigest()

        result = compute_file_hmac(f, key)
        assert result == expected


class TestVerifyFileHmac:

    def test_success(self, tmp_path):
        """Matching HMAC returns True."""
        f = tmp_path / 'verify.bin'
        content = b'verify this content'
        f.write_bytes(content)

        key = 'verify-key'
        correct_hmac = hmac.new(key.encode(), content, hashlib.sha256).hexdigest()

        assert verify_file_hmac(f, key, correct_hmac) is True

    def test_mismatch(self, tmp_path):
        """Wrong HMAC returns False."""
        f = tmp_path / 'bad.bin'
        f.write_bytes(b'some content')

        assert verify_file_hmac(f, 'key', 'deadbeef' * 8) is False

    def test_different_key_fails(self, tmp_path):
        """Same file, different key -> verification fails."""
        f = tmp_path / 'keytest.bin'
        content = b'key-dependent data'
        f.write_bytes(content)

        hmac_with_key1 = compute_file_hmac(f, 'key1')
        assert verify_file_hmac(f, 'key2', hmac_with_key1) is False
