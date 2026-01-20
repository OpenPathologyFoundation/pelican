# Large Image Server

A FastAPI-based tile server for the large_image library, providing REST
API endpoints for serving tiles from large multi-resolution images
including pathology whole slide images (WSI).

## Features

- **XYZ Tile Endpoints**: Standard slippy map tile URLs compatible with
  OpenLayers, Leaflet
- **DeepZoom Support**: Dynamic DZI generation for OpenSeaDragon viewers
- **Metadata API**: JSON metadata for image dimensions, tile sizes,
  magnification
- **Associated Images**: Access to label, macro, and thumbnail images
- **Region Extraction**: Extract arbitrary regions at any scale
- **Multi-format Support**: Serves tiles as JPEG, PNG, or TIFF
- **Source Caching**: Efficient tile source management with configurable
  caching
- **CORS Support**: Built-in CORS middleware for browser-based viewers
- **Frame Support**: Multi-channel, Z-stack, and time-series image
  support

## Installation

``` bash
pip install large-image-server

# With common image format support
pip install large-image-server[common]

# With all format sources
pip install large-image-server[all]
```

## Quick Start

**Command Line:**

``` bash
# Serve images from a directory
large_image_server --image-dir /path/to/images --port 8000

# With Redis caching
large_image_server --image-dir /path/to/images --cache-backend redis
```

**Python:**

``` python
from large_image_server import create_app

app = create_app(image_dir="/path/to/images")

# Run with uvicorn
import uvicorn
uvicorn.run(app, host="0.0.0.0", port=8000)
```

## API Endpoints

### XYZ Tiles

``` 
GET /tiles/{image_id}/{z}/{x}/{y}.{format}
GET /tiles/{image_id}/{z}/{x}/{y}.{format}?frame={frame}&style={style}
```

### DeepZoom (OpenSeaDragon)

``` 
GET /deepzoom/{image_id}.dzi
GET /deepzoom/{image_id}_files/{level}/{col}_{row}.{format}
```

### Metadata

``` 
GET /metadata/{image_id}
GET /metadata/{image_id}/internal
```

### Associated Images

``` 
GET /associated/{image_id}
GET /associated/{image_id}/{name}
```

### Regions

``` 
GET /region/{image_id}?left=0&top=0&right=1000&bottom=1000
GET /thumbnail/{image_id}?width=256&height=256
```

## OpenSeaDragon Integration

``` javascript
var viewer = OpenSeaDragon({
    id: "viewer",
    tileSources: "http://localhost:8000/deepzoom/slide.svs.dzi"
});
```

## OpenLayers Integration

``` javascript
var source = new ol.source.XYZ({
    url: 'http://localhost:8000/tiles/slide.svs/{z}/{x}/{y}.png',
    tileSize: 256,
    maxZoom: metadata.levels - 1
});
```

## License

Apache-2.0
