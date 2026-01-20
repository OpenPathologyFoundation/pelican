/**
 * Annotation System
 *
 * GeoJSON-based annotation system for digital pathology.
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 6.2
 *
 * @example
 * ```svelte
 * <script>
 *   import {
 *     AnnotationCanvas,
 *     annotationLayers,
 *     startDrawing,
 *     addAnnotation
 *   } from '@pathology/annotations';
 *
 *   function handleCreate(event) {
 *     console.log('Created:', event.detail.annotation);
 *   }
 * </script>
 *
 * <AnnotationCanvas
 *   {width}
 *   {height}
 *   {viewportTransform}
 *   on:annotation-created={handleCreate}
 * />
 * ```
 */

// Components
export * from './components';

// Store
export * from './store';

// Geometry utilities
export {
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
} from './geometry';

// Types
export type {
  Annotation,
  AnnotationCollection,
  AnnotationConfig,
  AnnotationEvent,
  AnnotationEventListener,
  AnnotationEventType,
  AnnotationLayer,
  AnnotationMeasurements,
  AnnotationProperties,
  AnnotationStyle,
  AnnotationType,
  Classification,
  CoordinateSystem,
  DrawingState,
  SelectionState,
} from './types';

export {
  DEFAULT_ANNOTATION_CONFIG,
  DEFAULT_STYLES,
  PATHOLOGY_CLASSIFICATIONS,
} from './types';
