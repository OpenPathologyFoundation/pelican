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
| `authToken` | `string \| null` | JWT token for authenticated tile loading |
| `authExpired` | `boolean` | Whether the JWT has expired |
| `orchestratorState` | `'connected' \| 'disconnected' \| 'lost' \| 'ended' \| null` | Orchestrator bridge lifecycle state (`null` in standalone mode) |
| `tileFailureState` | `{ thresholdExceeded: boolean; failureRate: number }` | Tile failure tracking |

## Orchestrator Bridge

The viewer-core package includes the `OrchestratorBridge` class for receiving commands from the Okapi orchestrator over `postMessage`. This is used in **orchestrated mode** when the viewer is launched as a child window by the Okapi web-client.

```typescript
import { OrchestratorBridge, type BridgeState } from '@pathology/viewer-core';
import type { InitPayload, ViewerAuditEvent } from '@pathology/viewer-core';

const bridge = new OrchestratorBridge();

bridge.onInit((payload: InitPayload) => {
  // Received JWT, case config, tile server URL
});

bridge.onTokenRefresh((token: string) => {
  // Update authToken store
});

bridge.onCaseChange((caseId: string, accession: string) => {
  // Switch to a new case
});

bridge.onStateChange((state: BridgeState) => {
  // 'waiting' | 'connected' | 'disconnected' | 'lost' | 'ended'
});

bridge.initialize(); // Sends viewer:ready, starts listening
```

### Bridge States

| State | Meaning |
|-------|---------|
| `waiting` | Bridge initialized, waiting for `orchestrator:init` |
| `connected` | Active connection with healthy heartbeat |
| `disconnected` | Heartbeat missed for >15 seconds |
| `lost` | No heartbeat for >60 seconds |
| `ended` | Orchestrator sent logout command |

### Sending Audit Events

The bridge can send audit events back to the orchestrator for backend persistence:

```typescript
bridge.sendAuditEvent({
  eventType: 'VIEWER_SLIDE_VIEWED',
  caseId: 'case-123',
  slideId: 'slide-456',
  accessionNumber: 'ACC-789',
  occurredAt: new Date().toISOString(),
});
```

## ErrorOverlay Component

The `ErrorOverlay` component displays full-screen error states within the viewer. It handles both viewer-specific errors and orchestrator lifecycle states:

```svelte
<ErrorOverlay type="auth-expired" message="Session ended by workstation" />
<ErrorOverlay type="service-unavailable" message="Connection to workstation lost" />
<ErrorOverlay type="tile-failure" />
```

### Error Types

| Type | Trigger | Description |
|------|---------|-------------|
| `tile-failure` | `tileFailureState.thresholdExceeded` | >50% tile load failures |
| `service-unavailable` | `orchestratorState === 'lost'` | Orchestrator unreachable |
| `auth-expired` | `authExpired` or `orchestratorState === 'ended'` | JWT expired or session ended |
| `superseded` | Slide metadata check | Viewing an older scan version |

### Overlay Priority in Viewer.svelte

When multiple error conditions occur simultaneously, the `Viewer` component renders overlays in priority order:

1. `orchestratorState === 'ended'` (session ended — highest priority)
2. `orchestratorState === 'lost'` (connection lost)
3. `orchestratorState === 'disconnected'` (reconnecting banner, viewer still usable)
4. `authExpired` (JWT expired)
5. `tileFailureState.thresholdExceeded` (tile loading failures)

In standalone mode (when `orchestratorState` is `null`), the orchestrator overlays are skipped.

## Authenticated Tile Loading

When running in orchestrated mode, the viewer uses JWT-authenticated tile loading. The `authToken` store is set by the orchestrated `App.svelte` wrapper when tokens are received from the orchestrator. The `Viewer` component watches this store and updates the OpenSeadragon XHR headers:

