/**
 * Annotation Geometry Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateAnnotationId,
  createPoint,
  createRectangle,
  createEllipse,
  createPolygon,
  createPolyline,
  createFreehand,
  createArrow,
  createRuler,
  calculateMeasurements,
  pointInAnnotation,
} from '../geometry';

describe('generateAnnotationId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateAnnotationId();
    const id2 = generateAnnotationId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^ann-\d+-[a-z0-9]+$/);
  });
});

describe('createPoint', () => {
  it('should create a point annotation', () => {
    const point = createPoint(100, 200);

    expect(point.type).toBe('Feature');
    expect(point.geometry.type).toBe('Point');
    expect(point.geometry.coordinates).toEqual([100, 200]);
    expect(point.properties.type).toBe('point');
  });

  it('should accept custom properties', () => {
    const point = createPoint(100, 200, {
      label: 'Test Point',
      classification: 'tumor',
    });

    expect(point.properties.label).toBe('Test Point');
    expect(point.properties.classification).toBe('tumor');
  });
});

describe('createRectangle', () => {
  it('should create a rectangle from two corners', () => {
    const rect = createRectangle(10, 20, 50, 80);

    expect(rect.type).toBe('Feature');
    expect(rect.geometry.type).toBe('Polygon');
    expect(rect.properties.type).toBe('rectangle');

    // Should be a closed ring
    const coords = rect.geometry.coordinates[0];
    expect(coords).toHaveLength(5); // 4 corners + closing point
    expect(coords[0]).toEqual(coords[4]); // Closed
  });

  it('should normalize corners regardless of order', () => {
    const rect1 = createRectangle(10, 20, 50, 80);
    const rect2 = createRectangle(50, 80, 10, 20);

    // Both should have the same bounding box
    const coords1 = rect1.geometry.coordinates[0];
    const coords2 = rect2.geometry.coordinates[0];

    expect(coords1[0]).toEqual(coords2[0]); // Same min corner
  });
});

describe('createEllipse', () => {
  it('should create an ellipse as a polygon', () => {
    const ellipse = createEllipse(100, 100, 50, 30, 32);

    expect(ellipse.type).toBe('Feature');
    expect(ellipse.geometry.type).toBe('Polygon');
    expect(ellipse.properties.type).toBe('ellipse');

    // Should have numPoints + 1 coordinates (closed ring)
    expect(ellipse.geometry.coordinates[0]).toHaveLength(33);
  });

  it('should store center and radii in metadata', () => {
    const ellipse = createEllipse(100, 100, 50, 30);

    expect(ellipse.properties.metadata?.centerX).toBe(100);
    expect(ellipse.properties.metadata?.centerY).toBe(100);
    expect(ellipse.properties.metadata?.radiusX).toBe(50);
    expect(ellipse.properties.metadata?.radiusY).toBe(30);
  });
});

describe('createPolygon', () => {
  it('should create a polygon from points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    const polygon = createPolygon(points);

    expect(polygon.type).toBe('Feature');
    expect(polygon.geometry.type).toBe('Polygon');
    expect(polygon.properties.type).toBe('polygon');

    // Should auto-close the polygon
    const coords = polygon.geometry.coordinates[0];
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });
});

describe('createPolyline', () => {
  it('should create a polyline from points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];

    const line = createPolyline(points);

    expect(line.type).toBe('Feature');
    expect(line.geometry.type).toBe('LineString');
    expect(line.properties.type).toBe('polyline');
    expect(line.geometry.coordinates).toHaveLength(3);
  });
});

describe('createFreehand', () => {
  it('should create a closed freehand shape as polygon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];

    const freehand = createFreehand(points, true);

    expect(freehand.properties.type).toBe('freehand');
    expect(freehand.geometry.type).toBe('Polygon');
  });

  it('should create an open freehand as linestring', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
    ];

    const freehand = createFreehand(points, false);

    expect(freehand.geometry.type).toBe('LineString');
  });
});

describe('createArrow', () => {
  it('should create an arrow annotation', () => {
    const arrow = createArrow(0, 0, 100, 100);

    expect(arrow.properties.type).toBe('arrow');
    expect(arrow.geometry.type).toBe('LineString');
    expect(arrow.properties.metadata?.hasArrowHead).toBe(true);
  });
});

describe('createRuler', () => {
  it('should create a ruler with length measurement', () => {
    const ruler = createRuler(0, 0, 100, 0, 0.5); // 100px horizontal, 0.5 mpp

    expect(ruler.properties.type).toBe('ruler');
    expect(ruler.geometry.type).toBe('LineString');
    expect(ruler.properties.measurements?.length).toBe(50); // 100 * 0.5 = 50 microns
  });

  it('should calculate diagonal length correctly', () => {
    const ruler = createRuler(0, 0, 30, 40, 1); // 3-4-5 triangle = 50px

    expect(ruler.properties.measurements?.length).toBe(50);
  });
});

describe('calculateMeasurements', () => {
  it('should calculate centroid for point', () => {
    const point = createPoint(100, 200);
    const measurements = calculateMeasurements(point);

    expect(measurements.centroid).toEqual({ x: 100, y: 200 });
  });

  it('should calculate area and perimeter for polygon', () => {
    // 100x100 square
    const polygon = createRectangle(0, 0, 100, 100);
    const measurements = calculateMeasurements(polygon, 1);

    expect(measurements.area).toBe(10000); // 100 * 100
    expect(measurements.perimeter).toBe(400); // 4 * 100
  });

  it('should calculate length for linestring', () => {
    const line = createPolyline([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const measurements = calculateMeasurements(line, 1);

    expect(measurements.length).toBe(100);
  });

  it('should apply mpp conversion', () => {
    const polygon = createRectangle(0, 0, 100, 100);
    const measurements = calculateMeasurements(polygon, 0.5); // 0.5 microns/pixel

    expect(measurements.area).toBe(2500); // 10000 * 0.5 * 0.5
    expect(measurements.perimeter).toBe(200); // 400 * 0.5
  });
});

describe('pointInAnnotation', () => {
  it('should detect point inside point annotation', () => {
    const point = createPoint(100, 100);

    expect(pointInAnnotation(100, 100, point, 10)).toBe(true);
    expect(pointInAnnotation(105, 105, point, 10)).toBe(true);
    expect(pointInAnnotation(200, 200, point, 10)).toBe(false);
  });

  it('should detect point inside polygon', () => {
    const rect = createRectangle(0, 0, 100, 100);

    expect(pointInAnnotation(50, 50, rect)).toBe(true);
    expect(pointInAnnotation(0, 0, rect)).toBe(true);
    expect(pointInAnnotation(150, 150, rect)).toBe(false);
  });

  it('should detect point near line', () => {
    const line = createPolyline([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);

    expect(pointInAnnotation(50, 0, line, 5)).toBe(true);
    expect(pointInAnnotation(50, 3, line, 5)).toBe(true);
    expect(pointInAnnotation(50, 20, line, 5)).toBe(false);
  });
});
