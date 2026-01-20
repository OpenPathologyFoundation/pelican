"""Tests for the SourceManager class."""

import pytest
from unittest.mock import Mock, patch, MagicMock
import time

from large_image_server.source_manager import SourceManager


class TestSourceManager:
    """Test cases for SourceManager."""

    def setup_method(self):
        """Set up test fixtures."""
        self.manager = SourceManager(
            cache_size=10,
            cache_ttl=60.0,
        )

    def teardown_method(self):
        """Clean up after tests."""
        self.manager.clear_cache()

    def test_init(self):
        """Test SourceManager initialization."""
        assert self.manager.cache_size == 10
        assert self.manager.cache_ttl == 60.0
        assert len(self.manager._cache) == 0

    def test_get_source_id(self):
        """Test source ID generation."""
        source_id = self.manager._get_source_id("/path/to/slide.svs")
        assert isinstance(source_id, str)
        assert len(source_id) > 0

        # Same path should give same ID
        source_id2 = self.manager._get_source_id("/path/to/slide.svs")
        assert source_id == source_id2

        # Different path should give different ID
        source_id3 = self.manager._get_source_id("/path/to/other.svs")
        assert source_id != source_id3

    @patch('large_image_server.source_manager.large_image')
    def test_get_source_caches(self, mock_large_image):
        """Test that sources are cached."""
        mock_source = MagicMock()
        mock_large_image.open.return_value = mock_source

        # First call should open the source
        source1 = self.manager.get_source("/test/slide.svs")
        assert mock_large_image.open.call_count == 1

        # Second call should use cache
        source2 = self.manager.get_source("/test/slide.svs")
        assert mock_large_image.open.call_count == 1
        assert source1 is source2

    @patch('large_image_server.source_manager.large_image')
    def test_cache_eviction(self, mock_large_image):
        """Test LRU cache eviction."""
        mock_sources = [MagicMock() for _ in range(15)]
        mock_large_image.open.side_effect = mock_sources

        # Create manager with small cache
        manager = SourceManager(cache_size=5, cache_ttl=60.0)

        # Add more items than cache size
        for i in range(10):
            manager.get_source(f"/test/slide_{i}.svs")

        # Cache should not exceed max size
        assert len(manager._cache) <= 5

    @patch('large_image_server.source_manager.large_image')
    def test_cache_expiration(self, mock_large_image):
        """Test cache TTL expiration."""
        mock_source = MagicMock()
        mock_large_image.open.return_value = mock_source

        # Create manager with very short TTL
        manager = SourceManager(cache_size=10, cache_ttl=0.1)

        # Get source
        manager.get_source("/test/slide.svs")
        assert mock_large_image.open.call_count == 1

        # Wait for expiration
        time.sleep(0.2)

        # Should open again due to expiration
        manager.get_source("/test/slide.svs")
        assert mock_large_image.open.call_count == 2

    def test_clear_cache(self):
        """Test cache clearing."""
        # Add some mock data to cache
        self.manager._cache["test1"] = (MagicMock(), time.time())
        self.manager._cache["test2"] = (MagicMock(), time.time())

        assert len(self.manager._cache) == 2

        self.manager.clear_cache()

        assert len(self.manager._cache) == 0

    @patch('large_image_server.source_manager.large_image')
    def test_close_source(self, mock_large_image):
        """Test closing a specific source."""
        mock_source = MagicMock()
        mock_large_image.open.return_value = mock_source

        self.manager.get_source("/test/slide.svs")
        source_id = self.manager._get_source_id("/test/slide.svs")

        assert source_id in self.manager._cache

        self.manager.close_source(source_id)

        assert source_id not in self.manager._cache

    def test_get_cache_stats(self):
        """Test cache statistics."""
        # Add some mock data
        self.manager._cache["test1"] = (MagicMock(), time.time())
        self.manager._cache["test2"] = (MagicMock(), time.time() - 1000)

        stats = self.manager.get_cache_stats()

        assert stats["size"] == 2
        assert stats["max_size"] == 10
        assert "sources" in stats


class TestSourceManagerConcurrency:
    """Test concurrent access to SourceManager."""

    @patch('large_image_server.source_manager.large_image')
    def test_thread_safety(self, mock_large_image):
        """Test that cache operations are thread-safe."""
        import threading

        mock_large_image.open.return_value = MagicMock()
        manager = SourceManager(cache_size=100, cache_ttl=60.0)

        errors = []

        def worker(slide_id):
            try:
                for _ in range(10):
                    manager.get_source(f"/test/slide_{slide_id}.svs")
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]

        for t in threads:
            t.start()

        for t in threads:
            t.join()

        assert len(errors) == 0, f"Thread safety errors: {errors}"
