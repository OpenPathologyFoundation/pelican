"""Pytest configuration and fixtures."""

import pytest
from unittest.mock import MagicMock, patch
import sys


@pytest.fixture(autouse=True)
def mock_large_image():
    """Mock large_image module for all tests."""
    mock = MagicMock()
    with patch.dict(sys.modules, {'large_image': mock}):
        yield mock


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
