"""Pytest configuration and fixtures for large_image_server tests."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Mock large_image at import time (before any large_image_server imports).
# The server uses large_image.open() and large_image.exceptions at module
# level, so we must inject the mock before Python collects the test modules.
# ---------------------------------------------------------------------------
_mock_large_image = MagicMock()
_mock_large_image.exceptions = MagicMock()
_mock_large_image.exceptions.TileSourceError = type(
    'TileSourceError', (Exception,), {},
)
_mock_large_image.exceptions.TileSourceXYZRangeError = type(
    'TileSourceXYZRangeError', (Exception,), {},
)
sys.modules['large_image'] = _mock_large_image
sys.modules['large_image.exceptions'] = _mock_large_image.exceptions


@pytest.fixture(autouse=True)
def _reset_server_globals():
    """Reset global singletons between tests.

    ServerSettings and SourceManager are cached in module-level globals.
    Each test should start from a clean state.
    """
    import large_image_server.config as _cfg
    import large_image_server.source_manager as _sm

    _cfg._settings = None
    _sm._source_manager = None
    yield
    _cfg._settings = None
    _sm._source_manager = None


@pytest.fixture()
def mock_source():
    """A realistic mock tile source with metadata and associated images."""
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
    source.getRegion.return_value = (
        b'\x89PNG\r\n\x1a\n' + b'\x00' * 100,
        'image/png',
    )
    source.getThumbnail.return_value = (
        b'\x89PNG\r\n\x1a\n' + b'\x00' * 100,
        'image/png',
    )
    source.getAssociatedImagesList.return_value = ['label', 'macro', 'thumbnail']
    source.getAssociatedImage.return_value = (b'\xff\xd8\xff' + b'\x00' * 50, 'image/jpeg')
    return source


@pytest.fixture()
def tmp_image_dir(tmp_path):
    """Create a temporary image directory with a fake SVS file."""
    img_dir = tmp_path / 'images'
    img_dir.mkdir()
    # Create minimal dummy files (won't be opened — large_image is mocked)
    (img_dir / 'test-slide.svs').write_bytes(b'\x00' * 16)
    return img_dir


@pytest.fixture()
def app(tmp_image_dir, mock_source):
    """Create a FastAPI test app with dependency overrides."""
    from large_image_server import create_app
    from large_image_server.source_manager import SourceManager, get_source_manager

    application = create_app(image_dir=str(tmp_image_dir))

    # Build a mock SourceManager that returns mock_source for any image
    mock_sm = MagicMock(spec=SourceManager)
    mock_sm.get_source.return_value = mock_source
    mock_sm.get_source_path.return_value = tmp_image_dir / 'test-slide.svs'
    mock_sm.list_images.return_value = ['test-slide.svs']
    mock_sm.cache_info.return_value = {
        'cached_sources': 1,
        'max_sources': 10,
        'sources': [str(tmp_image_dir / 'test-slide.svs')],
    }

    application.dependency_overrides[get_source_manager] = lambda: mock_sm
    yield application
    application.dependency_overrides.clear()


@pytest.fixture()
def client(app):
    """FastAPI test client."""
    from fastapi.testclient import TestClient
    return TestClient(app)
