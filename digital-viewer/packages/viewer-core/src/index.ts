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

// Measurement stores
export {
  activeMeasurementTool,
  activeMeasurement,
  measurements,
  measurementDisplayUnit,
  currentCalibrationState,
  currentMpp,
  currentMppSource,
  isMeasurementBlocked,
  measurementBlockReason,
  canMeasure,
  startMeasurement,
  addMeasurementPoint,
  completeMeasurement,
  cancelMeasurement,
  saveMeasurement,
  deleteMeasurement,
  clearMeasurements,
  calculateLineDistance,
  calculatePolygonArea,
  calculateRectangleArea,
  calculateEllipseArea,
  convertToCalibrated,
  formatMeasurementValue,
  resetMeasurementState,
} from './stores/measurement';

// Bookmark stores (SRS UN-WFL-001)
export {
  bookmarks,
  activeBookmarkId,
  bookmarkSortOrder,
  bookmarkPanelVisible,
  currentSlideBookmarks,
  sortedBookmarks,
  canCreateBookmark,
  activeBookmark,
  bookmarkCount,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  goToBookmark,
  updateBookmarkPosition,
  exportBookmarks,
  importBookmarks,
  clearCurrentSlideBookmarks,
  clearAllBookmarks,
  toggleBookmarkPanel,
  resetBookmarkState,
} from './stores/bookmark';

// Keyboard shortcuts stores (SRS UN-WFL-002)
export {
  shortcuts,
  shortcutsEnabled,
  shortcutsHelpVisible,
  shortcutsByAction,
  enabledShortcuts,
  shortcutsByCategory,
  handleKeydown,
  getShortcutForAction,
  formatShortcut,
  updateShortcut,
  setShortcutEnabled,
  resetToDefaults,
  toggleShortcutsHelp,
  showShortcutsHelp,
  hideShortcutsHelp,
} from './stores/shortcuts';

// Navigation history stores (SRS UN-WFL-001)
export {
  navigationHistory,
  historyIndex,
  canUndo,
  canRedo,
  historyLength,
  pushNavigation,
  undo,
  redo,
  clearHistory,
  clearCurrentSlideHistory,
  resetNavigationHistory,
  type NavigationHistoryEntry,
} from './stores/navigation-history';

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
  type CaseSource,
  type SlideInfo,
  type SlideWithContext,
  type WorklistItem,
  type SlideMetadata as ApiSlideMetadata,
} from './api-client';

// Types
export type {
  Annotation,
  AnnotationType,
  CalibrationState,
  CaseContext,
  MppSource,
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

// Measurement types
export type {
  ActiveMeasurement,
  Measurement,
  MeasurementResult,
  MeasurementState,
  MeasurementToolConfig,
  MeasurementType,
  MeasurementUnit,
} from './types/measurement';

export { MEASUREMENT_TOOLS, CALIBRATION_DISPLAY } from './types/measurement';

// Bookmark types (SRS UN-WFL-001)
export type {
  Bookmark,
  BookmarkGroup,
  BookmarkSortOrder,
  BookmarkExport,
} from './types/bookmark';

export { BOOKMARK_COLORS } from './types/bookmark';

// Keyboard shortcuts types (SRS UN-WFL-002)
export type {
  KeyboardShortcut,
  ShortcutAction,
  ShortcutCategory,
} from './types/shortcuts';

export { DEFAULT_SHORTCUTS, SHORTCUT_CATEGORIES } from './types/shortcuts';

// Tile Failure Tracker (SRS SYS-ERR-001)
export {
  createTileFailureTracker,
  getTileFailureTracker,
  resetTileFailureTracker,
  type TileRequest,
  type TileFailureState,
  type TileFailureConfig,
} from './tile-failure-tracker';

// Tile Prefetcher (SRS SYS-VWR-005/006)
export {
  createTilePrefetcher,
  getTilePrefetcher,
  resetTilePrefetcher,
  type TilePrefetchConfig,
} from './tile-prefetcher';

// Telemetry Integration (SRS SYS-TEL-*)
export {
  configureTelemetry,
  disableTelemetry,
  telemetryEnabled,
  trackEphemeral,
  trackWorkflow,
  trackAudit,
  trackZoom,
  trackPan,
  trackRotation,
  trackToolSelect,
  trackShortcut,
  trackCaseOpened,
  trackCaseClosed,
  trackSlideViewed,
  trackAnnotationCreated,
  trackMeasurementCreated,
  trackDxModeChanged,
  trackDxModeOptOut,
  trackCaseSignOut,
  type TelemetryHandler,
  type ViewerTelemetryEvent,
} from './stores/telemetry-integration';

// Session Integration (SRS SYS-SES-*)
export {
  configureSession,
  connectSession,
  registerCase,
  deregisterCase,
  setSessionWarning,
  clearSessionWarning,
  onSessionWarning,
  updateHeartbeat,
  destroySession,
  getSessionInfo,
  sessionState,
  sessionConnected,
  hasSessionWarning,
  sessionWarning,
  createWebSocketSessionHandler,
  type SessionHandler,
  type SessionState,
  type SessionWarning,
  type SessionWarningType,
  type WebSocketSessionConfig,
} from './stores/session-integration';
