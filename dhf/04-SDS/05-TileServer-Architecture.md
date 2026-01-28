# Software Design Specification — Tile Server Architecture

---
document_id: SDS-TLS-001
title: Digital Viewer Module — Tile Server (Image Management Service) Architecture
version: 1.0
status: ACTIVE
owner: Engineering
created_date: 2026-01-22
effective_date: 2026-01-22
trace_source: SRS-001 (System Requirements Specification, Section 3.13)
trace_destination: VVP-001 (Verification & Validation Plan)
references:
  - Library Evaluation Report (docs/evaluation_report.md)
  - large_image library documentation
  - IEC 62304:2006+A1:2015 (Section 5.4 — Software Architectural Design)
---

## 1. Purpose

This document defines the software architecture for the Image Management Service (Tile Server), a backend component that provides tile serving, metadata, and associated image retrieval for the Digital Viewer Module. The design leverages the `large_image` library wrapped in a FastAPI REST interface.

## 2. Architectural Overview

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser - Digital Viewer)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    OpenSeaDragon / OpenLayers                        │   │
│  │                    (Tile Rendering Engine)                           │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │ HTTPS (XYZ/DeepZoom tiles)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IMAGE MANAGEMENT SERVICE (Tile Server)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ FastAPI Router  │    │ Source Manager  │    │ Tile Cache      │        │
│  │ (REST Endpoints)│───▶│ (LRU Cache)     │───▶│ (Redis/Memory)  │        │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘        │
│           │                      │                                         │
│           │                      ▼                                         │
│           │             ┌─────────────────┐                               │
│           │             │ large_image     │                               │
│           │             │ TileSource      │                               │
│           │             └────────┬────────┘                               │
│           │                      │                                         │
│           ▼                      ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    Source Plugins                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │OpenSlide │ │ TIFF     │ │ OME-TIFF │ │ DICOM    │ │ Zarr     │  │  │
│  │  │ (SVS,    │ │ (ptif,   │ │          │ │ (wsidicom│ │ (OME-NGFF│  │  │
│  │  │  NDPI,   │ │  qptiff) │ │          │ │          │ │          │  │  │
│  │  │  MRXS)   │ │          │ │          │ │          │ │          │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ Random Access Read
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IMAGE STORAGE                                        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Local Filesystem│    │ S3/GCS/Azure    │    │ Zarr Store      │         │
│  │ (NFS Mount)     │    │ (Cloud Object)  │    │ (Cloud-Native)  │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    large-image-server Package                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  large_image_server/                                                        │
│  ├── __init__.py          # App factory, embedded viewer                   │
│  ├── __main__.py          # CLI entry point                                │
│  ├── config.py            # Pydantic settings                              │
│  ├── models.py            # API response models                            │
│  ├── source_manager.py    # TileSource caching                             │
│  └── routes/                                                               │
│      ├── tiles.py         # GET /tiles/{z}/{x}/{y}                        │
│      ├── deepzoom.py      # GET /deepzoom/{id}.dzi, {id}_files/           │
│      ├── metadata.py      # GET /metadata/{id}, /associated/{id}/{name}   │
│      └── regions.py       # GET /thumbnail/{id}, /region/{id}             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Design Modules

### 3.1 FastAPI Application Factory (MOD-TLS-001)

| Element | Description |
|:--------|:------------|
| **Module** | `large_image_server.create_app()` |
| **Responsibility** | Initialize FastAPI application with configured routes, middleware, and settings |
| **Trace to Requirements** | SYS-IMS-035 (CORS), SYS-IMS-036 (Auth), SYS-IMS-037 (OpenAPI docs) |

**Key Configuration:**
```python
app = FastAPI(title="Large Image Tile Server")
app.add_middleware(CORSMiddleware, allow_origins=config.cors_origins)
```

### 3.2 Source Manager (MOD-TLS-002)

| Element | Description |
|:--------|:------------|
| **Module** | `large_image_server.source_manager.SourceManager` |
| **Responsibility** | LRU cache management for `large_image.TileSource` objects |
| **Trace to Requirements** | SYS-IMS-031 (Source caching) |

**Design Rationale:**
- Opening a TileSource is expensive (file handle, memory mapping)
- LRU cache keeps frequently-accessed sources open
- Configurable cache size based on available memory

**Interface:**
```python
class SourceManager:
    def get_source(self, image_id: str) -> TileSource
    def close_source(self, image_id: str) -> None
    def clear_cache(self) -> None
```

### 3.3 XYZ Tile Router (MOD-TLS-003)

| Element | Description |
|:--------|:------------|
| **Module** | `large_image_server.routes.tiles` |
| **Responsibility** | Serve XYZ tiles compatible with OpenLayers/Leaflet |
| **Trace to Requirements** | SYS-IMS-010 (XYZ tiles), SYS-IMS-019, SYS-IMS-020 (encoding) |

**Endpoint:**
```
GET /tiles/{image_id}/{z}/{x}/{y}.{format}
```

**Parameters:**
- `image_id`: Slide identifier
- `z`: Pyramid level (0 = lowest resolution)
- `x, y`: Tile coordinates
- `format`: Output encoding (jpeg, png)

**Implementation:**
```python
@router.get("/tiles/{image_id}/{z}/{x}/{y}.{format}")
async def get_tile(image_id: str, z: int, x: int, y: int, format: str = "png"):
    source = source_manager.get_source(image_id)
    tile = source.getTile(x, y, z, encoding=format.upper())
    return Response(content=tile, media_type=f"image/{format}")
```

### 3.4 DeepZoom Router (MOD-TLS-004)

| Element | Description |
|:--------|:------------|
| **Module** | `large_image_server.routes.deepzoom` |
| **Responsibility** | Serve DeepZoom descriptors and tiles for OpenSeaDragon |
| **Trace to Requirements** | SYS-IMS-011, SYS-IMS-012 (DeepZoom), SYS-IMS-021 (dynamic generation) |

**Endpoints:**
```
GET /deepzoom/{image_id}.dzi           # XML descriptor
GET /deepzoom/{image_id}_files/{level}/{col}_{row}.{format}  # Tiles
```

**Design Decision — Dynamic DZI Generation:**

The system generates DeepZoom descriptors on-demand rather than creating stored .dzi files:

| Approach | Storage Cost | Cloud Operations | Complexity |
|:---------|:-------------|:-----------------|:-----------|
| Pre-generated DZI | ~50,000 files per image | High (PUT/GET per tile) | Low |
| **Dynamic DZI** | 1 file (source only) | Low (single source read) | Medium |

**Rationale:** Dynamic generation eliminates cloud storage cost explosion while maintaining OpenSeaDragon compatibility.

**Implementation:**
```python
@router.get("/deepzoom/{image_id}.dzi")
async def get_dzi_descriptor(image_id: str):
    source = source_manager.get_source(image_id)
    meta = source.getMetadata()
    dzi_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
    <Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
           Format="jpeg" Overlap="0" TileSize="{meta['tileWidth']}">
        <Size Width="{meta['sizeX']}" Height="{meta['sizeY']}"/>
    </Image>'''
    return Response(content=dzi_xml, media_type="application/xml")
```

### 3.5 Metadata Router (MOD-TLS-005)

| Element | Description |
|:--------|:------------|
| **Module** | `large_image_server.routes.metadata` |
| **Responsibility** | Serve slide metadata and associated images |
| **Trace to Requirements** | SYS-IMS-013, SYS-IMS-014, SYS-IMS-023-026 |

**Endpoints:**
```
GET /metadata/{image_id}
GET /associated/{image_id}/{name}   # name = "label", "macro"
```

**Metadata Response Schema:**
```json
{
  "sizeX": 100000,
  "sizeY": 80000,
  "tileWidth": 256,
  "tileHeight": 256,
  "levels": 10,
  "mm_x": 0.000254,
  "mm_y": 0.000254,
  "magnification": 40,
  "associatedImages": ["label", "macro"]
}
```

### 3.6 Region Extraction Router (MOD-TLS-006)

| Element | Description |
|:--------|:------------|
| **Module** | `large_image_server.routes.regions` |
| **Responsibility** | Extract thumbnails and arbitrary regions |
| **Trace to Requirements** | SYS-IMS-015, SYS-IMS-016 |

**Endpoints:**
```
GET /thumbnail/{image_id}?width=256&height=256
GET /region/{image_id}?left=1000&top=1000&width=500&height=500
```

### 3.7 Multi-Channel Support (MOD-TLS-007)

| Element | Description |
|:--------|:------------|
| **Module** | Frame and style parameter handling |
| **Responsibility** | Support multi-channel/Z-stack images with false-color compositing |
| **Trace to Requirements** | SYS-IMS-027-030 |

**Parameters:**
- `frame`: Channel or Z-plane index
- `style`: JSON object for false-color compositing

**Style JSON Example:**
```json
{
  "bands": [
    {"band": 0, "palette": "#ff0000", "min": 0, "max": 255},
    {"band": 1, "palette": "#00ff00", "min": 0, "max": 255}
  ]
}
```

## 4. Data Flow

### 4.1 Tile Request Flow

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Client     │    │ FastAPI    │    │ Source     │    │ large_image│
│ (Browser)  │    │ Router     │    │ Manager    │    │ TileSource │
└─────┬──────┘    └─────┬──────┘    └─────┬──────┘    └─────┬──────┘
      │                 │                 │                 │
      │ GET /tiles/x.svs/5/10/20.png     │                 │
      │────────────────▶│                 │                 │
      │                 │ get_source("x.svs")               │
      │                 │────────────────▶│                 │
      │                 │                 │ [cache hit?]    │
      │                 │                 │────────────────▶│
      │                 │                 │ TileSource      │
      │                 │◀────────────────│                 │
      │                 │ getTile(10, 20, 5, encoding='PNG')│
      │                 │────────────────────────────────────▶
      │                 │                 │     tile bytes  │
      │                 │◀────────────────────────────────────
      │ Response(image/png)              │                 │
      │◀────────────────│                 │                 │
```

### 4.2 Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CACHING LAYERS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 1: Browser Cache                                                     │
│  ├── Cache-Control: max-age=86400                                          │
│  └── Tiles cached in browser for 24 hours                                  │
│                                                                             │
│  Layer 2: Tile Cache (Optional)                                            │
│  ├── Redis/Memcached backend                                               │
│  ├── Key: {image_id}:{z}:{x}:{y}:{format}                                 │
│  └── TTL: configurable (default 1 hour)                                   │
│                                                                             │
│  Layer 3: Source Cache                                                      │
│  ├── In-memory LRU cache of TileSource objects                             │
│  ├── Keeps file handles open for fast random access                        │
│  └── Size: configurable (default 20 sources)                               │
│                                                                             │
│  Layer 4: OS/Filesystem Cache                                              │
│  └── Page cache for memory-mapped file regions                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. Security Considerations

### 5.1 Input Validation

| Threat | Mitigation | Trace to |
|:-------|:-----------|:---------|
| Path Traversal | Validate image_id against allowlist; no filesystem path construction from user input | SC-018 |
| Denial of Service | Rate limiting on tile requests | SC-021 |
| Unauthorized Access | JWT validation on all endpoints | SC-001, SC-002 |

### 5.2 Authentication Flow

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│ Client     │    │ Tile Server│    │ Auth Service│
└─────┬──────┘    └─────┬──────┘    └─────┬──────┘
      │                 │                 │
      │ GET /tiles/... │                 │
      │ Authorization: Bearer <JWT>      │
      │────────────────▶│                 │
      │                 │ validate(JWT)   │
      │                 │────────────────▶│
      │                 │ {valid, permissions}
      │                 │◀────────────────│
      │                 │ [check permissions]
      │ tile bytes      │                 │
      │◀────────────────│                 │
```

## 6. Deployment Architecture

### 6.1 Docker Container

```dockerfile
FROM python:3.12-slim

# Install system dependencies for OpenSlide
RUN apt-get update && apt-get install -y \
    openslide-tools \
    libvips-dev

WORKDIR /app
COPY . .
RUN pip install -e .[openslide,tiff,common]

EXPOSE 8000
CMD ["large_image_server", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.2 Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tile-server
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: tile-server
        image: tile-server:latest
        ports:
        - containerPort: 8000
        env:
        - name: IMAGE_DIR
          value: /mnt/slides
        - name: CACHE_SIZE
          value: "50"
        volumeMounts:
        - name: slides
          mountPath: /mnt/slides
          readOnly: true
```

## 7. Configuration

| Setting | Environment Variable | Default | Description |
|:--------|:--------------------|:--------|:------------|
| Image directory | `IMAGE_DIR` | `/images` | Path to slide files |
| Source cache size | `CACHE_SIZE` | `20` | Max open TileSources |
| CORS origins | `CORS_ORIGINS` | `["*"]` | Allowed origins |
| Host | `HOST` | `0.0.0.0` | Listen address |
| Port | `PORT` | `8000` | Listen port |
| Redis URL | `REDIS_URL` | `None` | Optional tile cache |

## 8. Traceability to Requirements

| Design Module | System Requirements |
|:--------------|:--------------------|
| MOD-TLS-001 (App Factory) | SYS-IMS-035, SYS-IMS-036, SYS-IMS-037 |
| MOD-TLS-002 (Source Manager) | SYS-IMS-031 |
| MOD-TLS-003 (XYZ Router) | SYS-IMS-010, SYS-IMS-019, SYS-IMS-020 |
| MOD-TLS-004 (DeepZoom Router) | SYS-IMS-011, SYS-IMS-012, SYS-IMS-021 |
| MOD-TLS-005 (Metadata Router) | SYS-IMS-013, SYS-IMS-014, SYS-IMS-023, SYS-IMS-024, SYS-IMS-025, SYS-IMS-026 |
| MOD-TLS-006 (Region Router) | SYS-IMS-015, SYS-IMS-016 |
| MOD-TLS-007 (Multi-Channel) | SYS-IMS-027, SYS-IMS-028, SYS-IMS-029, SYS-IMS-030 |
| Format Plugins | SYS-IMS-001 through SYS-IMS-009 |
| Caching Layer | SYS-IMS-032, SYS-IMS-033, SYS-IMS-034 |
| Deployment | SYS-IMS-038 |

## 9. Dependencies

### 9.1 Core Dependencies

| Package | Version | Purpose | Assessment |
|:--------|:--------|:--------|:-----------|
| Python | >=3.10, <=3.14 | Runtime | Excellent |
| FastAPI | >=0.100 | REST framework | Excellent |
| large_image | >=1.34 | Tile source library | Excellent |
| Pillow | >=11.0 | Image encoding | Excellent |
| numpy | >=1.26 | Array operations | Excellent |
| uvicorn | >=0.30 | ASGI server | Excellent |

### 9.2 Source Plugin Dependencies

| Plugin | Dependencies | Formats | Assessment |
|:-------|:-------------|:--------|:-----------|
| openslide | openslide-python>=1.4.1, openslide-bin>=4.0 | SVS, NDPI, MRXS, SCN | Excellent |
| tiff | pylibtiff, tifftools>=1.7.0 | TIFF, PTIF | Good |
| ometiff | tifffile | OME-TIFF | Good |
| dicom | wsidicom>=0.20, pydicom>=2.4 | DICOM WSI | Good |
| zarr | zarr<3, numcodecs<0.16 | Zarr, OME-NGFF | Needs attention (Zarr 3 migration) |

### 9.3 Dependency Risks

| Risk | Impact | Mitigation |
|:-----|:-------|:-----------|
| Zarr 2.x lock-in | Medium | Monitor zarr 3.0 compatibility; plan migration |
| OpenSlide native library | Low | Available via wheels (openslide-bin) |
| GDAL unversioned | Low | Pin in requirements if needed |

## 10. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-22 | Engineering | Initial Tile Server architecture derived from library evaluation |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
