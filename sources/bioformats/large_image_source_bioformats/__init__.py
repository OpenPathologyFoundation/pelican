#############################################################################
#  Copyright Kitware Inc.
#
#  Licensed under the Apache License, Version 2.0 ( the "License" );
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#############################################################################

"""
Bio-Formats tile source using jpy for Python-Java interop.

This module provides access to Bio-Formats supported image formats via
the jpy library, a lightweight bidirectional Python-Java bridge.

Requirements:
- Java JDK/JRE 11+ (set JAVA_HOME or ensure java is in PATH)
- Bio-Formats JAR file (downloaded automatically if not present)
"""

import atexit
import contextlib
import importlib.metadata
import logging
import math
import os
import pathlib
import re
import threading
import urllib.request
from typing import Any

import numpy as np

import large_image.tilesource.base
from large_image import config
from large_image.cache_util import LruCacheMetaclass, methodcache
from large_image.constants import TILE_FORMAT_NUMPY, SourcePriority
from large_image.exceptions import TileSourceError, TileSourceFileNotFoundError
from large_image.tilesource import FileTileSource

with contextlib.suppress(importlib.metadata.PackageNotFoundError):
    __version__ = importlib.metadata.version(__name__)

# Bio-Formats version and download URL
BIOFORMATS_VERSION = '7.3.1'
BIOFORMATS_JAR_URL = (
    f'https://downloads.openmicroscopy.org/bio-formats/{BIOFORMATS_VERSION}'
    f'/artifacts/bioformats_package.jar'
)

# Module-level state
_jvm_started = False
_jvm_lock = threading.Lock()
_jpy = None
_bioformats_jar_path: pathlib.Path | None = None

# Default to ignoring files with no extension and some specific extensions.
config.ConfigValues.setdefault(
    'source_bioformats_ignored_names',
    r'(^[^.]*|\.(jpg|jpeg|jpe|png|tif|tiff|ndpi|ome|nc|json|geojson|fits|isyntax|mrxs|zip|zarr(\.db|\.zip)))$')


def _get_bioformats_jar() -> pathlib.Path:
    """Get path to Bio-Formats JAR, downloading if necessary."""
    global _bioformats_jar_path

    if _bioformats_jar_path and _bioformats_jar_path.exists():
        return _bioformats_jar_path

    # Check common locations
    cache_dir = pathlib.Path.home() / '.cache' / 'large_image' / 'bioformats'
    jar_path = cache_dir / f'bioformats_package-{BIOFORMATS_VERSION}.jar'

    if not jar_path.exists():
        cache_dir.mkdir(parents=True, exist_ok=True)
        logger = config.getLogger()
        logger.info('Downloading Bio-Formats %s...', BIOFORMATS_VERSION)
        try:
            urllib.request.urlretrieve(BIOFORMATS_JAR_URL, jar_path)
            logger.info('Bio-Formats JAR downloaded to %s', jar_path)
        except Exception as exc:
            msg = f'Failed to download Bio-Formats JAR: {exc}'
            raise TileSourceError(msg) from exc

    _bioformats_jar_path = jar_path
    return jar_path


def _start_jvm(logger: logging.Logger) -> bool:
    """Start the JVM with Bio-Formats on the classpath."""
    global _jvm_started, _jpy

    with _jvm_lock:
        if _jvm_started:
            return True

        try:
            import jpy
            _jpy = jpy

            if jpy.has_jvm():
                _jvm_started = True
                return True

            jar_path = _get_bioformats_jar()

            # Configure JVM options
            jvm_options = [
                '-Djava.awt.headless=true',
                f'-Djava.class.path={jar_path}',
                '-Xmx4g',
            ]

            # Find Java home if not set
            java_home = os.environ.get('JAVA_HOME')
            if java_home:
                jpy.config.set_option('jpy.jvmDll', f'{java_home}/lib/server/libjvm.dylib')

            jpy.create_jvm(jvm_options)
            _jvm_started = True

            # Reduce logging
            _reduce_logging()

            logger.info('Started JVM for Bio-Formats tile source (version %s)', BIOFORMATS_VERSION)
            atexit.register(_stop_jvm)
            return True

        except Exception as exc:
            logger.exception('Cannot start JVM for Bio-Formats: %s', exc)
            return False


def _stop_jvm() -> None:
    """Shutdown the JVM."""
    global _jvm_started
    if _jpy is not None and _jpy.has_jvm():
        _jpy.destroy_jvm()
    _jvm_started = False


