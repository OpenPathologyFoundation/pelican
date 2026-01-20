/**
 * Viewer Core - Svelte Stores
 *
 * Reactive state management for the viewer
 */

import { writable, derived, type Readable, type Writable } from 'svelte/store';
import type {
  Annotation,
  CaseContext,
  OverlayLayer,
  SlideMetadata,
  ViewerConfig,
  ViewportState,
  DEFAULT_VIEWER_CONFIG,
} from './types';

/** Viewer configuration store */
export const viewerConfig: Writable<ViewerConfig> = writable({
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
});

/** Current slide metadata store */
export const slideMetadata: Writable<SlideMetadata | null> = writable(null);

/** Current slide ID */
export const currentSlideId: Writable<string | null> = writable(null);

/** Viewport state store */
export const viewportState: Writable<ViewportState> = writable({
  center: { x: 0.5, y: 0.5 },
  zoom: 1,
  rotation: 0,
  bounds: { x: 0, y: 0, width: 1, height: 1 },
});

/** Current case context (from FDP) */
export const caseContext: Writable<CaseContext | null> = writable(null);

/** Viewer ready state */
export const viewerReady: Writable<boolean> = writable(false);

/** Viewer loading state */
export const isLoading: Writable<boolean> = writable(false);

/** Viewer error state */
export const viewerError: Writable<string | null> = writable(null);

/** Diagnostic mode (FDP) */
export const diagnosticMode: Writable<boolean> = writable(false);

/** Privacy mode (FDP) */
export const privacyMode: Writable<boolean> = writable(false);

/** Annotations store */
export const annotations: Writable<Annotation[]> = writable([]);

/** Selected annotation ID */
export const selectedAnnotationId: Writable<string | null> = writable(null);

/** Active drawing tool */
export const activeDrawingTool: Writable<string | null> = writable(null);

/** Overlay layers store */
export const overlayLayers: Writable<OverlayLayer[]> = writable([]);

/** Measurement unit (for scale bar) */
export const measurementUnit: Writable<'um' | 'mm' | 'px'> = writable('um');

/** Derived: Is slide loaded */
export const isSlideLoaded: Readable<boolean> = derived(
  [slideMetadata, viewerReady],
  ([$slideMetadata, $viewerReady]) => $slideMetadata !== null && $viewerReady
);

/** Derived: Current magnification (approximate) */
export const currentMagnification: Readable<number | null> = derived(
  [slideMetadata, viewportState],
  ([$slideMetadata, $viewportState]) => {
    if (!$slideMetadata?.magnification) return null;

    // Approximate magnification based on zoom level
    // At zoom = 1, we're at the base resolution
    // Higher zoom = higher magnification
    return $slideMetadata.magnification * $viewportState.zoom;
  }
);

/** Derived: Scale bar length in microns */
export const scaleBarMicrons: Readable<number | null> = derived(
  [slideMetadata, viewportState],
  ([$slideMetadata, $viewportState]) => {
    if (!$slideMetadata?.mpp) return null;

    // Calculate how many microns a 100px bar represents at current zoom
    const pixelsPerMicron = 1 / $slideMetadata.mpp;
    const viewportPixelsPerImagePixel = $viewportState.zoom;
    const micronsPerViewportPixel = 1 / (pixelsPerMicron * viewportPixelsPerImagePixel);

    // Return a nice round number for the scale bar
    const rawMicrons = micronsPerViewportPixel * 100;

    // Round to nearest nice value
    if (rawMicrons < 1) return 1;
    if (rawMicrons < 5) return Math.round(rawMicrons);
    if (rawMicrons < 50) return Math.round(rawMicrons / 5) * 5;
    if (rawMicrons < 500) return Math.round(rawMicrons / 50) * 50;
    return Math.round(rawMicrons / 500) * 500;
  }
);

/** Derived: Selected annotation */
export const selectedAnnotation: Readable<Annotation | null> = derived(
  [annotations, selectedAnnotationId],
  ([$annotations, $selectedAnnotationId]) => {
    if (!$selectedAnnotationId) return null;
    return $annotations.find((a) => a.id === $selectedAnnotationId) || null;
  }
);

/** Derived: Visible overlay layers */
export const visibleLayers: Readable<OverlayLayer[]> = derived(
  overlayLayers,
  ($overlayLayers) => $overlayLayers.filter((l) => l.visible)
);

/** Reset all viewer state */
export function resetViewerState(): void {
  slideMetadata.set(null);
  currentSlideId.set(null);
  viewportState.set({
    center: { x: 0.5, y: 0.5 },
    zoom: 1,
    rotation: 0,
    bounds: { x: 0, y: 0, width: 1, height: 1 },
  });
  viewerReady.set(false);
  isLoading.set(false);
  viewerError.set(null);
  annotations.set([]);
  selectedAnnotationId.set(null);
  activeDrawingTool.set(null);
  overlayLayers.set([]);
}
