# Library Evaluation Report

This document provides an in-depth evaluation of the large_image library
for use as a tile server for pathology and large multi-resolution
images.

## Executive Summary

The large_image library is a mature, production-ready Python library
(v1.34.0, actively maintained) specifically designed for tile serving of
large, multi-resolution images including pathology/WSI formats. It is
well-suited for creating a tile server for pathology images that
integrates with OpenSeaDragon or OpenLayers.

## 1. Suitability for Pathology Image Tile Server

### Supported Whole Slide Image Formats

  ---------------------------------------------------------------------------------
  Format         Source Plugin          Extensions     Notes
  -------------- ---------------------- -------------- ----------------------------
  Aperio SVS     openslide              .svs           Primary pathology format

  Hamamatsu      openslide              .ndpi, .vms    Full support
  NDPI/VMS

  Leica SCN      openslide              .scn           Full support

  3D Histech     openslide              .mrxs          Multi-file format
  MIRAX

  Zeiss CZI      openslide/bioformats   .czi           Microscopy format

  Pyramidal TIFF tiff, tifffile         .tif, .ptif,   Most versatile
                                        .qptiff

  OME-TIFF       ometiff                .ome.tif       Multi-channel/Z/T

  Nikon ND2      nd2                    .nd2           Fluorescence microscopy

  DICOM WSI      dicom                  .dcm           Medical standard

  JPEG2000       openjpeg               .jp2           Geospatial/WSI
  ---------------------------------------------------------------------------------

### Pathology-Specific Features

- Associated images (label, macro) extraction
- Magnification metadata (mm_x, mm_y pixel sizes)
- Multi-channel fluorescence support with false-color compositing
- Z-stack and time-series handling

## 2. Dependency Analysis

### Core Dependencies (Modern)

  --------------------------------------------------------------------------
  Package             Version        Assessment
  ------------------- -------------- ---------------------------------------
  Python              \>=3.10,       Excellent - Modern, forward-looking
                      \<=3.14

  Pillow              \>=11.0        Excellent - Latest (2024)

  numpy               \>=1.26        Excellent - Current

  cachetools          \>=5.3         Good - Stable

  typing-extensions   \>=4.9         Good - Type hints support
  --------------------------------------------------------------------------

### Source Plugin Dependencies

  ------------------------------------------------------------------------
  Source      Key Dependencies                Assessment
  ----------- ------------------------------- ----------------------------
  openslide   openslide-python\>=1.4.1,       Excellent - Modern binaries
              openslide-bin\>=4.0             with wheels

  tiff        pylibtiff, tifftools\>=1.7.0    Good

  dicom       wsidicom\>=0.20, pydicom\>=2.4  Good

  vips        pyvips\>=2.2.3                  Excellent

  zarr        zarr\<3, numcodecs\<0.16        ⚠️ Needs attention
  ------------------------------------------------------------------------

### Dependency Concerns

1.  **Zarr 2.x Lock-in** (zarr\<3) - Major version 3 explicitly
    excluded; migration needed
2.  **GDAL Unversioned** - No version constraint (fragility risk for
    geospatial)
3.  **numcodecs constraint** (\<0.16) - Tied to zarr compatibility

## 3. Integration with OpenSeaDragon / OpenLayers

### Current State

The library provides partial built-in viewer integration:

**Built-in (Jupyter/IPyleaflet):**

``` python
# jupyter.py provides Tornado-based tile server
# URL pattern: /tile?z={z}&x={x}&y={y}&encoding=png
```

**DeepZoom Source (sources/deepzoom/):**

- Can read existing DeepZoom (.dzi) tile pyramids
- This is the format OpenSeaDragon natively consumes

### What\'s Available vs What\'s Needed

  -------------------------------------------------------------------------
  Feature               Status      Notes
  --------------------- ----------- ---------------------------------------
  Tile generation (XYZ) ✅          getTile(x, y, z)
                        Available

  Multiple encodings    ✅          JPEG, PNG, TIFF
                        Available

  Metadata API          ✅          getMetadata()
                        Available

  Jupyter tile server   ✅          Tornado-based, local only
                        Available

  Production REST API   ❌ Missing  No Flask/FastAPI/Django integration

  DeepZoom XML          ❌ Missing  Can read but not generate .dzi
  generator

  IIIF endpoints        ❌ Missing  Standard image API
  -------------------------------------------------------------------------

### Integration Approach Options

**Option A: Build a Flask/FastAPI wrapper (Recommended)**