def _reduce_logging() -> None:
    """Reduce Bio-Formats logging verbosity."""
    if _jpy is None:
        return
    try:
        LoggerFactory = _jpy.get_type('org.slf4j.LoggerFactory')
        Level = _jpy.get_type('ch.qos.logback.classic.Level')
        root_logger = LoggerFactory.getLogger('ROOT')
        root_logger.setLevel(Level.OFF)
    except Exception:
        pass


class BioformatsReader:
    """Lightweight wrapper around Bio-Formats ImageReader."""

    def __init__(self, path: str):
        if _jpy is None or not _jpy.has_jvm():
            msg = 'JVM not started'
            raise TileSourceError(msg)

        self._path = path
        self._lock = threading.RLock()

        # Get Java classes
        self._ImageReader = _jpy.get_type('loci.formats.ImageReader')
        self._MetadataStore = _jpy.get_type('loci.formats.meta.MetadataStore')
        self._OMEXMLMetadata = _jpy.get_type('loci.formats.ome.OMEXMLMetadata')
        self._ServiceFactory = _jpy.get_type('loci.common.services.ServiceFactory')
        self._OMEXMLService = _jpy.get_type('loci.formats.services.OMEXMLService')
        self._DataTools = _jpy.get_type('loci.common.DataTools')

        # Create reader and metadata store
        factory = self._ServiceFactory()
        service = factory.getInstance(self._OMEXMLService.jclass)
        self._metadata = service.createOMEXMLMetadata()

        self._reader = self._ImageReader()
        self._reader.setMetadataStore(self._metadata)
        self._reader.setFlattenedResolutions(False)
        self._reader.setId(path)

    def close(self) -> None:
        """Close the reader."""
        with self._lock:
            if self._reader is not None:
                self._reader.close()
                self._reader = None

    def __del__(self):
        self.close()

    @property
    def series_count(self) -> int:
        return self._reader.getSeriesCount()

    @property
    def resolution_count(self) -> int:
        return self._reader.getResolutionCount()

    def set_series(self, series: int) -> None:
        with self._lock:
            self._reader.setSeries(series)

    def set_resolution(self, resolution: int) -> None:
        with self._lock:
            self._reader.setResolution(resolution)

    def get_size_x(self) -> int:
        return self._reader.getSizeX()

    def get_size_y(self) -> int:
        return self._reader.getSizeY()

    def get_size_z(self) -> int:
        return self._reader.getSizeZ()

    def get_size_c(self) -> int:
        return self._reader.getSizeC()

    def get_size_t(self) -> int:
        return self._reader.getSizeT()

    def get_image_count(self) -> int:
        return self._reader.getImageCount()

    def get_rgb_channel_count(self) -> int:
        return self._reader.getRGBChannelCount()

    def get_effective_size_c(self) -> int:
        return self._reader.getEffectiveSizeC()

    def get_pixel_type(self) -> int:
        return self._reader.getPixelType()

    def get_bits_per_pixel(self) -> int:
        return self._reader.getBitsPerPixel()

    def is_rgb(self) -> bool:
        return self._reader.isRGB()

    def is_interleaved(self) -> bool:
        return self._reader.isInterleaved()

    def is_little_endian(self) -> bool:
        return self._reader.isLittleEndian()

    def get_dimension_order(self) -> str:
        return self._reader.getDimensionOrder()

    def get_optimal_tile_width(self) -> int:
        return self._reader.getOptimalTileWidth()

    def get_optimal_tile_height(self) -> int:
        return self._reader.getOptimalTileHeight()

    def get_index(self, z: int, c: int, t: int) -> int:
        return self._reader.getIndex(z, c, t)

    def get_format(self) -> str:
        return self._reader.getFormat()

    def get_reader_class_name(self) -> str:
        return self._reader.getReader().getClass().getName()

    def get_series_metadata(self) -> dict[str, str]:
        """Get series-specific metadata as a dictionary."""
        result = {}
        hashtable = self._reader.getSeriesMetadata()
        if hashtable:
            keys = hashtable.keys()
            while keys.hasMoreElements():
                key = keys.nextElement()
                value = hashtable.get(key)
                if value is not None:
                    result[str(key)] = str(value)
        return result

    def get_global_metadata(self) -> dict[str, str]:
        """Get global metadata as a dictionary."""
        result = {}
        hashtable = self._reader.getGlobalMetadata()
        if hashtable:
            keys = hashtable.keys()
            while keys.hasMoreElements():
                key = keys.nextElement()
                value = hashtable.get(key)
                if value is not None:
                    result[str(key)] = str(value)
        return result

    def get_channel_name(self, series: int, channel: int) -> str | None:
        """Get the name of a channel."""
        try:
            name = self._metadata.getChannelName(series, channel)
            return str(name) if name else None
        except Exception:
            return None

    def read_region(self, x: int, y: int, width: int, height: int,
                    z: int = 0, c: int = 0, t: int = 0) -> np.ndarray:
        """Read a region from the current series/resolution."""
        with self._lock:
            plane_index = self.get_index(z, c, t)
            pixel_type = self.get_pixel_type()
            rgb_count = self.get_rgb_channel_count()
            is_interleaved = self.is_interleaved()
            is_little_endian = self.is_little_endian()

            # Read raw bytes
            raw_bytes = self._reader.openBytes(plane_index, x, y, width, height)

            # Convert to numpy array based on pixel type
            dtype = self._pixel_type_to_dtype(pixel_type, is_little_endian)
            arr = np.frombuffer(bytes(raw_bytes), dtype=dtype)

            # Reshape based on interleaving
            if rgb_count > 1:
                if is_interleaved:
                    arr = arr.reshape((height, width, rgb_count))
                else:
                    arr = arr.reshape((rgb_count, height, width))
                    arr = np.moveaxis(arr, 0, -1)
            else:
                arr = arr.reshape((height, width))

            return arr

    @staticmethod
    def _pixel_type_to_dtype(pixel_type: int, little_endian: bool) -> np.dtype:
        """Convert Bio-Formats pixel type to numpy dtype."""
        # Bio-Formats pixel type constants
        INT8, UINT8, INT16, UINT16, INT32, UINT32, FLOAT, DOUBLE = range(8)

        endian = '<' if little_endian else '>'
        type_map = {
            INT8: 'i1',
            UINT8: 'u1',
            INT16: f'{endian}i2',
            UINT16: f'{endian}u2',
            INT32: f'{endian}i4',
            UINT32: f'{endian}u4',
            FLOAT: f'{endian}f4',
            DOUBLE: f'{endian}f8',
        }
        return np.dtype(type_map.get(pixel_type, 'u1'))


