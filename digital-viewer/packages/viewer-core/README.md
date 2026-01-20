# @pathology/viewer-core

**Digital Pathology Viewer**

Svelte-based whole slide image viewer built on OpenSeadragon. Designed for clinical pathology workflows with support for tiled image viewing, navigation controls, and integration with the Large Image tile server.

Based on Pathology Portal Platform Specification v2.1.

## Features

- **OpenSeadragon Integration**: High-performance tiled image viewing
- **DeepZoom Support**: Native DZI format for whole slide images
- **Svelte Components**: Reactive, lightweight UI components
- **Navigation Controls**: Zoom, pan, rotate, and magnification display
- **Scale Bar**: Calibrated measurements based on slide metadata
- **Thumbnail Navigator**: Mini-map for orientation
- **Keyboard Shortcuts**: Standard pathology viewer controls
- **Responsive Design**: Works across desktop and tablet devices

## Installation

```bash
npm install @pathology/viewer-core
```

## Quick Start

```svelte
<script>
  import { Viewer, ScaleBar, ViewerToolbar } from '@pathology/viewer-core';

  let slideId = 'my-slide.svs';

  function handleOpen(event) {
    console.log('Slide opened:', event.detail.metadata);
  }

  function handleViewportChange(event) {
    console.log('Viewport:', event.detail.viewport);
  }
</script>

<div class="viewer-container">
  <Viewer
    {slideId}
    config={{ tileServerUrl: 'http://localhost:8000' }}
    on:open={handleOpen}
    on:viewport-change={handleViewportChange}
  />
  <ScaleBar />
  <ViewerToolbar />
</div>

<style>
  .viewer-container {
    position: relative;
    width: 100%;
    height: 100vh;
  }
</style>
```

## Components

### Viewer

Main viewer component that wraps OpenSeadragon:

```svelte
<Viewer
  slideId="slide-12345"
  config={{
    tileServerUrl: 'http://localhost:8000',
    prefetchEnabled: true,
    debugMode: false,
  }}
  on:open={handleOpen}
  on:viewport-change={handleViewportChange}
  on:zoom={handleZoom}
  on:pan={handlePan}
/>
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `slideId` | `string` | Slide identifier for tile server |
| `config` | `ViewerConfig` | Viewer configuration |

#### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `open` | `{ metadata: SlideMetadata }` | Slide loaded successfully |
| `viewport-change` | `{ viewport: ViewportState }` | Viewport changed |
| `zoom` | `{ zoom: number }` | Zoom level changed |
| `pan` | `{ center: Point }` | View panned |
| `rotate` | `{ rotation: number }` | View rotated |
| `error` | `{ error: Error }` | Error occurred |

### ScaleBar

Displays calibrated scale bar when magnification data is available:

```svelte
<ScaleBar
  position="bottom-left"
  style="line"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `string` | `'bottom-left'` | Position on viewer |
| `style` | `'line' \| 'bar'` | `'line'` | Visual style |

### ViewerToolbar

Navigation and tool controls:

```svelte
<ViewerToolbar
  position="top-right"
  showZoomSlider={true}
  showRotation={true}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `string` | `'top-right'` | Position on viewer |
| `showZoomSlider` | `boolean` | `true` | Show zoom slider |
| `showRotation` | `boolean` | `true` | Show rotation controls |
| `showFullscreen` | `boolean` | `true` | Show fullscreen button |

### ThumbnailNavigator

Mini-map showing current viewport position:

```svelte
<ThumbnailNavigator
  position="bottom-right"
  width={200}
  height={150}
/>
```

## Configuration

```typescript
interface ViewerConfig {
  /** Tile server base URL */
  tileServerUrl: string;

  /** Default zoom level */
  defaultZoom: number;

  /** Minimum zoom level */
  minZoom: number;

  /** Maximum zoom level */
  maxZoom: number;

  /** Enable tile prefetching */
  prefetchEnabled: boolean;

  /** Show debug overlays */
  debugMode: boolean;

  /** Animation duration (ms) */
  animationTime: number;

  /** Enable keyboard navigation */
  keyboardEnabled: boolean;

  /** Enable mouse wheel zoom */
  mouseWheelEnabled: boolean;

