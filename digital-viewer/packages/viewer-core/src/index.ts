/**
 * Viewer Core
 *
 * Digital Pathology Viewer built with Svelte and OpenSeadragon.
 *
 * Based on Pathology Portal Platform Specification v2.1
 *
 * @example
 * ```svelte
 * <script>
 *   import { Viewer, ScaleBar, ViewerToolbar } from '@pathology/viewer-core';
 * </script>
 *
 * <div class="viewer-wrapper">
 *   <Viewer
 *     slideId="slide-12345"
 *     config={{ tileServerUrl: 'http://localhost:8000' }}
 *     on:open={(e) => console.log('Opened:', e.detail.metadata)}
 *   />
 *   <ScaleBar />
 *   <ViewerToolbar />
 * </div>
 * ```
 */

// Components
export * from './components';

// Stores
export * from './stores';

// Tile Source
export { TileSourceFactory, fetchSlideMetadata } from './tile-source';

// API Client
export {
  TileServerClient,
  configureApiClient,
  getApiClient,
  type ApiClientConfig,
  type CaseSummary,
  type CaseDetails,
  type SlideInfo,
  type SlideWithContext,
  type WorklistItem,
  type SlideMetadata as ApiSlideMetadata,
} from './api-client';

// Types
export type {
  Annotation,
  AnnotationType,
  CaseContext,
  NavigationAction,
  OSDViewer,
  OverlayLayer,
  SlideMetadata,
  TileSourceConfig,
  ViewerConfig,
  ViewerEvent,
  ViewerEventListener,
  ViewerEventType,
  ViewportState,
} from './types';

export { DEFAULT_VIEWER_CONFIG } from './types';