class BioformatsFileTileSource(FileTileSource, metaclass=LruCacheMetaclass):
    """Provides tile access via Bio-Formats."""

    cacheName = 'tilesource'
    name = 'bioformats'
    extensions = {
        None: SourcePriority.FALLBACK,
        'czi': SourcePriority.HIGH,
        'ets': SourcePriority.LOW,
        'lif': SourcePriority.MEDIUM,
        'vsi': SourcePriority.PREFERRED,
    }
    mimeTypes = {
        None: SourcePriority.FALLBACK,
        'image/czi': SourcePriority.HIGH,
        'image/vsi': SourcePriority.PREFERRED,
    }

    _singleTileThreshold = 2048
    _tileSize = 512
    _associatedImageMaxSize = 8192
    _maxSkippedLevels = 3

    def __init__(self, path: str, **kwargs: Any) -> None:
        super().__init__(path, **kwargs)

        largeImagePath = str(self._getLargeImagePath())
        config._ignoreSourceNames('bioformats', largeImagePath)

        # Check for PDFs which crash the JVM
        if os.path.isfile(largeImagePath):
            with open(largeImagePath, 'rb') as f:
                if f.read(5) == b'%PDF-':
                    msg = 'PDF files cannot be opened via Bio-Formats'
                    raise TileSourceError(msg)

        if not _start_jvm(self.logger):
            msg = 'JVM failed to start for Bio-Formats'
            raise TileSourceError(msg)

        self._tileLock = threading.RLock()

        try:
            self._reader = BioformatsReader(largeImagePath)
        except FileNotFoundError:
            raise TileSourceFileNotFoundError(largeImagePath) from None
        except Exception as exc:
            self.logger.debug('Cannot open via Bio-Formats: %r', exc)
            raise TileSourceError(f'Cannot open via Bio-Formats: {exc}') from exc

        self._initializeMetadata()

        if self.levels < 1:
            msg = 'Bio-Formats image must have at least one level'
            raise TileSourceError(msg)
        if self.sizeX <= 0 or self.sizeY <= 0:
            msg = 'Bio-Formats image size is invalid'
            raise TileSourceError(msg)

        # Verify we can read a tile
        try:
            self.getTile(0, 0, self.levels - 1)
        except Exception as exc:
            raise TileSourceError(f'Bio-Formats cannot read tile: {exc}') from exc

    def __del__(self):
        if hasattr(self, '_reader') and self._reader:
            self._reader.close()

    def _initializeMetadata(self) -> None:
        """Initialize metadata from the Bio-Formats reader."""
        rdr = self._reader

        self._metadata = {
            'seriesCount': rdr.series_count,
            'imageCount': rdr.get_image_count(),
            'sizeX': rdr.get_size_x(),
            'sizeY': rdr.get_size_y(),
            'sizeZ': rdr.get_size_z(),
            'sizeC': rdr.get_effective_size_c(),
            'sizeT': rdr.get_size_t(),
            'sizeColorPlanes': rdr.get_size_c(),
            'rgbChannelCount': rdr.get_rgb_channel_count(),
            'pixelType': rdr.get_pixel_type(),
            'bitsPerPixel': rdr.get_bits_per_pixel(),
            'isRGB': rdr.is_rgb(),
            'isInterleaved': rdr.is_interleaved(),
            'isLittleEndian': rdr.is_little_endian(),
            'dimensionOrder': rdr.get_dimension_order(),
            'optimalTileWidth': rdr.get_optimal_tile_width(),
            'optimalTileHeight': rdr.get_optimal_tile_height(),
            'resolutionCount': rdr.resolution_count,
            'readerClassName': rdr.get_reader_class_name(),
            'format': rdr.get_format(),
            'metadata': rdr.get_global_metadata(),
            'seriesMetadata': rdr.get_series_metadata(),
        }

        # Get channel names
        try:
            self._metadata['channelNames'] = [
                rdr.get_channel_name(0, c) or f'Channel {c}'
                for c in range(self._metadata['sizeColorPlanes'])
            ]
        except Exception:
            self._metadata['channelNames'] = []

        # Ensure valid sizes
        for key in ['sizeC', 'sizeZ', 'sizeT']:
            if not isinstance(self._metadata[key], int) or self._metadata[key] < 1:
                self._metadata[key] = 1

        self.sizeX = self._metadata['sizeX']
        self.sizeY = self._metadata['sizeY']
        self._metadata['sizeXY'] = 1

        self._initializeFrameSeries()
        self._computeTiles()
        self._computeLevels()
        self._computeMagnification()

    def _initializeFrameSeries(self) -> None:
        """Initialize frame series information."""
        self._metadata['frameSeries'] = [{
            'series': list(range(self._metadata['resolutionCount'])),
            'sizeX': self.sizeX,
            'sizeY': self.sizeY,
        }]
        self._metadata['seriesAssociatedImages'] = {}

    def _computeTiles(self) -> None:
        """Compute tile dimensions."""
        if (self._metadata['resolutionCount'] <= 1 and
                self.sizeX <= self._singleTileThreshold and
                self.sizeY <= self._singleTileThreshold):
            self.tileWidth = self.sizeX
            self.tileHeight = self.sizeY
        elif (128 <= self._metadata['optimalTileWidth'] <= self._singleTileThreshold and
              128 <= self._metadata['optimalTileHeight'] <= self._singleTileThreshold):
            self.tileWidth = self._metadata['optimalTileWidth']
            self.tileHeight = self._metadata['optimalTileHeight']
        else:
            self.tileWidth = self.tileHeight = self._tileSize

    def _computeLevels(self) -> None:
        """Compute number of resolution levels."""
        self.levels = int(math.ceil(max(
            math.log(float(self.sizeX) / self.tileWidth),
            math.log(float(self.sizeY) / self.tileHeight)) / math.log(2))) + 1

    def _computeMagnification(self) -> None:
        """Extract magnification from metadata."""
        self._magnification = {}
        metadata = {
            **self._metadata.get('seriesMetadata', {}),
            **self._metadata.get('metadata', {}),
        }

        # Try to find pixel size
        for key, scale in [('Physical pixel size', 1e-3), ('0028,0030 Pixel Spacing', 1)]:
            if key in metadata:
                match = re.match(r'^[^0-9.]*(\d*\.?\d+)[^0-9.]+(\d*\.?\d+)', metadata[key])
                if match:
                    self._magnification['mm_x'] = float(match.group(1)) * scale
                    self._magnification['mm_y'] = float(match.group(2)) * scale
                    break

        # Try to find magnification
        for key in ['NominalMagnification', 'Magnification']:
            for k, v in metadata.items():
                if key in k:
                    try:
                        self._magnification['magnification'] = float(v)
                        break
                    except ValueError:
                        pass

    def getNativeMagnification(self) -> dict[str, float | None]:
        """Get magnification information."""
        mm_x = self._magnification.get('mm_x')
        mm_y = self._magnification.get('mm_y', mm_x)
        mag = self._magnification.get('magnification')
        if mag is None and mm_x:
            mag = 0.01 / mm_x
        return {'magnification': mag, 'mm_x': mm_x, 'mm_y': mm_y}

    def getMetadata(self) -> dict:
        """Return metadata dictionary."""
        result = super().getMetadata()
        frames = []
        for t in range(self._metadata['sizeT']):
            for z in range(self._metadata['sizeZ']):
                for c in range(self._metadata['sizeC']):
                    frames.append({'IndexC': c, 'IndexZ': z, 'IndexT': t, 'IndexXY': 0})
        if len(frames) > 1:
            result['frames'] = frames
            self._addMetadataFrameInformation(result, self._metadata['channelNames'])
        return result

    def getInternalMetadata(self, **kwargs: Any) -> dict:
        """Return internal metadata."""
        return self._metadata

    @methodcache()
    def getTile(self, x: int, y: int, z: int, pilImageAllowed: bool = False,
                numpyAllowed: bool = False, **kwargs: Any) -> Any:
        """Get a tile from the image."""
        self._xyzInRange(x, y, z)

        frame = kwargs.get('frame', 0) or 0
        fc = frame % self._metadata['sizeC']
        fz = (frame // self._metadata['sizeC']) % self._metadata['sizeZ']
        ft = (frame // self._metadata['sizeC'] // self._metadata['sizeZ']) % self._metadata['sizeT']

        seriesLevel = self.levels - 1 - z
        scale = 1
        while seriesLevel >= self._metadata['resolutionCount']:
            seriesLevel -= 1
            scale *= 2

        offsetx = x * self.tileWidth * scale
        offsety = y * self.tileHeight * scale
        width = min(self.tileWidth * scale, self.sizeX // 2 ** seriesLevel - offsetx)
        height = min(self.tileHeight * scale, self.sizeY // 2 ** seriesLevel - offsety)

        if scale >= 2 ** self._maxSkippedLevels:
            tile, _ = self._getTileFromEmptyLevel(x, y, z, **kwargs)
            tile = large_image.tilesource.base._imageToNumpy(tile)[0]
        else:
            with self._tileLock:
                self._reader.set_resolution(seriesLevel)
                if width > 0 and height > 0:
                    tile = self._reader.read_region(offsetx, offsety, width, height, fz, fc, ft)
                else:
                    tile = np.zeros((0, 0), dtype=np.uint8)

            if scale > 1:
                tile = tile[::scale, ::scale]

        # Pad to expected size
        finalWidth = self.tileWidth
        finalHeight = self.tileHeight
        if tile.shape[0] != finalHeight or tile.shape[1] != finalWidth:
            fill = 255 if tile.dtype == np.uint8 else 0
            new_shape = (finalHeight, finalWidth) + tile.shape[2:]
            padded = np.full(new_shape, fill, dtype=tile.dtype)
            padded[:tile.shape[0], :tile.shape[1]] = tile
            tile = padded

        return self._outputTile(
            tile, TILE_FORMAT_NUMPY, x, y, z, pilImageAllowed, numpyAllowed, **kwargs)

    def getAssociatedImagesList(self) -> list[str]:
        """Return list of associated images."""
        return sorted(self._metadata.get('seriesAssociatedImages', {}).keys())

    def _getAssociatedImage(self, imageKey: str):
        """Get an associated image."""
        info = self._metadata.get('seriesAssociatedImages', {}).get(imageKey)
        if not info:
            return None
        with self._tileLock:
            self._reader.set_series(info['seriesNum'])
            image = self._reader.read_region(0, 0, info['sizeX'], info['sizeY'])
        return large_image.tilesource.base._imageToPIL(image)


def open(*args: Any, **kwargs: Any) -> BioformatsFileTileSource:
    """Create an instance of the module class."""
    return BioformatsFileTileSource(*args, **kwargs)


def canRead(*args: Any, **kwargs: Any) -> bool:
    """Check if an input can be read by the module class."""
    return BioformatsFileTileSource.canRead(*args, **kwargs)