  /** Pixel density for high-DPI displays */
  pixelDensityRatio: number;
}
```

### Default Configuration

```typescript
const DEFAULT_VIEWER_CONFIG: ViewerConfig = {
  tileServerUrl: 'http://localhost:8000',
  defaultZoom: 1,
  minZoom: 0.5,
  maxZoom: 100,
  prefetchEnabled: true,
  debugMode: false,
  animationTime: 300,
  keyboardEnabled: true,
  mouseWheelEnabled: true,
  pixelDensityRatio: window.devicePixelRatio || 1,
};
```

## Stores

Reactive Svelte stores for viewer state:

```typescript
import {
  viewerInstance,
  viewportState,
  slideMetadata,
  isLoading,
  viewerError,
} from '@pathology/viewer-core';

// Subscribe to viewport changes
viewportState.subscribe((state) => {
  console.log('Zoom:', state.zoom);
  console.log('Center:', state.center);
  console.log('Rotation:', state.rotation);
});

// Check loading state
$: if ($isLoading) {
  showSpinner();
}

// Access slide metadata
$: magnification = $slideMetadata?.magnification;
```

### Available Stores

| Store | Type | Description |
|-------|------|-------------|
| `viewerInstance` | `OSDViewer \| null` | OpenSeadragon viewer instance |
| `viewportState` | `ViewportState` | Current viewport (zoom, center, rotation) |
| `slideMetadata` | `SlideMetadata \| null` | Loaded slide metadata |
| `isLoading` | `boolean` | Loading state |
| `viewerError` | `Error \| null` | Current error |
| `overlayLayers` | `OverlayLayer[]` | Active overlay layers |

## Tile Source Factory

Create tile sources for different formats:

```typescript
import { TileSourceFactory, fetchSlideMetadata } from '@pathology/viewer-core';

// Fetch metadata from tile server
const metadata = await fetchSlideMetadata('http://localhost:8000', 'slide.svs');

// Create DeepZoom tile source
const tileSource = TileSourceFactory.createDeepZoom(
  'http://localhost:8000',
  'slide.svs',
  metadata
);
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom |
| `Arrow keys` | Pan |
| `r` | Rotate 90° clockwise |
| `R` (shift+r) | Rotate 90° counter-clockwise |
| `f` | Toggle fullscreen |
| `h` | Home (reset view) |

## Integration with Tile Server

The viewer is designed to work with the Large Image tile server:

```typescript
// Tile server endpoints used:
// GET /deepzoom/{slideId}.dzi    - DZI descriptor
// GET /deepzoom/{slideId}_files/{level}/{x}_{y}.jpeg - Tiles
// GET /metadata/{slideId}        - Slide metadata
// GET /thumbnail/{slideId}       - Thumbnail image
```

### Starting the Tile Server

```bash
# From large_image repository root
source .venv/bin/activate
large_image_server --image-dir /path/to/slides --port 8000
```

See [utilities/server/README.md](../../../utilities/server/README.md) for full tile server documentation.

## Types

### SlideMetadata

```typescript
interface SlideMetadata {
  sizeX: number;           // Width in pixels
  sizeY: number;           // Height in pixels
  tileWidth: number;       // Tile width
  tileHeight: number;      // Tile height
  levels: number;          // Number of zoom levels
  magnification?: number;  // Objective magnification (e.g., 40)
  mm_x?: number;           // Microns per pixel (X)
  mm_y?: number;           // Microns per pixel (Y)
}
```

### ViewportState

```typescript
interface ViewportState {
  zoom: number;            // Current zoom level
  center: { x: number; y: number };  // Center point (0-1)
  rotation: number;        // Rotation in degrees
  bounds: {                // Visible bounds
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Example: Full Application

```svelte
<script>
  import {
    Viewer,
    ScaleBar,
    ViewerToolbar,
    ThumbnailNavigator,
    viewportState,
    slideMetadata,
  } from '@pathology/viewer-core';
  import { AnnotationCanvas } from '@pathology/annotations';
  import { FocusDeclarationProtocol } from '@pathology/fdp-lib';

  export let slideId;
  export let caseContext;

  let fdp;

  onMount(() => {
    fdp = new FocusDeclarationProtocol({ diagnosticMode: true });
    fdp.initialize(caseContext);
  });

  onDestroy(() => {
    fdp?.destroy();
  });
</script>

<div class="pathology-viewer">
  <Viewer {slideId} />
  <ScaleBar />
  <ViewerToolbar />
  <ThumbnailNavigator />
  <AnnotationCanvas
    width={$slideMetadata?.sizeX}
    height={$slideMetadata?.sizeY}
    viewportTransform={$viewportState}
  />
</div>
```

## License

Apache-2.0
