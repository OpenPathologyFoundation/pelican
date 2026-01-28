"""Pytest configuration and fixtures."""

import pytest
from unittest.mock import MagicMock
import sys

# Mock large_image at import time (before test collection imports large_image_server)
# This is needed because large_image_server imports large_image.exceptions at module level
_mock_large_image = MagicMock()
_mock_large_image.exceptions = MagicMock()
_mock_large_image.exceptions.TileSourceError = Exception
_mock_large_image.exceptions.TileSourceXYZRangeError = Exception
sys.modules['large_image'] = _mock_large_image
sys.modules['large_image.exceptions'] = _mock_large_image.exceptions


@pytest.fixture(autouse=True)
def mock_large_image():
    """Provide the mock large_image module to tests."""
    yield _mock_large_image


@pytest.fixture
def mock_source():
    """Create a mock tile source."""
    source = MagicMock()
    source.metadata = {
        'sizeX': 50000,
        'sizeY': 40000,
        'tileWidth': 256,
        'tileHeight': 256,
        'levels': 10,
        'magnification': 40,
        'mm_x': 0.00025,
        'mm_y': 0.00025,
    }
    source.getMetadata.return_value = source.metadata
    source.getTile.return_value = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
    source.getRegion.return_value = (b'\x89PNG\r\n\x1a\n' + b'\x00' * 100, 'image/png')
    source.getThumbnail.return_value = (b'\x89PNG\r\n\x1a\n' + b'\x00' * 100, 'image/png')
    return source
