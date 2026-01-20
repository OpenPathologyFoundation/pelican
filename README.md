# Large Image

[![License](https://img.shields.io/badge/license-Apache%202-blue.svg)](https://raw.githubusercontent.com/girder/large_image/master/LICENSE)

[![image](https://img.shields.io/pypi/v/large-image.svg?logo=python&logoColor=white)](https://pypi.org/project/large-image/)

*Python modules to work with large, multiresolution images.*

Large Image is a Python library for working with large multi-resolution
images, including whole slide images (WSI) for digital pathology and
geospatial imagery. It provides efficient tiled access to images, format
conversion, and a standalone FastAPI-based tile server.

## Credits / Origins

This project is derived from [Kitware\'s Large
Image](https://github.com/girder/large_image) library, used under the
Apache License 2.0.

This fork has been heavily refactored to focus specifically on whole
slide image (WSI) viewing for digital pathology workflows. Key
modifications include:

- Removal of Girder dependencies for standalone operation
- Addition of a modern FastAPI-based tile server architecture
- Integration with a SvelteKit-based digital pathology viewer frontend
- Focus on clinical WSI formats (SVS, NDPI, DICOM, OME-TIFF)

We gratefully acknowledge Kitware, Inc. and all contributors to the
original Large Image project.

For a detailed summary of all modifications made in this fork, see
[FORK_CHANGES.md](FORK_CHANGES.md).

## Highlights

- **Tile serving made easy** - Built-in FastAPI tile server with XYZ,
  DeepZoom, and IIIF support
- **Wide format support** - Medical (SVS, NDPI, DICOM), geospatial
  (GeoTIFF, COG), and general formats
- **Convert images** - Create Cloud Optimized GeoTIFFs and pyramidal
  TIFFs
- **Efficient region access** - Python API for accessing arbitrary
  regions at any resolution
- **Style transforms** - Dynamic colormap, band manipulation, and
  composite styling
- **Caching** - Optional Redis or Memcached caching for tile server
  performance

## Quick Start

### Install

``` bash
# Core library with common image format support
pip install large-image[common]

# With tile server
pip install large-image[common] large-image-server

# All formats (Linux only, requires additional system libraries)
pip install large-image[all] --find-links https://girder.github.io/large_image_wheels
```

### Python Usage

``` python
import large_image

# Open an image
source = large_image.open('/path/to/image.svs')

# Get metadata
metadata = source.getMetadata()
print(f"Size: {metadata['sizeX']} x {metadata['sizeY']}")
print(f"Levels: {metadata['levels']}")

# Get a tile
tile = source.getTile(level=5, x=10, y=10)

# Get a region as a numpy array
region, mime = source.getRegion(
    region={'left': 1000, 'top': 1000, 'right': 2000, 'bottom': 2000},
    output={'maxWidth': 512}
)

# Get a thumbnail
thumb, mime = source.getThumbnail(width=256)
```

### Tile Server

``` bash
# Start the tile server
large_image_server --image-dir /path/to/images --port 8000

# Server is now available at http://localhost:8000
# - DeepZoom: /deepzoom/{filename}.dzi
# - XYZ tiles: /tiles/{filename}/{z}/{x}/{y}.png
# - Metadata: /metadata/{filename}
```

## Installation Options

### Pip

Install with common tile sources (works on Linux, macOS, Windows):

    pip install large-image[common]

Install all tile sources on Linux:

    pip install large-image[all] --find-links https://girder.github.io/large_image_wheels

### Conda

The base module and several sources are available on conda-forge:

    conda install -c conda-forge large-image
    conda install -c conda-forge large-image-source-gdal
    conda install -c conda-forge large-image-source-tiff
    conda install -c conda-forge large-image-converter

### Docker

A pre-built Docker image includes all dependencies:

    docker pull ghcr.io/girder/large_image:latest
    docker run -v /path/to/images:/opt/images -p 8000:8000 ghcr.io/girder/large_image:latest

## Modules

Large Image consists of several Python packages:

**Core Library**

- `large-image`: The core module for reading and processing large
  images.

  Extra install options:

  - `sources`: All tile sources
  - `common`: Common sources that install on all platforms without extra
    system dependencies
  - `memcached`: Memcached caching support
  - `redis`: Redis caching support
  - `colormaps`: Named color palettes via matplotlib
  - `tiledoutput`: Export large regions as tiled TIFFs
  - `performance`: Optional performance enhancements
  - `all`: Everything above

**Utilities**

- `large-image-server`: FastAPI tile server for serving images over
  HTTP/REST. Supports XYZ tiles, DeepZoom (OpenSeaDragon), metadata
  endpoints, and region extraction.
- `large-image-converter`: Convert images to pyramidal TIFF format.
  Extra options: `jp2k` for JPEG2000, `geospatial` for GeoTIFF support,
  `all` for everything.

**Tile Sources**

Each tile source is a separate package that can read specific image
formats:

- `large-image-source-openslide`: SVS, NDPI, Mirax, TIFF, VMS, and other
  whole slide formats via OpenSlide
- `large-image-source-tiff`: Pyramidal TIFF files in common compression
  formats
- `large-image-source-tifffile`: Wide variety of TIFF files via tifffile
  library
- `large-image-source-dicom`: DICOM Whole Slide Images (WSI)
- `large-image-source-ometiff`: OME-TIFF multi-frame files
- `large-image-source-bioformats`: Bioformats library (requires Java)
- `large-image-source-nd2`: Nikon ND2 format
- `large-image-source-gdal`: Geospatial formats via GDAL
- `large-image-source-rasterio`: Geospatial formats via rasterio
- `large-image-source-openjpeg`: JPEG2000 files via OpenJPEG/Glymur
- `large-image-source-deepzoom`: Microsoft DeepZoom format
- `large-image-source-pil`: Small images via Pillow
- `large-image-source-vips`: Images via libvips
- `large-image-source-zarr`: Zarr and OME-Zarr (OME-NGFF) files
- `large-image-source-multi`: Composite multiple sources into one
- `large-image-source-test`: Test pattern generator

## Tile Server

The `large-image-server` package provides a standalone FastAPI tile
server.

### Installation

``` bash
pip install large-image-server[all]
```

### Running

``` bash
# Basic usage
large_image_server --image-dir /path/to/slides --port 8000

# With Redis caching (recommended for production)
large_image_server --image-dir /path/to/slides --cache-backend redis

# Development mode with auto-reload
cd utilities/server
uvicorn large_image_server:app --reload --port 8000
```

### API Endpoints

  Endpoint                                  Description
  ----------------------------------------- -------------------------------------------
  `GET /health`                             Health check
  `GET /metadata/{image_id}`                Image metadata (dimensions, levels, etc.)
  `GET /tiles/{image_id}/{z}/{x}/{y}.png`   XYZ tile (for OpenLayers, Leaflet)
  `GET /deepzoom/{image_id}.dzi`            DeepZoom descriptor (for OpenSeaDragon)
  `GET /deepzoom/{image_id}_files/...`      DeepZoom tiles
  `GET /thumbnail/{image_id}`               Thumbnail image
  `GET /region/{image_id}`                  Extract arbitrary region
  `GET /associated/{image_id}`              List associated images (label, macro)
  `GET /associated/{image_id}/{name}`       Get specific associated image

See `utilities/server/README.md` for full API documentation.

## Digital Pathology Viewer

The `digital-viewer` directory contains a modern web-based viewer for
digital pathology:

- **Svelte + OpenSeadragon** viewer components
- **Focus Declaration Protocol (FDP)** for patient safety
- **GeoJSON annotations** with measurement support
- **Voice control** for hands-free navigation
- **Session awareness** for multi-window workflows

See `digital-viewer/README.md` for setup and usage instructions.

### Quick Start

``` bash
# Terminal 1: Start tile server
source .venv/bin/activate
large_image_server --image-dir /path/to/slides --port 8000

# Terminal 2: Start session service
cd digital-viewer
npm install
npm run dev:session

# Terminal 3: Start viewer UI
cd digital-viewer
npm run dev
```

Open <http://localhost:5173> in your browser.

## Configuration

Large Image can be configured via environment variables or a
configuration file.

### Environment Variables

``` bash
# Cache settings
LARGE_IMAGE_CACHE_BACKEND=redis
LARGE_IMAGE_CACHE_URL=redis://localhost:6379

# Source cache
LARGE_IMAGE_CACHE_TILESOURCE_MAXIMUM=100
LARGE_IMAGE_CACHE_TILESOURCE_TTL=300
```

### Configuration File

Create `large_image.yaml` or set `LARGE_IMAGE_CONFIG` environment
variable:

``` yaml
cache:
  backend: redis
  url: redis://localhost:6379

tilesource:
  cache:
    maximum: 100
    ttl: 300
```

## Development

Setting up a development environment:

    # Clone the repository
    git clone https://github.com/girder/large_image.git
    cd large_image

    # Create virtual environment
    python -m venv .venv
    source .venv/bin/activate

    # Install in development mode
    pip install -e .[common]
    pip install -e utilities/server[all]
    pip install -e utilities/converter[all]

Running tests:

    # Python tests
    pytest test/

    # Server tests
    cd utilities/server
    pip install -e .[test]
    pytest tests/

    # Digital viewer tests
    cd digital-viewer
    npm install
    npm test

## License

Apache-2.0