```typescript
// In Viewer.svelte — $effect watches authToken changes
$effect(() => {
  const token = $authToken;
  if (viewer && token) {
    viewer.ajaxHeaders = { Authorization: `Bearer ${token}` };
  }
});
```

This requires OpenSeadragon's `loadTilesWithAjax: true` option, which uses `XMLHttpRequest` instead of `<img>` tags for tile fetching.

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

Press `?` to show the keyboard shortcuts help modal at any time.

### Navigation

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `Cmd/Ctrl + 0` | Fit to screen |
| `Home` | Go to home view |
| `Cmd/Ctrl + Z` | Undo navigation |
| `Cmd/Ctrl + Shift + Z` | Redo navigation |

### Bookmarks (ROI)

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + B` | Create bookmark at current position |
| `B` | Toggle bookmark panel |
| `N` | Go to next bookmark |
| `P` | Go to previous bookmark |

### Tools

| Key | Action |
|-----|--------|
| `T` | Toggle tools panel |
| `M` | Activate line measurement |
| `A` | Activate area measurement |

### Slides

| Key | Action |
|-----|--------|
| `[` | Previous slide |
| `]` | Next slide |

### Help

| Key | Action |
|-----|--------|
| `?` | Show keyboard shortcuts help |

## Bookmarks / Regions of Interest (ROI)

Bookmarks allow you to save and quickly navigate to specific viewport positions on a slide.

### Creating Bookmarks

1. **Via Keyboard**: Press `Cmd/Ctrl + B` to create a bookmark at your current position
2. **Via UI**: Open the Tools panel (press `T`), go to the "ROI" tab, and click "+ Save Current Position"

### Navigating to Bookmarks

1. **Via Bookmark Panel**: Press `B` to toggle the bookmark panel, then click on any bookmark to navigate to it
2. **Via ROI Tab**: In the Tools panel ROI tab, click on any bookmark in the list

### Bookmark Features

- **Edit Label**: Click the pencil icon on a bookmark to rename it
- **Delete**: Click the X icon to remove a bookmark
- **Export/Import**: Use the toolbar buttons in the bookmark panel to export bookmarks to JSON or import from a file
- **Sorting**: Sort bookmarks by creation time, name, or zoom level

### Stores

```typescript
import {
  bookmarks,
  createBookmark,
  goToBookmark,
  deleteBookmark,
  exportBookmarks,
  importBookmarks,
} from '@pathology/viewer-core';

// Create a bookmark
const bookmark = createBookmark('Interesting region', 'Found suspicious cells here');

// Navigate to a bookmark
goToBookmark(bookmark.id);

// Export bookmarks to JSON
const json = exportBookmarks();

// Import bookmarks from JSON
const count = importBookmarks(jsonString);
```

## Navigation History (Undo/Redo)

The viewer automatically records your navigation history, allowing you to undo and redo viewport changes.

### Usage

- **Undo**: Press `Cmd/Ctrl + Z` to go back to your previous viewport position
- **Redo**: Press `Cmd/Ctrl + Shift + Z` to go forward in history

### Stores

```typescript
import {
  canUndo,
  canRedo,
  undo,
  redo,
  navigationHistory,
} from '@pathology/viewer-core';

// Check if undo is available
if ($canUndo) {
  undo();
}

// Check if redo is available
if ($canRedo) {
  redo();
}
```

## Slide Label / Barcode View

View slide identification information including barcode, specimen details, and scan metadata.

### Usage

1. Open the Tools panel (press `T`)
2. In the "Zoom" tab, click the "Label" button
3. A modal will show slide information including:
   - Barcode
   - Slide ID and Scan ID
   - Specimen part, block, and stain
   - Scan date and scanner info
   - Image dimensions and resolution

### Component

```svelte
<script>
  import { SlideLabel } from '@pathology/viewer-core';
</script>

<!-- Compact button that opens modal -->
<SlideLabel mode="compact" />

<!-- Full inline display -->
<SlideLabel mode="full" showBarcode={true} showLabelImage={true} />
```

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
