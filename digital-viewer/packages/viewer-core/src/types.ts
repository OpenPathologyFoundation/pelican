/**
 * Viewer Core - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1
 */

import type OpenSeadragon from 'openseadragon';

/** Tile source configuration */
export interface TileSourceConfig {
  type: 'dzi' | 'xyz' | 'iiif' | 'large-image';
  url: string;
  tileSize?: number;
  overlap?: number;
  minLevel?: number;
  maxLevel?: number;
  width?: number;
  height?: number;
}

/** Calibration state for measurements */
export type CalibrationState =
  | 'site_calibrated'
  | 'factory'
  | 'unvalidated'
  | 'unknown';

/** MPP source */
export type MppSource = 'scanner' | 'manual';

/** Slide metadata */
export interface SlideMetadata {
  slideId: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  levels: number;
  magnification?: number;
  mpp?: number; // Microns per pixel
  mppSource?: MppSource; // Source of MPP value (SRS SYS-MSR-004)
  calibrationState?: CalibrationState; // Calibration state (SRS SYS-MSR-005)
  scanId?: string; // Specific scan identifier
  supersededBy?: string; // If this scan has been superseded
  format?: string;
  vendor?: string;
  // Label/barcode fields (SRS UN-SAF-006)
  barcode?: string; // Slide barcode text
  labelImageUrl?: string; // URL to label/macro image
  specimenPart?: string; // Specimen part identifier
  blockId?: string; // Block identifier
  stain?: string; // Stain type
  properties?: Record<string, unknown>;
}

/** Viewport state */
export interface ViewportState {
  center: { x: number; y: number };
  zoom: number;
  rotation: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** Navigation action */
export interface NavigationAction {
  type: 'pan' | 'zoom' | 'rotate' | 'goto' | 'home' | 'fit';
  target?: { x: number; y: number };
  zoom?: number;
  rotation?: number;
  bounds?: { x: number; y: number; width: number; height: number };
  immediately?: boolean;
}

/** Viewer configuration */
export interface ViewerConfig {
  // Tile server
  tileServerUrl: string;

  // OpenSeadragon options
  showNavigator: boolean;
  navigatorPosition: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  showNavigationControl: boolean;
  showZoomControl: boolean;
  showHomeControl: boolean;
  showFullPageControl: boolean;
  showRotationControl: boolean;

  // Behavior
  minZoomLevel: number;
  maxZoomLevel: number;
  defaultZoomLevel: number;
  visibilityRatio: number;
  constrainDuringPan: boolean;

  // Animation
  animationTime: number;
  springStiffness: number;

  // Debug
  debugMode: boolean;

  // FDP integration
  fdpEnabled: boolean;
  sessionServiceUrl?: string;

  // Appearance
  backgroundColor: string;
  crossOriginPolicy: 'Anonymous' | 'use-credentials' | false;
}

/** Default viewer configuration */
export const DEFAULT_VIEWER_CONFIG: ViewerConfig = {
  tileServerUrl: '/tiles',
  showNavigator: true,
  navigatorPosition: 'TOP_RIGHT',
  showNavigationControl: true,
  showZoomControl: true,
  showHomeControl: true,
  showFullPageControl: true,
  showRotationControl: true,
  minZoomLevel: 0.1,
  maxZoomLevel: 40,
  defaultZoomLevel: 1,
  visibilityRatio: 1,
  constrainDuringPan: true,
  animationTime: 0.5,
  springStiffness: 6.5,
  debugMode: false,
  fdpEnabled: true,
  backgroundColor: '#000000',
  crossOriginPolicy: 'Anonymous',
};

/** Viewer event types */
export type ViewerEventType =
  | 'ready'
  | 'open'
  | 'open-failed'
  | 'close'
  | 'viewport-change'
  | 'animation-start'
  | 'animation-finish'
  | 'zoom'
  | 'pan'
  | 'rotate'
  | 'tile-loading-started'
  | 'tile-loaded'
  | 'tile-load-failed'
  | 'navigator-click'
  | 'canvas-click'
  | 'canvas-double-click'
  | 'canvas-drag'
  | 'canvas-drag-end';

/** Viewer event data */
export interface ViewerEvent {
  type: ViewerEventType;
  timestamp: Date;
  viewport?: ViewportState;
  tile?: { level: number; x: number; y: number };
  point?: { x: number; y: number };
  originalEvent?: Event;
}

/** Viewer event listener */
export type ViewerEventListener = (event: ViewerEvent) => void;

/** Annotation types (preview for annotation system) */
export type AnnotationType =
  | 'point'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'polyline'
  | 'freehand';

/** Base annotation */
export interface Annotation {
  id: string;
  type: AnnotationType;
  geometry: GeoJSON.Geometry;
  properties: {
    label?: string;
    color?: string;
    fillColor?: string;
    strokeWidth?: number;
    opacity?: number;
    classification?: string;
    measurements?: Record<string, number>;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/** Overlay layer */
export interface OverlayLayer {
  id: string;
  name: string;
  type: 'annotation' | 'heatmap' | 'segmentation' | 'grid';
  visible: boolean;
  opacity: number;
  data?: unknown;
}

/** Case context (from FDP) */
export interface CaseContext {
  caseId: string;
  patientName: string;
  patientDob?: string;
  slideId?: string;
  studyDate?: string;
}

/** OpenSeadragon viewer reference */
export type OSDViewer = OpenSeadragon.Viewer;
