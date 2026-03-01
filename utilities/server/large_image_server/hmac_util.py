"""HMAC-SHA256 file integrity utilities (SDS-STR-001 §5.3).

Provides streaming HMAC computation for large slide files and a
constant-time verification helper. The secret key is never stored
in the database or version control — it is supplied via environment
variable or CLI flag.
"""

import hashlib
import hmac
from pathlib import Path

_CHUNK_SIZE = 65536  # 64 KB


def compute_file_hmac(file_path: Path, key: str) -> str:
    """Compute HMAC-SHA256 of a file, reading in 64 KB chunks.

    Args:
        file_path: Path to the file.
        key: Secret key string.

    Returns:
        Hex-encoded HMAC digest.
    """
    mac = hmac.new(key.encode(), digestmod=hashlib.sha256)
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(_CHUNK_SIZE)
            if not chunk:
                break
            mac.update(chunk)
    return mac.hexdigest()


def verify_file_hmac(file_path: Path, key: str, expected_hmac: str) -> bool:
    """Verify a file's HMAC against an expected value.

    Uses ``hmac.compare_digest`` for constant-time comparison.

    Args:
        file_path: Path to the file.
        key: Secret key string.
        expected_hmac: Hex-encoded HMAC to compare against.

    Returns:
        True if the HMAC matches, False otherwise.
    """
    actual = compute_file_hmac(file_path, key)
    return hmac.compare_digest(actual, expected_hmac)
