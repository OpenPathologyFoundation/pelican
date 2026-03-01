"""Tests for the SourceManager class."""

import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from large_image_server.source_manager import SourceManager


class TestSourceManagerInit:
    """Test SourceManager initialization."""

    def test_defaults_from_settings(self, tmp_image_dir):
        from large_image_server.config import configure_settings
        configure_settings(image_dir=tmp_image_dir, source_cache_size=5)

        sm = SourceManager()
        assert sm.image_dir == tmp_image_dir
        assert sm._max_sources == 5

    def test_explicit_args(self, tmp_image_dir):
        sm = SourceManager(image_dir=tmp_image_dir, max_sources=20)
        assert sm.image_dir == tmp_image_dir
        assert sm._max_sources == 20


class TestResolveImagePath:
    """Test _resolve_image_path() — filesystem resolution."""

    def test_direct_path(self, tmp_image_dir):
        sm = SourceManager(image_dir=tmp_image_dir)
        resolved = sm._resolve_image_path('test-slide.svs')
        assert resolved == (tmp_image_dir / 'test-slide.svs').resolve()

    def test_url_encoded_slash(self, tmp_image_dir):
        subdir = tmp_image_dir / 'sub'
        subdir.mkdir()
        (subdir / 'slide.svs').write_bytes(b'\x00')

        sm = SourceManager(image_dir=tmp_image_dir)
        resolved = sm._resolve_image_path('sub%2Fslide.svs')
        assert resolved == (subdir / 'slide.svs').resolve()

    def test_extension_matching(self, tmp_image_dir):
        sm = SourceManager(image_dir=tmp_image_dir)
        # 'test-slide' without extension should match 'test-slide.svs'
        resolved = sm._resolve_image_path('test-slide')
        assert resolved == (tmp_image_dir / 'test-slide.svs').resolve()

    def test_not_found(self, tmp_image_dir):
        sm = SourceManager(image_dir=tmp_image_dir)
        with pytest.raises(FileNotFoundError, match='Image not found'):
            sm._resolve_image_path('nonexistent.svs')

    def test_absolute_path_within_dir(self, tmp_image_dir):
        abs_path = str(tmp_image_dir / 'test-slide.svs')
        sm = SourceManager(image_dir=tmp_image_dir)
        resolved = sm._resolve_image_path(abs_path)
        assert resolved == (tmp_image_dir / 'test-slide.svs').resolve()

    def test_nonexistent_absolute_path_rejected(self, tmp_path):
        img_dir = tmp_path / 'images'
        img_dir.mkdir()

        sm = SourceManager(image_dir=img_dir)
        with pytest.raises(FileNotFoundError):
            sm._resolve_image_path('/nonexistent/path/slide.svs')


class TestResolveImagePathWithDB:
    """Test _resolve_image_path() — database resolution path."""

    def test_db_resolution_by_slide_id(self, tmp_image_dir):
        """When DB is configured, slide_id lookup resolves the file."""
        # Set up a year-partitioned structure
        slide_dir = tmp_image_dir / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True)
        slide_file = slide_dir / 'S26-0001_A1_S1.svs'
        slide_file.write_bytes(b'\x00')

        from large_image_server.config import configure_settings
        configure_settings(
            image_dir=tmp_image_dir,
            storage_db_url='postgresql://fake:fake@localhost/fake',
            storage_clinical_root=tmp_image_dir,
        )

        sm = SourceManager(image_dir=tmp_image_dir)

        with patch('large_image_server.db.resolve_slide_path') as mock_resolve:
            mock_resolve.return_value = {
                'slide_id': 'S26-0001_A1_S1',
                'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
            }
            resolved = sm._resolve_image_path('S26-0001_A1_S1')
            assert resolved == slide_file.resolve()
            mock_resolve.assert_called_once_with('S26-0001_A1_S1')

    def test_db_resolution_with_path_id(self, tmp_image_dir):
        """Path-style image_id like 'S26-0001/S26-0001_A1_S1.svs' is resolved via DB."""
        slide_dir = tmp_image_dir / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True)
        slide_file = slide_dir / 'S26-0001_A1_S1.svs'
        slide_file.write_bytes(b'\x00')

        from large_image_server.config import configure_settings
        configure_settings(
            image_dir=tmp_image_dir,
            storage_db_url='postgresql://fake:fake@localhost/fake',
            storage_clinical_root=tmp_image_dir,
        )

        sm = SourceManager(image_dir=tmp_image_dir)

        with patch('large_image_server.db.resolve_slide_path') as mock_resolve:
            mock_resolve.return_value = {
                'slide_id': 'S26-0001_A1_S1',
                'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
            }
            resolved = sm._resolve_image_path('S26-0001/S26-0001_A1_S1.svs')
            assert resolved == slide_file.resolve()

    def test_db_miss_falls_back_to_filesystem(self, tmp_image_dir):
        """When DB returns None, fall back to filesystem."""
        from large_image_server.config import configure_settings
        configure_settings(
            image_dir=tmp_image_dir,
            storage_db_url='postgresql://fake:fake@localhost/fake',
        )

        sm = SourceManager(image_dir=tmp_image_dir)

        with patch('large_image_server.db.resolve_slide_path') as mock_resolve:
            mock_resolve.return_value = None
            # test-slide.svs exists in tmp_image_dir from fixture
            resolved = sm._resolve_image_path('test-slide.svs')
            assert resolved == (tmp_image_dir / 'test-slide.svs').resolve()

    def test_no_db_configured_skips_db(self, tmp_image_dir):
        """Without storage_db_url, DB resolution is skipped entirely."""
        from large_image_server.config import configure_settings
        configure_settings(image_dir=tmp_image_dir)

        sm = SourceManager(image_dir=tmp_image_dir)

        with patch('large_image_server.db.resolve_slide_path') as mock_resolve:
            resolved = sm._resolve_image_path('test-slide.svs')
            assert resolved == (tmp_image_dir / 'test-slide.svs').resolve()
            mock_resolve.assert_not_called()


