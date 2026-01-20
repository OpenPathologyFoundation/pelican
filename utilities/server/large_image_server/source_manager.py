"""Tile source management with caching."""

import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

import large_image
from large_image.exceptions import TileSourceError

from .config import get_settings


class SourceManager:
    """Manages tile sources with LRU caching.

    This class maintains a cache of open tile sources to avoid the overhead
    of repeatedly opening and closing large image files. Sources are evicted
    using an LRU (Least Recently Used) policy when the cache reaches its
    maximum size.
    """

    def __init__(self, image_dir: Path | None = None, max_sources: int | None = None):
        """Initialize the source manager.

        Args:
            image_dir: Directory containing images. If None, uses settings.
            max_sources: Maximum number of sources to cache. If None, uses settings.
        """
        settings = get_settings()
        self._image_dir = image_dir or settings.image_dir
        self._max_sources = max_sources or settings.source_cache_size
        self._sources: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._lock = threading.RLock()
        self._allowed_extensions = settings.allowed_extensions

    @property
    def image_dir(self) -> Path:
        """Get the image directory."""
        return self._image_dir

    @image_dir.setter
    def image_dir(self, value: Path) -> None:
        """Set the image directory and clear the cache."""
        with self._lock:
            self._image_dir = value
            self._sources.clear()

    def _resolve_image_path(self, image_id: str) -> Path:
        """Resolve an image ID to a file path.

        Args:
            image_id: Image identifier (filename or relative path).

        Returns:
            Absolute path to the image file.

        Raises:
            FileNotFoundError: If the image file doesn't exist.
            ValueError: If the image extension is not allowed.
        """
        # Normalize the image ID (handle URL encoding, etc.)
        image_id = image_id.replace('%2F', '/').replace('%5C', '\\')

        # Try direct path first
        path = self._image_dir / image_id
        if path.exists() and path.is_file():
            return path.resolve()

        # Try without extension matching
        for ext in self._allowed_extensions:
            candidate = self._image_dir / f'{image_id}{ext}'
            if candidate.exists() and candidate.is_file():
                return candidate.resolve()

        # Try as absolute path if it exists
        abs_path = Path(image_id)
        if abs_path.is_absolute() and abs_path.exists():
            # Security check: ensure it's within allowed directory
            try:
                abs_path.resolve().relative_to(self._image_dir.resolve())
                return abs_path.resolve()
            except ValueError:
                pass

        raise FileNotFoundError(f'Image not found: {image_id}')

    def _validate_extension(self, path: Path) -> None:
        """Validate that the file has an allowed extension.

        Args:
            path: Path to the image file.

        Raises:
            ValueError: If the extension is not allowed.
        """
        suffixes = ''.join(path.suffixes).lower()
        if not any(suffixes.endswith(ext.lower()) for ext in self._allowed_extensions):
            raise ValueError(f'File extension not allowed: {suffixes}')

    def get_source(
        self,
        image_id: str,
        style: dict | str | None = None,
        encoding: str | None = None,
        **kwargs,
    ) -> Any:
        """Get a tile source for the given image.

        Args:
            image_id: Image identifier.
            style: Optional style configuration.
            encoding: Optional encoding (JPEG, PNG, TIFF).
            **kwargs: Additional arguments passed to large_image.open().

        Returns:
            TileSource instance.

        Raises:
            FileNotFoundError: If the image doesn't exist.
            TileSourceError: If the image can't be opened.
        """
        settings = get_settings()
        path = self._resolve_image_path(image_id)
        self._validate_extension(path)

        # Build cache key including style
        cache_key = str(path)
        if style:
            # Style sources can't be cached the same way
            cache_key = None

        with self._lock:
            # Check cache (only for non-styled sources)
            if cache_key and cache_key in self._sources:
                source, _ = self._sources[cache_key]
                # Move to end (most recently used)
                self._sources.move_to_end(cache_key)
                self._sources[cache_key] = (source, time.time())
                return source

            # Open new source
            open_kwargs = {
                'encoding': encoding or settings.default_encoding,
                'jpegQuality': settings.jpeg_quality,
                'jpegSubsampling': settings.jpeg_subsampling,
            }
            if style:
                open_kwargs['style'] = style
                open_kwargs['noCache'] = True

            open_kwargs.update(kwargs)

            try:
                source = large_image.open(str(path), **open_kwargs)
            except Exception as e:
                raise TileSourceError(f'Failed to open image: {e}') from e

            # Cache non-styled sources
            if cache_key:
                # Evict oldest if at capacity
                while len(self._sources) >= self._max_sources:
                    self._sources.popitem(last=False)

                self._sources[cache_key] = (source, time.time())

            return source

    def get_source_path(self, image_id: str) -> Path:
        """Get the resolved path for an image ID.

        Args:
            image_id: Image identifier.

        Returns:
            Resolved path to the image file.
        """
        return self._resolve_image_path(image_id)

    def list_images(self) -> list[str]:
        """List all available images in the image directory.

        Returns:
            List of image identifiers.
        """
        images = []
        for ext in self._allowed_extensions:
            pattern = f'**/*{ext}'
            for path in self._image_dir.glob(pattern):
                if path.is_file():
                    try:
                        rel_path = path.relative_to(self._image_dir)
                        images.append(str(rel_path))
                    except ValueError:
                        pass
        return sorted(set(images))

    def close_source(self, image_id: str) -> bool:
        """Close and remove a source from the cache.

        Args:
            image_id: Image identifier.

        Returns:
            True if the source was found and closed, False otherwise.
        """
        try:
            path = self._resolve_image_path(image_id)
            cache_key = str(path)
        except FileNotFoundError:
            return False

        with self._lock:
            if cache_key in self._sources:
                del self._sources[cache_key]
                return True
        return False

    def clear_cache(self) -> int:
        """Clear all cached sources.

        Returns:
            Number of sources that were cached.
        """
        with self._lock:
            count = len(self._sources)
            self._sources.clear()
            return count

    def cache_info(self) -> dict[str, Any]:
        """Get information about the source cache.

        Returns:
            Dictionary with cache statistics.
        """
        with self._lock:
            return {
                'cached_sources': len(self._sources),
                'max_sources': self._max_sources,
                'sources': list(self._sources.keys()),
            }


# Global source manager instance
_source_manager: SourceManager | None = None


def get_source_manager() -> SourceManager:
    """Get the global source manager instance."""
    global _source_manager
    if _source_manager is None:
        _source_manager = SourceManager()
    return _source_manager


def configure_source_manager(**kwargs) -> SourceManager:
    """Configure and return a new source manager instance."""
    global _source_manager
    _source_manager = SourceManager(**kwargs)
    return _source_manager
