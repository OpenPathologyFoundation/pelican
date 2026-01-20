# @pathology/annotations

**GeoJSON-Based Annotation System**

A comprehensive annotation system for digital pathology using GeoJSON format. Supports various annotation types including points, rectangles, polygons, rulers, and freehand drawings with automatic measurement calculations.

Based on Pathology Portal Platform Specification v2.1, Section 6.2.

## Features

- **GeoJSON Format**: Standard-compliant annotation storage
- **Multiple Annotation Types**: Point, rectangle, ellipse, polygon, polyline, freehand, arrow, ruler
- **Automatic Measurements**: Area, perimeter, and length calculations
- **Calibrated Units**: Measurements in microns when calibration data is available
- **Layer Management**: Organize annotations into named layers
- **Selection & Editing**: Interactive selection and modification
- **Drawing Tools**: Built-in drawing state management
- **Classification Support**: Attach diagnostic classifications to annotations

## Installation

```bash
npm install @pathology/annotations
```

## Quick Start

```svelte
<script>
  import {
    AnnotationCanvas,
    annotationLayers,
    startDrawing,
    addAnnotation,
    createRectangle,
  } from '@pathology/annotations';

  // Create a rectangle annotation programmatically
  const rect = createRectangle(
    [100, 100],           // Top-left corner
    [300, 200],           // Bottom-right corner
    0.00025,              // Microns per pixel
    { label: 'Region of Interest' }
  );

  addAnnotation(rect, 'default');

  function handleCreate(event) {
    console.log('Annotation created:', event.detail.annotation);
  }

  function handleSelect(event) {
    console.log('Selected:', event.detail.annotationId);
  }
</script>

<AnnotationCanvas
  width={slideWidth}
  height={slideHeight}
  viewportTransform={currentViewport}
  on:annotation-created={handleCreate}
  on:annotation-selected={handleSelect}
/>
```

## Annotation Types

### Point

Single point marker:

```typescript
import { createPoint } from '@pathology/annotations';

const point = createPoint(
  [500, 300],              // Coordinates [x, y]
  0.00025,                 // Microns per pixel
  { label: 'Mitotic figure' }
);
```

### Rectangle

Axis-aligned bounding box:

```typescript
import { createRectangle } from '@pathology/annotations';

const rect = createRectangle(
  [100, 100],              // Top-left [x, y]
  [400, 300],              // Bottom-right [x, y]
  0.00025,
  { label: 'Tumor region' }
);

// Measurements included:
// - area (square microns)
// - perimeter (microns)
// - width, height
```

### Ellipse

Elliptical annotation:

```typescript
import { createEllipse } from '@pathology/annotations';

const ellipse = createEllipse(
  [300, 200],              // Center [x, y]
  150,                     // Radius X (pixels)
  100,                     // Radius Y (pixels)
  0.00025,
  { label: 'Cell nucleus' }
);
```

### Polygon

Closed polygon with multiple vertices:

```typescript
import { createPolygon } from '@pathology/annotations';

const polygon = createPolygon(
  [[100, 100], [200, 50], [300, 100], [250, 200], [150, 200]],
  0.00025,
  { label: 'Tissue boundary' }
);
```

### Polyline

Open path (not closed):

```typescript
import { createPolyline } from '@pathology/annotations';

const polyline = createPolyline(
  [[100, 100], [200, 150], [300, 100]],
  0.00025,
  { label: 'Vessel path' }
);
```

### Freehand

Smooth freehand drawing:

```typescript
import { createFreehand } from '@pathology/annotations';

const freehand = createFreehand(
  [[100, 100], [102, 103], [105, 108], /* ... more points */],
  0.00025,
  { label: 'Freehand outline' }
);
```

### Arrow

Directional arrow:

```typescript
import { createArrow } from '@pathology/annotations';

const arrow = createArrow(
  [100, 100],              // Start point
  [300, 200],              // End point (arrow head)
  0.00025,
  { label: 'Direction indicator' }
);
```

### Ruler

Measurement line with length:

```typescript
import { createRuler } from '@pathology/annotations';

const ruler = createRuler(
  [100, 100],              // Start point
  [400, 100],              // End point
  0.00025,
  { label: 'Distance measurement' }
);

// ruler.properties.measurements.length = 750 (microns)
```

## Layer Management

Organize annotations into layers:

```typescript
import {
  annotationLayers,
  addAnnotation,
  removeAnnotation,
  getLayerAnnotations,
  setLayerVisibility,
  clearLayer,
} from '@pathology/annotations';

// Subscribe to layer changes
annotationLayers.subscribe((layers) => {
  console.log('Active layers:', Object.keys(layers));
});

// Add annotation to a layer
addAnnotation(annotation, 'tumor-regions');

// Get all annotations in a layer
const annotations = getLayerAnnotations('tumor-regions');

// Toggle layer visibility
setLayerVisibility('tumor-regions', false);

// Clear all annotations in a layer
clearLayer('tumor-regions');
```

