/**
 * Annotation System - Geometry Utilities
 *
 * Functions for creating and manipulating GeoJSON geometries
 */

import type { Feature, Point, LineString, Polygon, Geometry } from 'geojson';
import type {
  Annotation,
  AnnotationMeasurements,
  AnnotationProperties,
  AnnotationStyle,
  AnnotationType,
} from './types';
import { DEFAULT_STYLES } from './types';

/** Generate unique annotation ID */
export function generateAnnotationId(): string {
  return `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Create a point annotation */
export function createPoint(
  x: number,
  y: number,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [x, y],
    },
    properties: {
      id,
      type: 'point',
      style: { ...DEFAULT_STYLES.point, ...properties?.style },
      createdAt: now,
      updatedAt: now,
      ...properties,
    },
  };
}

/** Create a rectangle annotation from two corners */
export function createRectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY], // Close the ring
        ],
      ],
    },
    properties: {
      id,
      type: 'rectangle',
      style: { ...DEFAULT_STYLES.rectangle, ...properties?.style },
      createdAt: now,
      updatedAt: now,
      ...properties,
    },
  };
}

/** Create an ellipse annotation (approximated as polygon) */
export function createEllipse(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  numPoints = 64,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  const coordinates: number[][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    coordinates.push([x, y]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: {
      id,
      type: 'ellipse',
      style: { ...DEFAULT_STYLES.ellipse, ...properties?.style },
      metadata: { centerX, centerY, radiusX, radiusY },
      createdAt: now,
      updatedAt: now,
      ...properties,
    },
  };
}

/** Create a polygon annotation from points */
export function createPolygon(
  points: Array<{ x: number; y: number }>,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  // Close the polygon if not already closed
  const coordinates = points.map((p) => [p.x, p.y]);
  if (
    coordinates.length > 0 &&
    (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
      coordinates[0][1] !== coordinates[coordinates.length - 1][1])
  ) {
    coordinates.push([...coordinates[0]]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: {
      id,
      type: 'polygon',
      style: { ...DEFAULT_STYLES.polygon, ...properties?.style },
      createdAt: now,
      updatedAt: now,
      ...properties,
    },
  };
}

/** Create a polyline annotation from points */
export function createPolyline(
  points: Array<{ x: number; y: number }>,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.x, p.y]),
    },
    properties: {
      id,
      type: 'polyline',
      style: { ...DEFAULT_STYLES.polyline, ...properties?.style },
      createdAt: now,
      updatedAt: now,
      ...properties,
    },
  };
}

/** Create a freehand annotation (simplified polyline/polygon) */
export function createFreehand(
  points: Array<{ x: number; y: number }>,
  closed = true,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  // Simplify the points using Douglas-Peucker algorithm
  const simplified = simplifyPoints(points, 1);

  if (closed && simplified.length >= 3) {
    const coordinates = simplified.map((p) => [p.x, p.y]);
    coordinates.push([...coordinates[0]]); // Close the ring

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
      properties: {
        id,
        type: 'freehand',
        style: { ...DEFAULT_STYLES.freehand, ...properties?.style },
        createdAt: now,
        updatedAt: now,
        ...properties,
      },
    };
  } else {
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplified.map((p) => [p.x, p.y]),
      },
      properties: {
        id,
        type: 'freehand',
        style: { ...DEFAULT_STYLES.freehand, ...properties?.style },
        createdAt: now,
        updatedAt: now,
        ...properties,
      },
    };
  }
}

/** Create an arrow annotation */
export function createArrow(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [startX, startY],
        [endX, endY],
      ],
    },
    properties: {
      id,
      type: 'arrow',
      style: { ...DEFAULT_STYLES.arrow, ...properties?.style },
      metadata: { hasArrowHead: true },
      createdAt: now,
      updatedAt: now,
      ...properties,
    },
  };
}

/** Create a ruler annotation (line with measurements) */
export function createRuler(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  mpp?: number,
  properties?: Partial<AnnotationProperties>
): Annotation {
  const id = properties?.id || generateAnnotationId();
  const now = new Date().toISOString();

  // Calculate length
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthPixels = Math.sqrt(dx * dx + dy * dy);
  const lengthMicrons = mpp ? lengthPixels * mpp : undefined;

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [startX, startY],
        [endX, endY],
      ],
    },
    properties: {
      id,
      type: 'ruler',
      style: { ...DEFAULT_STYLES.ruler, ...properties?.style },
      measurements: {
        length: lengthMicrons,
      },
      createdAt: now,
      updatedAt: now,
      ...properties,
    },
  };
}

/** Douglas-Peucker line simplification */
function simplifyPoints(
  points: Array<{ x: number; y: number }>,
  tolerance: number
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance
  let maxDist = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPoints(points.slice(maxIndex), tolerance);

    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

/** Calculate perpendicular distance from point to line */
function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  }

  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
    (dx * dx + dy * dy);

  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;

  return Math.sqrt(
    Math.pow(point.x - nearestX, 2) + Math.pow(point.y - nearestY, 2)
  );
}

/** Calculate measurements for an annotation */
export function calculateMeasurements(
  annotation: Annotation,
  mpp?: number
): AnnotationMeasurements {
  const measurements: AnnotationMeasurements = {};
  const geometry = annotation.geometry;

  if (geometry.type === 'Point') {
    measurements.centroid = {
      x: geometry.coordinates[0],
      y: geometry.coordinates[1],
    };
  } else if (geometry.type === 'LineString') {
    let length = 0;
    const coords = geometry.coordinates;

    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      length += Math.sqrt(dx * dx + dy * dy);
    }

    measurements.length = mpp ? length * mpp : length;
    measurements.centroid = {
      x: (coords[0][0] + coords[coords.length - 1][0]) / 2,
      y: (coords[0][1] + coords[coords.length - 1][1]) / 2,
    };
  } else if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];

    // Calculate area using shoelace formula
    let area = 0;
    let perimeter = 0;
    let centroidX = 0;
    let centroidY = 0;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let i = 0; i < ring.length - 1; i++) {
      const x1 = ring[i][0];
      const y1 = ring[i][1];
      const x2 = ring[i + 1][0];
      const y2 = ring[i + 1][1];

      area += x1 * y2 - x2 * y1;
      centroidX += (x1 + x2) * (x1 * y2 - x2 * y1);
      centroidY += (y1 + y2) * (x1 * y2 - x2 * y1);

      const dx = x2 - x1;
      const dy = y2 - y1;
      perimeter += Math.sqrt(dx * dx + dy * dy);

      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x1);
      maxY = Math.max(maxY, y1);
    }

    area = Math.abs(area) / 2;
    centroidX = centroidX / (6 * area);
    centroidY = centroidY / (6 * area);

    measurements.area = mpp ? area * mpp * mpp : area;
    measurements.perimeter = mpp ? perimeter * mpp : perimeter;
    measurements.centroid = { x: Math.abs(centroidX), y: Math.abs(centroidY) };
    measurements.boundingBox = { minX, minY, maxX, maxY };
  }

  return measurements;
}

/** Check if a point is inside an annotation */
export function pointInAnnotation(
  x: number,
  y: number,
  annotation: Annotation,
  tolerance = 5
): boolean {
  const geometry = annotation.geometry;

  if (geometry.type === 'Point') {
    const dx = x - geometry.coordinates[0];
    const dy = y - geometry.coordinates[1];
    return Math.sqrt(dx * dx + dy * dy) <= tolerance;
  } else if (geometry.type === 'LineString') {
    return pointNearLine(x, y, geometry.coordinates, tolerance);
  } else if (geometry.type === 'Polygon') {
    return pointInPolygon(x, y, geometry.coordinates[0]);
  }

  return false;
}

/** Check if point is near a line */
function pointNearLine(
  x: number,
  y: number,
  coords: number[][],
  tolerance: number
): boolean {
  for (let i = 1; i < coords.length; i++) {
    const dist = perpendicularDistance(
      { x, y },
      { x: coords[i - 1][0], y: coords[i - 1][1] },
      { x: coords[i][0], y: coords[i][1] }
    );
    if (dist <= tolerance) return true;
  }
  return false;
}

/** Ray casting algorithm for point in polygon */
function pointInPolygon(x: number, y: number, ring: number[][]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}
