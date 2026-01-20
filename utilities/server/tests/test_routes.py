"""Tests for the FastAPI routes."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

# We need to mock large_image before importing the app
with patch.dict('sys.modules', {'large_image': MagicMock()}):
    from large_image_server import create_app


class TestMetadataRoutes:
    """Test cases for metadata routes."""

    def setup_method(self):
        """Set up test client."""
        self.app = create_app()
        self.client = TestClient(self.app)

    @patch('large_image_server.routes.metadata.source_manager')
    def test_get_metadata(self, mock_manager):
        """Test getting slide metadata."""
        mock_source = MagicMock()
        mock_source.metadata = {
            'sizeX': 50000,
            'sizeY': 40000,
            'tileWidth': 256,
            'tileHeight': 256,
            'levels': 10,
            'magnification': 40,
        }
        mock_source.getMetadata.return_value = mock_source.metadata
        mock_manager.get_source.return_value = mock_source

        response = self.client.get("/metadata/test-slide")

        assert response.status_code == 200
        data = response.json()
        assert data['sizeX'] == 50000
        assert data['sizeY'] == 40000

    @patch('large_image_server.routes.metadata.source_manager')
    def test_get_metadata_not_found(self, mock_manager):
        """Test metadata for non-existent slide."""
        mock_manager.get_source.side_effect = FileNotFoundError("Slide not found")

        response = self.client.get("/metadata/missing-slide")

        assert response.status_code == 404


class TestTileRoutes:
    """Test cases for tile routes."""

    def setup_method(self):
        """Set up test client."""
        self.app = create_app()
        self.client = TestClient(self.app)

    @patch('large_image_server.routes.tiles.source_manager')
    def test_get_tile(self, mock_manager):
        """Test getting a tile."""
        mock_source = MagicMock()
        mock_source.getTile.return_value = b'\x89PNG\r\n\x1a\n'  # PNG header
        mock_manager.get_source.return_value = mock_source

        response = self.client.get("/tile/test-slide/0/0/0")

        assert response.status_code == 200
        assert response.headers['content-type'] in ['image/png', 'image/jpeg']

    @patch('large_image_server.routes.tiles.source_manager')
    def test_get_tile_with_format(self, mock_manager):
        """Test getting a tile with specific format."""
        mock_source = MagicMock()
        mock_source.getTile.return_value = b'\xff\xd8\xff'  # JPEG header
        mock_manager.get_source.return_value = mock_source

        response = self.client.get("/tile/test-slide/0/0/0?format=jpeg")

        assert response.status_code == 200

    @patch('large_image_server.routes.tiles.source_manager')
    def test_get_xyz_tile(self, mock_manager):
        """Test XYZ tile endpoint."""
        mock_source = MagicMock()
        mock_source.getTile.return_value = b'\x89PNG'
        mock_manager.get_source.return_value = mock_source

        response = self.client.get("/xyz/test-slide/5/10/20.png")

        assert response.status_code == 200


class TestDeepZoomRoutes:
    """Test cases for DeepZoom routes."""

    def setup_method(self):
        """Set up test client."""
        self.app = create_app()
        self.client = TestClient(self.app)

    @patch('large_image_server.routes.deepzoom.source_manager')
    def test_get_dzi_descriptor(self, mock_manager):
        """Test getting DZI descriptor."""
        mock_source = MagicMock()
        mock_source.metadata = {
            'sizeX': 50000,
            'sizeY': 40000,
            'tileWidth': 256,
            'tileHeight': 256,
        }
        mock_source.getMetadata.return_value = mock_source.metadata
        mock_manager.get_source.return_value = mock_source

        response = self.client.get("/deepzoom/test-slide.dzi")

        assert response.status_code == 200
        assert 'xml' in response.headers['content-type'].lower()
        assert b'<?xml' in response.content
        assert b'Image' in response.content

    @patch('large_image_server.routes.deepzoom.source_manager')
    def test_get_dzi_tile(self, mock_manager):
        """Test getting DZI tile."""
        mock_source = MagicMock()
        mock_source.metadata = {
            'sizeX': 50000,
            'sizeY': 40000,
            'tileWidth': 256,
            'tileHeight': 256,
            'levels': 10,
        }
        mock_source.getMetadata.return_value = mock_source.metadata
        mock_source.getTile.return_value = b'\x89PNG'
        mock_manager.get_source.return_value = mock_source

        response = self.client.get("/deepzoom/test-slide_files/10/0_0.jpeg")

        assert response.status_code == 200


class TestRegionRoutes:
    """Test cases for region routes."""

    def setup_method(self):
        """Set up test client."""
        self.app = create_app()
        self.client = TestClient(self.app)

    @patch('large_image_server.routes.regions.source_manager')
    def test_get_region(self, mock_manager):
        """Test getting a region."""
        mock_source = MagicMock()
        mock_source.getRegion.return_value = (b'\x89PNG', 'image/png')
        mock_manager.get_source.return_value = mock_source

        response = self.client.get(
            "/region/test-slide?left=0&top=0&right=1000&bottom=1000"
        )

        assert response.status_code == 200

    @patch('large_image_server.routes.regions.source_manager')
    def test_get_thumbnail(self, mock_manager):
        """Test getting a thumbnail."""
        mock_source = MagicMock()
        mock_source.getThumbnail.return_value = (b'\x89PNG', 'image/png')
        mock_manager.get_source.return_value = mock_source

        response = self.client.get("/thumbnail/test-slide?width=256&height=256")

        assert response.status_code == 200


class TestHealthCheck:
    """Test health check endpoint."""

    def setup_method(self):
        """Set up test client."""
        self.app = create_app()
        self.client = TestClient(self.app)

    def test_health_check(self):
        """Test health endpoint."""
        response = self.client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'


class TestCORS:
    """Test CORS configuration."""

    def setup_method(self):
        """Set up test client."""
        self.app = create_app()
        self.client = TestClient(self.app)

    def test_cors_headers(self):
        """Test CORS headers are present."""
        response = self.client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )

        # CORS preflight should be handled
        assert response.status_code in [200, 204]