## Drawing State

Manage interactive drawing:

```typescript
import {
  drawingState,
  startDrawing,
  updateDrawing,
  finishDrawing,
  cancelDrawing,
} from '@pathology/annotations';

// Start drawing a polygon
startDrawing('polygon');

// Check current drawing state
drawingState.subscribe((state) => {
  if (state.isDrawing) {
    console.log('Drawing:', state.activeType);
    console.log('Points:', state.points);
  }
});

// Add points during drawing
updateDrawing([150, 200]);

// Complete the annotation
const annotation = finishDrawing(0.00025);

// Or cancel
cancelDrawing();
```

## Selection

Handle annotation selection:

```typescript
import {
  selectionState,
  selectAnnotation,
  deselectAnnotation,
  clearSelection,
  getSelectedAnnotations,
} from '@pathology/annotations';

// Select an annotation
selectAnnotation('annotation-id-123');

// Multi-select
selectAnnotation('annotation-id-456', { addToSelection: true });

// Get selected annotations
const selected = getSelectedAnnotations();

// Clear selection
clearSelection();

// Subscribe to selection changes
selectionState.subscribe((state) => {
  console.log('Selected IDs:', state.selectedIds);
});
```

## Hit Testing

Check if a point is inside an annotation:

```typescript
import { pointInAnnotation } from '@pathology/annotations';

const isInside = pointInAnnotation(
  [250, 175],        // Point to test
  annotation         // Annotation to check against
);

if (isInside) {
  selectAnnotation(annotation.id);
}
```

## Measurements

Automatic measurement calculation:

```typescript
import { calculateMeasurements } from '@pathology/annotations';

const measurements = calculateMeasurements(annotation, 0.00025);

// For rectangles/polygons:
console.log('Area:', measurements.area, 'square microns');
console.log('Perimeter:', measurements.perimeter, 'microns');

// For lines/rulers:
console.log('Length:', measurements.length, 'microns');

// For points:
console.log('Position:', measurements.centroid);
```

## Classifications

Attach diagnostic classifications:

```typescript
import { PATHOLOGY_CLASSIFICATIONS } from '@pathology/annotations';

// Available classifications
const classifications = PATHOLOGY_CLASSIFICATIONS;
// [
//   { id: 'tumor', label: 'Tumor', color: '#ff0000' },
//   { id: 'necrosis', label: 'Necrosis', color: '#808080' },
//   { id: 'stroma', label: 'Stroma', color: '#00ff00' },
//   { id: 'inflammation', label: 'Inflammation', color: '#ffff00' },
//   ...
// ]

// Create annotation with classification
const annotation = createPolygon(points, mpp, {
  classification: {
    id: 'tumor',
    label: 'Tumor',
    confidence: 0.95,
  },
});
```

## Styles

Customize annotation appearance:

```typescript
import { DEFAULT_STYLES } from '@pathology/annotations';

const customStyle = {
  ...DEFAULT_STYLES,
  strokeColor: '#ff0000',
  strokeWidth: 2,
  fillColor: 'rgba(255, 0, 0, 0.2)',
  pointRadius: 6,
};

const annotation = createRectangle(p1, p2, mpp, {
  style: customStyle,
});
```

### Default Styles

```typescript
const DEFAULT_STYLES = {
  strokeColor: '#00ff00',
  strokeWidth: 2,
  fillColor: 'rgba(0, 255, 0, 0.1)',
  selectedStrokeColor: '#ffff00',
  selectedStrokeWidth: 3,
  pointRadius: 5,
  arrowHeadSize: 15,
};
```

## GeoJSON Format

Annotations use standard GeoJSON with extensions:

```json
{
  "type": "Feature",
  "id": "ann-abc123",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[100, 100], [200, 100], [200, 200], [100, 200], [100, 100]]]
  },
  "properties": {
    "annotationType": "rectangle",
    "label": "Region of Interest",
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": "user-123",
    "style": {
      "strokeColor": "#00ff00",
      "fillColor": "rgba(0, 255, 0, 0.1)"
    },
    "measurements": {
      "area": 2500000,
      "perimeter": 20000,
      "unit": "um"
    },
    "classification": {
      "id": "tumor",
      "label": "Tumor",
      "confidence": 0.95
    }
  }
}
```

## Components

### AnnotationCanvas

Main canvas component for rendering and interaction:

```svelte
<AnnotationCanvas
  width={50000}
  height={40000}
  viewportTransform={viewport}
  enableDrawing={true}
  enableSelection={true}
  on:annotation-created={handleCreate}
  on:annotation-selected={handleSelect}
  on:annotation-modified={handleModify}
  on:annotation-deleted={handleDelete}
/>
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

## License

Apache-2.0