``` python
# Example minimal FastAPI tile server
from fastapi import FastAPI
from fastapi.responses import Response
import large_image

app = FastAPI()

@app.get("/tiles/{image_id}/{z}/{x}/{y}.png")
async def get_tile(image_id: str, z: int, x: int, y: int):
    source = large_image.open(f"/images/{image_id}")
    tile = source.getTile(x, y, z, encoding='PNG')
    return Response(content=tile, media_type="image/png")

@app.get("/tiles/{image_id}/info.json")
async def get_info(image_id: str):
    source = large_image.open(f"/images/{image_id}")
    return source.getMetadata()
```

**Option B: Use with Digital Slide Archive/HistomicsUI**

- The library is designed to work with
  [Girder](https://github.com/girder/girder)
- HistomicsUI provides full OpenLayers-based pathology viewer

## 4. Architecture Strengths

1.  **Plugin-based source system** - Easy to add new formats via entry
    points
2.  **Multi-level caching** - Python LRU, Memcached, Redis backends
3.  **Lazy tile loading** - Memory-efficient for large images
4.  **Thread-safe** - Production-ready concurrent access
5.  **Coordinate flexibility** - Pixels, mm, µm, nm, projection units
6.  **Style system** - Dynamic false-color, band selection, min/max
    remapping
7.  **ICC color management** - Automatic color correction

## 5. What Needs Improvement

### Critical for Tile Server Use

  -----------------------------------------------------------------------
  Issue                    Priority       Effort
  ------------------------ -------------- -------------------------------
  No production HTTP       High           Medium - Build Flask/FastAPI
  server                                  wrapper

  No IIIF Image API        Medium         Medium - Add /iiif/ endpoints
  support

  No DeepZoom .dzi         Medium         Low - Use converter utility
  generation

  Zarr 3.x migration       Low (not       High - Breaking changes
                           blocking)
  -----------------------------------------------------------------------

### Recommended Improvements

1.  **Create a REST adapter package** (large-image-server)
    - Flask or FastAPI based
    - Standard tile URL patterns (/tiles/{z}/{x}/{y})
    - OpenSeaDragon-compatible endpoints
    - IIIF Image API compliance
2.  **Add DeepZoom export**
    - Generate .dzi + tile folders from any source
    - Already has large-image-converter utility that could be extended
3.  **Document viewer integration patterns**
    - OpenSeaDragon configuration examples
    - OpenLayers setup guides

## 6. Quick Start for Your Use Case

To create a pathology tile server with OpenSeaDragon:

**Installation:**

``` bash
pip install large-image[openslide,tiff,common]
```

**Simple HTTP Tile Server:**

``` python
import large_image
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import re

class TileHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Simple tile URL: /{image}/tiles/{z}/{x}/{y}.png
        match = re.match(r'/(\w+)/tiles/(\d+)/(\d+)/(\d+)\.png', self.path)
        if match:
            image, z, x, y = match.groups()
            source = large_image.open(f'/path/to/{image}.svs')
            tile = source.getTile(int(x), int(y), int(z), encoding='PNG')
            self.send_response(200)
            self.send_header('Content-Type', 'image/png')
            self.end_headers()
            self.wfile.write(tile)
        elif self.path.endswith('/info.json'):
            image = self.path.split('/')[1]
            source = large_image.open(f'/path/to/{image}.svs')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(source.getMetadata()).encode())
```

**OpenSeaDragon Configuration:**

``` javascript
var viewer = OpenSeadragon({
    id: "viewer",
    tileSources: {
        height: metadata.sizeY,
        width: metadata.sizeX,
        tileSize: metadata.tileWidth,
        getTileUrl: function(level, x, y) {
            return `/image/tiles/${level}/${x}/${y}.png`;
        }
    }
});
```

## 7. Conclusion

  -------------------------------------------------------------------------
  Criterion         Score        Notes
  ----------------- ------------ ------------------------------------------
  Format support    ⭐⭐⭐⭐⭐   Excellent - All major pathology formats

  Dependency        ⭐⭐⭐⭐     Good - Python 3.10+, recent libs, Zarr
  modernity                      needs work

  API design        ⭐⭐⭐⭐⭐   Excellent - Clean, well-documented

  Production        ⭐⭐⭐⭐     Good - Needs HTTP adapter for standalone
  readiness                      use

  Viewer            ⭐⭐⭐       Partial - Jupyter only, needs REST wrapper
  integration

  Documentation     ⭐⭐⭐⭐     Good - Examples, API docs available
  -------------------------------------------------------------------------

**Verdict:** The large_image library is an excellent foundation for a
pathology tile server. The core tile generation, caching, and format
support are mature and production-tested. The main gap is a standalone
HTTP server component - you\'ll need to wrap it with Flask/FastAPI/etc.
for OpenSeaDragon/OpenLayers integration.

\### Why FastAPI is the Right Choice

\#### Current Gap The evaluation report clearly identifies that the
library has: - ✅ Excellent tile generation ([getTile(x, y,
z)]{.title-ref}) - ✅ Multiple encodings (JPEG, PNG, TIFF) - ✅ Metadata
API ([getMetadata()]{.title-ref}) - ❌ **No production REST API** (only
Jupyter/Tornado for local use) - ❌ No IIIF endpoints - ❌ No DeepZoom
.dzi generation

\#### FastAPI Advantages for This Use Case

1.  **Async Support** - Critical for tile serving where I/O is the
    bottleneck
2.  **Automatic OpenAPI/Swagger docs** - Great for API documentation
3.  **Type hints** - Aligns with the project\'s modern Python 3.10+
    requirement
4.  **Performance** - One of the fastest Python frameworks
5.  **Easy integration** - Works well with OpenSeaDragon/OpenLayers

\-\--

\### Recommended Implementation Approach

`` `python # Example structure for large-image-server package from fastapi import FastAPI, Response, HTTPException from fastapi.middleware.cors import CORSMiddleware import large_image  app = FastAPI(title="Large Image Tile Server")  # CORS for browser-based viewers app.add_middleware(CORSMiddleware, allow_origins=["*"])  @app.get("/tiles/{image_id}/{z}/{x}/{y}.{format}") async def get_tile(image_id: str, z: int, x: int, y: int, format: str = "png"):     """XYZ tile endpoint compatible with OpenSeaDragon/OpenLayers"""     source = large_image.open(f"/images/{image_id}")     tile = source.getTile(x, y, z, encoding=format.upper())     return Response(content=tile, media_type=f"image/{format}")  @app.get("/tiles/{image_id}/info.json") async def get_info(image_id: str):     """Metadata endpoint"""     source = large_image.open(f"/images/{image_id}")     return source.getMetadata()  @app.get("/tiles/{image_id}/associated/{name}") async def get_associated(image_id: str, name: str):     """Associated images (label, macro, etc.)"""     source = large_image.open(f"/images/{image_id}")     image, mime = source.getAssociatedImage(name)     return Response(content=image, media_type=mime) ``\`

\-\--

\### Suggested Development Plan

| Phase \| Task \| Effort \|

[\|\-\-\-\-\-\--\|](##SUBST##|-------|)\-\-\-\-\--[\|\-\-\-\-\-\-\--\|](##SUBST##|--------|)
\| 1 \| Create [large-image-server]{.title-ref} package with basic XYZ
tiles \| Low \| \| 2 \| Add caching integration (Redis/Memcached already
supported) \| Low \| \| 3 \| Add IIIF Image API endpoints
([/iiif/2/{id}/\...]{.title-ref}) \| Medium \| \| 4 \| Add DeepZoom
[.dzi]{.title-ref} generation endpoint \| Low \| \| 5 \| Add
authentication/authorization hooks \| Medium \| \| 6 \| Docker
deployment configuration \| Low \|

\-\--

\### Key Considerations

1.  **Caching**: The library already has excellent caching (LRU,
    Memcached, Redis) - the FastAPI wrapper should leverage this
2.  **Connection pooling**: Consider keeping tile sources open for
    frequently accessed images
3.  **CORS**: Essential for browser-based viewers like OpenSeaDragon
4.  **Streaming**: For large regions, consider streaming responses

\-\--

\### Conclusion

A FastAPI wrapper is the **most impactful improvement** you can make to
this library for your pathology tile server use case. It: - Fills the
biggest gap identified in the evaluation - Enables direct
OpenSeaDragon/OpenLayers integration - Leverages the library\'s existing
strengths (tile generation, caching, format support) - Is relatively low
effort for high value

\### DeepZoom (DZI) in FastAPI - Addressing Cloud Cost Concerns

You raise an **excellent point** about DZI files in cloud environments.
Let me clarify the approach and address your concerns.

\-\--

\### The Key Insight: No Physical DZI Files Needed

With FastAPI + large_image, **you don\'t need to generate or store
actual DZI tile files at all**. Here\'s why:

\#### Traditional DZI Approach (Problematic)
`` ` image.dzi                    # XML descriptor image_files/ ├── 0/ │   └── 0_0.jpeg            # Level 0 tiles ├── 1/ │   ├── 0_0.jpeg │   └── 0_1.jpeg            # Level 1 tiles ├── ... └── 14/     └── (thousands of tiles) # Full resolution ``\`
**Problem**: Tens of thousands of PUT/GET operations = expensive in
cloud storage (S3, GCS, Azure Blob)

\#### FastAPI Dynamic Approach (Recommended)
`` `python # NO physical tile files stored - tiles generated on-demand from source image  @app.get("/deepzoom/{image_id}.dzi") async def get_dzi_descriptor(image_id: str):     """Generate DZI XML descriptor dynamically"""     source = large_image.open(f"/images/{image_id}")     meta = source.getMetadata()      # Generate XML on the fly - no file storage     dzi_xml = f'''<?xml version="1.0" encoding="UTF-8"?>     <Image xmlns="http://schemas.microsoft.com/deepzoom/2008"            Format="jpeg" Overlap="0" TileSize="{meta['tileWidth']}">         <Size Width="{meta['sizeX']}" Height="{meta['sizeY']}"/>     </Image>'''     return Response(content=dzi_xml, media_type="application/xml")  @app.get("/deepzoom/{image_id}_files/{level}/{col}_{row}.jpeg") async def get_dzi_tile(image_id: str, level: int, col: int, row: int):     """Generate tile on-demand - no pre-generated files"""     source = large_image.open(f"/images/{image_id}")     # Convert DeepZoom level/col/row to large_image's z/x/y     tile = source.getTile(col, row, level, encoding='JPEG')     return Response(content=tile, media_type="image/jpeg") ``\`

\-\--

\### Cloud Cost Comparison

| Approach \| Storage Ops \| Storage Cost \| Compute \|

[\|\-\-\-\-\-\-\-\-\--\|](##SUBST##|----------|)\-\-\-\-\-\-\-\-\-\-\-\--[\|\-\-\-\-\-\-\-\-\-\-\-\-\--\|](##SUBST##|--------------|)\-\-\-\-\-\-\-\--\|
\| Pre-generated DZI files \| \~50,000 PUTs per image \| **High** \| Low
\| \| Dynamic tile serving \| 1 PUT (source image only) \| **Minimal**
\| Moderate \|

**With dynamic serving:** - **Storage**: Only the original pyramidal
TIFF/SVS (1 file) - **GET requests**: Still happen, but from the single
source file via random access - **No PUT operations** for tiles -
they\'re generated in memory and served directly

\-\--

\### How large_image Handles This Efficiently

The library already supports **random access** to tiles within pyramidal
images:

`` `python # This reads ONLY the specific tile from disk - not the whole image source = large_image.open("huge_pathology_slide.svs") tile = source.getTile(x=5, y=10, z=3)  # Random access to specific tile ``\`

**Supported formats with efficient random access:** - Pyramidal TIFF
(.ptif, .tif) - Aperio SVS (.svs) - Hamamatsu NDPI (.ndpi) - Cloud
Optimized GeoTIFF (COG) - OME-TIFF - Zarr (designed for cloud!)

\-\--

\### Recommended Architecture for Cloud

`` ` ┌─────────────────────────────────────────────────────────────┐ │                     Cloud Storage (S3/GCS)                  │ │  ┌─────────────────────────────────────────────────────┐   │ │  │  Original pyramidal images only                      │   │ │  │  - slide1.svs (single file, ~2GB)                   │   │ │  │  - slide2.ndpi (single file, ~5GB)                  │   │ │  │  - slide3.ome.zarr/ (chunked, cloud-native)         │   │ │  └─────────────────────────────────────────────────────┘   │ └─────────────────────────────────────────────────────────────┘                               │                               ▼ (random access reads) ┌─────────────────────────────────────────────────────────────┐ │                    FastAPI Tile Server                      │ │  ┌─────────────────┐  ┌─────────────────┐                  │ │  │ Tile Cache      │  │ Source Cache    │                  │ │  │ (Redis/Memory)  │  │ (keep sources   │                  │ │  │                 │  │  open)          │                  │ │  └─────────────────┘  └─────────────────┘                  │ │                                                             │ │  Endpoints:                                                 │ │  - /deepzoom/{id}.dzi        → Dynamic XML                 │ │  - /deepzoom/{id}_files/...  → Dynamic tiles               │ │  - /tiles/{id}/{z}/{x}/{y}   → XYZ tiles                   │ └─────────────────────────────────────────────────────────────┘                               │                               ▼ ┌─────────────────────────────────────────────────────────────┐ │                    OpenSeaDragon Viewer                     │ │  (thinks it's reading DZI files, but it's dynamic)         │ └─────────────────────────────────────────────────────────────┘ ``\`

\-\--

\### For True Cloud-Native: Consider Zarr

If you want the **most cloud-optimized** approach, the library supports
**Zarr/OME-NGFF**:

`` `python # Zarr is designed for cloud - chunked, parallel access # Each "tile" is a chunk that can be accessed independently source = large_image.open("s3://bucket/slide.ome.zarr") ``\`

**Zarr advantages:** - Designed for cloud object storage - Parallel
chunk access - No need for HTTP range requests (each chunk is a separate
object, but organized) - Emerging standard for bioimaging (OME-NGFF)

\-\--

\### Summary

| Your Concern \| Solution \|

[\|\-\-\-\-\-\-\-\-\-\-\-\-\--\|](##SUBST##|--------------|)\-\-\-\-\-\-\-\-\--\|
\| DZI files = thousands of small files \| **Don\'t create them** -
serve tiles dynamically \| \| PUT/GET costs in cloud \| Only 1 file
(source image) stored; tiles served from memory \| \| OpenSeaDragon
compatibility \| FastAPI emulates DZI URL pattern - viewer doesn\'t know
the difference \| \| Performance \| Use tile caching (Redis) + keep
sources open \|

**Bottom line**: The FastAPI approach **emulates** DeepZoom without
creating physical DZI archives. OpenSeaDragon requests
[/image_files/12/5_3.jpeg]{.title-ref} and FastAPI generates that tile
on-the-fly from the single source image. No tens of thousands of files,
no cloud storage cost explosion.

##I\'ve built a complete FastAPI tile server wrapper for the large_image
library. Here\'s a summary:

> Package Created: large-image-server
>
> Location: utilities/server/
>
> Package Structure
>
> utilities/server/ ├── setup.py \# Package setup with dependencies ├──
> pyproject.toml \# Build configuration ├── README.md \# Documentation
> ├── large_image_server/ │ ├── \_\_init\_\_.py \# App factory and
> embedded viewer │ ├── \_\_main\_\_.py \# CLI entry point │ ├──
> config.py \# Pydantic settings │ ├── models.py \# API models │ ├──
> source_manager.py \# Tile source caching │ └── routes/ │ ├──
> \_\_init\_\_.py │ ├── tiles.py \# XYZ tile endpoints │ ├── deepzoom.py
> \# DeepZoom/OpenSeaDragon endpoints │ ├── metadata.py \# Metadata &
> associated images │ └── regions.py \# Region extraction, thumbnails,
> histograms └── examples/ ├── basic_usage.py \# Python usage examples
> ├── openseadragon_viewer.html └── openlayers_viewer.html
>
> API Endpoints
> ┌──────────────────────────────────────────────────────────┬─────────────────────────────────────┐
> │ Endpoint │ Description │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /tiles/{image}/{z}/{x}/{y}.{format} │ XYZ tiles
> (OpenLayers/Leaflet) │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /deepzoom/{image}.dzi │ DeepZoom descriptor (OpenSeaDragon) │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /deepzoom/{image}\_files/{level}/{col}\_{row}.{format} │
> DeepZoom tiles │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /metadata/{image} │ Image metadata │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /associated/{image}/{name} │ Associated images (label, macro) │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /thumbnail/{image} │ Thumbnails │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /region/{image} │ Arbitrary region extraction │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /images │ List available images │
> ├──────────────────────────────────────────────────────────┼─────────────────────────────────────┤
> │ GET /health │ Health check │
> └──────────────────────────────────────────────────────────┴─────────────────────────────────────┘
> Installation & Usage
>
> \# Install cd utilities/server pip install -e .\[common\]
>
> \# Run from CLI large_image_server \--image-dir /path/to/slides
> \--port 8000
>
> \# Python usage from large_image_server import create_app import
> uvicorn
>
> app = create_app(image_dir=\"/path/to/slides\") uvicorn.run(app,
> host=\"0.0.0.0\", port=8000)
>
> OpenSeaDragon Integration
>
> var viewer = OpenSeadragon({
>
> :   id: \"viewer\", tileSources:
>     \"http://localhost:8000/deepzoom/slide.svs.dzi\"
>
> });
>
> Key Features
>
> 1.  Dynamic tile generation - No pre-generated DZI files needed
>     (addresses cloud cost concerns from your evaluation report)
> 2.  Source caching - LRU cache keeps frequently-used images open
> 3.  Multi-format support - All large_image sources (SVS, NDPI, TIFF,
>     etc.)
> 4.  Built-in viewer - Embedded OpenSeaDragon viewer at root URL
> 5.  CORS enabled - Browser-ready out of the box
> 6.  Swagger docs - Auto-generated API documentation at /docs
> 7.  Frame support - Multi-channel/Z-stack images via frame parameter
> 8.  Style support - False-color compositing via style JSON parameter
