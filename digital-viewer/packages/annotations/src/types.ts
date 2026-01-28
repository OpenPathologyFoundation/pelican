/**
 * Annotation System - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 6.2
 */

import type { Feature, Geometry, GeoJsonProperties, FeatureCollection } from 'geojson';

/** Annotation types */
export type AnnotationType =
  | 'point'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'polyline'
  | 'freehand'
  | 'arrow'
  | 'ruler';

/**
 * Annotation visibility levels (SRS SYS-ANN-004)
 * 6-level hierarchy from most restrictive to least
 */
export type AnnotationVisibility =
  | 'private' // Only author can see (default per SYS-ANN-005)
  | 'case_team' // Users assigned to this case
  | 'department' // Department members
  | 'conference' // Tumor board, case conference
  | 'external' // External consultants
  | 'published'; // Public/report inclusion

/** Visibility level display configuration */
export const VISIBILITY_DISPLAY: Record<
  AnnotationVisibility,
  { label: string; icon: string; description: string }
> = {
  private: {
    label: 'Private',
    icon: '🔒',
    description: 'Only you can see this annotation',
  },
  case_team: {
    label: 'Case Team',
    icon: '👥',
    description: 'Visible to users assigned to this case',
  },
  department: {
    label: 'Department',
    icon: '🏢',
    description: 'Visible to department members',
  },
  conference: {
    label: 'Conference',
    icon: '📋',
    description: 'Visible for tumor board or case conference',
  },
  external: {
    label: 'External',
    icon: '🌐',
    description: 'Visible to external consultants',
  },
  published: {
    label: 'Published',
    icon: '📄',
    description: 'Included in reports and publicly visible',
  },
};

/** Annotation style */
export interface AnnotationStyle {
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  lineDash?: number[];
  lineJoin?: 'miter' | 'round' | 'bevel';
  lineCap?: 'butt' | 'round' | 'square';
}

/** Default annotation styles by type */
export const DEFAULT_STYLES: Record<AnnotationType, AnnotationStyle> = {
  point: {
    strokeColor: '#3b82f6',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: '#3b82f6',
    fillOpacity: 0.8,
  },
  rectangle: {
    strokeColor: '#10b981',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: '#10b981',
    fillOpacity: 0.2,
  },
  ellipse: {
    strokeColor: '#8b5cf6',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: '#8b5cf6',
    fillOpacity: 0.2,
  },
  polygon: {
    strokeColor: '#f59e0b',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: '#f59e0b',
    fillOpacity: 0.2,
  },
  polyline: {
    strokeColor: '#ef4444',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: 'transparent',
    fillOpacity: 0,
  },
  freehand: {
    strokeColor: '#ec4899',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: '#ec4899',
    fillOpacity: 0.1,
  },
  arrow: {
    strokeColor: '#06b6d4',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: '#06b6d4',
    fillOpacity: 1,
  },
  ruler: {
    strokeColor: '#84cc16',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: 'transparent',
    fillOpacity: 0,
    lineDash: [5, 5],
  },
};

/** Annotation properties extending GeoJSON properties */
export interface AnnotationProperties extends GeoJsonProperties {
  id: string;
  type: AnnotationType;
  label?: string;
  description?: string;
  classification?: string;
  style: AnnotationStyle;
  measurements?: AnnotationMeasurements;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  modifiedBy?: string;
  locked?: boolean;
  visible?: boolean;

  // SRS SYS-ANN-003: Immutable binding to specific scan
  slideId?: string;
  scanId?: string; // Immutable - never changes after creation

  // SRS SYS-ANN-004, SYS-ANN-005: Visibility model (defaults to 'private')
  visibility: AnnotationVisibility;

  // SRS SYS-ANN-008: Soft-delete (tombstone)
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

/** Annotation measurements */
export interface AnnotationMeasurements {
  area?: number; // square microns
  perimeter?: number; // microns
  length?: number; // microns (for lines)
  centroid?: { x: number; y: number };
  boundingBox?: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Annotation as GeoJSON Feature */
export type Annotation = Feature<Geometry, AnnotationProperties>;

/** Annotation collection as GeoJSON FeatureCollection */
export type AnnotationCollection = FeatureCollection<Geometry, AnnotationProperties>;

/** Annotation group/layer */
export interface AnnotationLayer {
  id: string;
  name: string;
  description?: string;
  color: string;
  visible: boolean;
  locked: boolean;
  annotations: Annotation[];
  createdAt: string;
  updatedAt: string;
}

/** Drawing state */
export interface DrawingState {
  active: boolean;
  type: AnnotationType | null;
  points: Array<{ x: number; y: number }>;
  style: AnnotationStyle;
}

/** Selection state */
export interface SelectionState {
  selectedIds: Set<string>;
  hoveredId: string | null;
}

/** Annotation event types */
export type AnnotationEventType =
  | 'create'
  | 'update'
  | 'delete'
  | 'select'
  | 'deselect'
  | 'hover'
  | 'draw-start'
  | 'draw-update'
  | 'draw-end'
  | 'draw-cancel';

/** Annotation event */
export interface AnnotationEvent {
  type: AnnotationEventType;
  timestamp: Date;
  annotation?: Annotation;
  annotations?: Annotation[];
  point?: { x: number; y: number };
}

/** Annotation event listener */
export type AnnotationEventListener = (event: AnnotationEvent) => void;

/** Coordinate system */
export type CoordinateSystem = 'image' | 'viewport' | 'physical';

/** Annotation configuration */
export interface AnnotationConfig {
  coordinateSystem: CoordinateSystem;
  snapToPixel: boolean;
  minPointDistance: number; // pixels
  simplifyTolerance: number; // for freehand simplification
  allowOverlap: boolean;
  autoSave: boolean;
  autoSaveDebounce: number; // ms
}

/** Default annotation configuration */
export const DEFAULT_ANNOTATION_CONFIG: AnnotationConfig = {
  coordinateSystem: 'image',
  snapToPixel: false,
  minPointDistance: 3,
  simplifyTolerance: 1,
  allowOverlap: true,
  autoSave: true,
  autoSaveDebounce: 1000,
};

/** Classification category */
export interface Classification {
  id: string;
  name: string;
  color: string;
  description?: string;
  hotkey?: string;
}

/** Preset classifications for pathology */
export const PATHOLOGY_CLASSIFICATIONS: Classification[] = [
  { id: 'tumor', name: 'Tumor', color: '#ef4444', hotkey: 't' },
  { id: 'necrosis', name: 'Necrosis', color: '#6b7280', hotkey: 'n' },
  { id: 'stroma', name: 'Stroma', color: '#10b981', hotkey: 's' },
  { id: 'inflammation', name: 'Inflammation', color: '#f59e0b', hotkey: 'i' },
  { id: 'normal', name: 'Normal', color: '#3b82f6', hotkey: 'o' },
  { id: 'artifact', name: 'Artifact', color: '#8b5cf6', hotkey: 'a' },
  { id: 'other', name: 'Other', color: '#94a3b8' },
];
