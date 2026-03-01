"""Tests for core FastAPI routes (metadata, tiles, deepzoom, regions).

All routes use FastAPI Depends(get_source_manager). The ``app`` and ``client``
fixtures in conftest.py override that dependency with a mock SourceManager, so
no real large_image or image files are needed.
"""

import pytest


class TestHealthCheck:
    """Test health check endpoint."""

    def test_health_check(self, client):
        response = client.get('/health')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'


class TestCORS:
    """Test CORS configuration."""

    def test_cors_preflight(self, client):
        response = client.options(
            '/health',
            headers={
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'GET',
            },
        )
        assert response.status_code in [200, 204]


class TestMetadataRoutes:
    """Test metadata endpoints."""

    def test_get_metadata(self, client):
        response = client.get('/metadata/test-slide.svs')
        assert response.status_code == 200
        data = response.json()
        assert data['sizeX'] == 50000
        assert data['sizeY'] == 40000
        assert data['levels'] == 10

    def test_get_metadata_not_found(self, app, client):
        """Non-existent slide returns 404."""
        from large_image_server.source_manager import get_source_manager

        mock_sm = app.dependency_overrides[get_source_manager]()
        mock_sm.get_source.side_effect = FileNotFoundError('not found')

        response = client.get('/metadata/missing.svs')
        assert response.status_code == 404

        # Restore
        mock_sm.get_source.side_effect = None


class TestDeepZoomRoutes:
    """Test DeepZoom / DZI endpoints."""

    def test_get_dzi_descriptor(self, client):
        response = client.get('/deepzoom/test-slide.svs.dzi')
        assert response.status_code == 200
        assert 'xml' in response.headers['content-type'].lower()
        assert b'<?xml' in response.content
        assert b'Image' in response.content

    def test_get_dzi_tile(self, client):
        response = client.get('/deepzoom/test-slide.svs_files/10/0_0.jpeg')
        assert response.status_code == 200


class TestTileRoutes:
    """Test XYZ tile endpoints."""

    def test_get_tile_png(self, client):
        response = client.get('/tiles/test-slide.svs/0/0/0.png')
        assert response.status_code == 200

    def test_get_tile_jpeg(self, client):
        response = client.get('/tiles/test-slide.svs/0/0/0.jpeg')
        assert response.status_code == 200


class TestRegionRoutes:
    """Test region and thumbnail endpoints."""

    def test_get_region(self, client):
        response = client.get(
            '/region/test-slide.svs?left=0&top=0&right=1000&bottom=1000',
        )
        assert response.status_code == 200

    def test_get_thumbnail(self, client):
        response = client.get('/thumbnail/test-slide.svs?width=256&height=256')
        assert response.status_code == 200


class TestCacheEndpoints:
    """Test cache management endpoints."""

    def test_get_cache_info(self, client):
        response = client.get('/cache')
        assert response.status_code == 200
        data = response.json()
        assert 'cached_sources' in data

    def test_clear_cache(self, client):
        response = client.delete('/cache')
        assert response.status_code == 200


class TestImageListing:
    """Test image listing endpoint."""

    def test_list_images(self, client):
        response = client.get('/images')
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
