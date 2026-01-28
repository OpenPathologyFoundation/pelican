/**
 * Viewer Core Components
 *
 * Re-exports all Svelte components
 */

// Core viewer
export { default as Viewer } from './Viewer.svelte';
export { default as ScaleBar } from './ScaleBar.svelte';
export { default as ViewerToolbar } from './ViewerToolbar.svelte';
export { default as SlideInfo } from './SlideInfo.svelte';

// FDP components
export { default as CaseBanner } from './CaseBanner.svelte';
export { default as CaseIndicator } from './CaseIndicator.svelte';

// Case management
export { default as CaseSearch } from './CaseSearch.svelte';
export { default as CaseSwitchDialog } from './CaseSwitchDialog.svelte';
export { default as SlideGallery } from './SlideGallery.svelte';

// Measurement components (SRS SYS-MSR-*)
export { default as MeasurementToolbar } from './MeasurementToolbar.svelte';
export { default as MeasurementOverlay } from './MeasurementOverlay.svelte';
export { default as CalibrationBadge } from './CalibrationBadge.svelte';

// Tools panel (SRS SYS-UI-001, SYS-UI-002, SYS-MSR-*)
export { default as ViewerToolsPanel } from './ViewerToolsPanel.svelte';

// Error handling components (SRS SYS-ERR-*)
export { default as ErrorOverlay } from './ErrorOverlay.svelte';
export { default as SupersessionNotice } from './SupersessionNotice.svelte';
export { default as ReauthPrompt } from './ReauthPrompt.svelte';

// Diagnostic mode components (SRS SYS-DXM-*)
export { default as DxModeAttestation } from './DxModeAttestation.svelte';

// Bookmark components (SRS UN-WFL-001)
export { default as BookmarkPanel } from './BookmarkPanel.svelte';
export { default as BookmarkCard } from './BookmarkCard.svelte';

// Keyboard shortcuts components (SRS UN-WFL-002)
export { default as ShortcutsHelp } from './ShortcutsHelp.svelte';

// Slide label components (SRS UN-SAF-006)
export { default as SlideLabel } from './SlideLabel.svelte';

// Main application shell
export { default as PathologyViewer } from './PathologyViewer.svelte';