class TestSourceCache:
    """Test LRU caching behavior."""

    @patch('large_image_server.source_manager.large_image')
    def test_source_is_cached(self, mock_li, tmp_image_dir):
        mock_source = MagicMock()
        mock_li.open.return_value = mock_source

        sm = SourceManager(image_dir=tmp_image_dir)
        s1 = sm.get_source('test-slide.svs')
        s2 = sm.get_source('test-slide.svs')

        assert s1 is s2
        assert mock_li.open.call_count == 1

    @patch('large_image_server.source_manager.large_image')
    def test_lru_eviction(self, mock_li, tmp_image_dir):
        mock_li.open.side_effect = [MagicMock() for _ in range(5)]

        # Create 5 fake slides
        for i in range(5):
            (tmp_image_dir / f'slide{i}.svs').write_bytes(b'\x00')

        sm = SourceManager(image_dir=tmp_image_dir, max_sources=3)
        for i in range(5):
            sm.get_source(f'slide{i}.svs')

        info = sm.cache_info()
        assert info['cached_sources'] <= 3

    @patch('large_image_server.source_manager.large_image')
    def test_clear_cache(self, mock_li, tmp_image_dir):
        mock_li.open.return_value = MagicMock()

        sm = SourceManager(image_dir=tmp_image_dir)
        sm.get_source('test-slide.svs')
        assert sm.cache_info()['cached_sources'] == 1

        count = sm.clear_cache()
        assert count == 1
        assert sm.cache_info()['cached_sources'] == 0

    @patch('large_image_server.source_manager.large_image')
    def test_close_source(self, mock_li, tmp_image_dir):
        mock_li.open.return_value = MagicMock()

        sm = SourceManager(image_dir=tmp_image_dir)
        sm.get_source('test-slide.svs')
        assert sm.cache_info()['cached_sources'] == 1

        closed = sm.close_source('test-slide.svs')
        assert closed is True
        assert sm.cache_info()['cached_sources'] == 0


class TestSourceManagerConcurrency:
    """Test thread safety."""

    @patch('large_image_server.source_manager.large_image')
    def test_thread_safety(self, mock_li, tmp_image_dir):
        mock_li.open.return_value = MagicMock()

        for i in range(10):
            (tmp_image_dir / f'slide{i}.svs').write_bytes(b'\x00')

        sm = SourceManager(image_dir=tmp_image_dir, max_sources=50)
        errors = []

        def worker(slide_idx):
            try:
                for _ in range(10):
                    sm.get_source(f'slide{slide_idx}.svs')
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f'Thread safety errors: {errors}'


class TestListImages:
    """Test list_images()."""

    def test_lists_allowed_extensions(self, tmp_image_dir):
        (tmp_image_dir / 'a.svs').write_bytes(b'\x00')
        (tmp_image_dir / 'b.tiff').write_bytes(b'\x00')
        (tmp_image_dir / 'c.txt').write_bytes(b'\x00')  # not allowed

        sm = SourceManager(image_dir=tmp_image_dir)
        images = sm.list_images()
        assert 'a.svs' in images
        assert 'b.tiff' in images
        assert 'c.txt' not in images

    def test_lists_nested(self, tmp_image_dir):
        sub = tmp_image_dir / 'case1'
        sub.mkdir()
        (sub / 'slide.svs').write_bytes(b'\x00')

        sm = SourceManager(image_dir=tmp_image_dir)
        images = sm.list_images()
        assert 'case1/slide.svs' in images
