/**
 * Navigation History Store
 *
 * Svelte store for viewport navigation history (undo/redo)
 * Per SRS UN-WFL-001 - Navigation History
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import OpenSeadragon from 'openseadragon';
import { currentSlideId, osdViewer } from '../stores';
import type { ViewportState } from '../types';

/**
 * Maximum number of history entries to keep
 */
const MAX_HISTORY_SIZE = 50;

/**
 * Debounce time in ms - don't record every tiny movement
 */
const DEBOUNCE_MS = 500;

/**
 * Minimum zoom change to record as separate entry
 */
const MIN_ZOOM_CHANGE = 0.1;

/**
 * Minimum pan distance (in viewport coords) to record as separate entry
 */
const MIN_PAN_DISTANCE = 0.05;

/**
 * Navigation history entry
 */
export interface NavigationHistoryEntry {
  /** Viewport state snapshot */
  viewport: ViewportState;

  /** Timestamp when recorded */
  timestamp: number;

  /** Slide ID this entry belongs to */
  slideId: string;
}

/**
 * Navigation history entries
 */
export const navigationHistory: Writable<NavigationHistoryEntry[]> = writable([]);

/**
 * Current position in history (-1 = at latest)
 */
export const historyIndex: Writable<number> = writable(-1);

/**
 * Internal: timestamp of last recorded entry
 */
let lastRecordTime = 0;

/**
 * Internal: debounce timer ID
 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Internal: pending viewport to record after debounce
 */
let pendingViewport: ViewportState | null = null;

/**
 * Derived: Can undo (there are earlier entries)
 */
export const canUndo: Readable<boolean> = derived(
  [navigationHistory, historyIndex],
  ([$history, $index]) => {
    // If at latest (index = -1), can undo if history has more than 1 entry
    if ($index === -1) {
      return $history.length > 1;
    }
    // Otherwise, can undo if not at the beginning
    return $index > 0;
  }
);

/**
 * Derived: Can redo (there are later entries)
 */
export const canRedo: Readable<boolean> = derived(
  [navigationHistory, historyIndex],
  ([$history, $index]) => {
    // Can only redo if we've undone something (index != -1)
    if ($index === -1) return false;
    return $index < $history.length - 1;
  }
);

/**
 * Derived: Current history length
 */
export const historyLength: Readable<number> = derived(
  navigationHistory,
  ($history) => $history.length
);

/**
 * Check if viewport has changed significantly from last recorded
 */
function hasSignificantChange(
  newViewport: ViewportState,
  lastEntry: NavigationHistoryEntry | undefined
): boolean {
  if (!lastEntry) return true;

  const last = lastEntry.viewport;

  // Check zoom change
  const zoomChange = Math.abs(newViewport.zoom - last.zoom) / Math.max(last.zoom, 0.001);
  if (zoomChange > MIN_ZOOM_CHANGE) return true;

  // Check pan distance
  const dx = newViewport.center.x - last.center.x;
  const dy = newViewport.center.y - last.center.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > MIN_PAN_DISTANCE) return true;

  // Check rotation
  if (Math.abs(newViewport.rotation - last.rotation) > 1) return true;

  return false;
}

/**
 * Push a navigation entry to history
 * This is the internal function that actually records the entry
 */
function recordEntry(viewport: ViewportState): void {
  const slideId = get(currentSlideId);
  if (!slideId) return;

  const history = get(navigationHistory);
  const index = get(historyIndex);

  // If we've undone and then navigated, truncate forward history
  let newHistory: NavigationHistoryEntry[];
  if (index !== -1 && index < history.length - 1) {
    newHistory = history.slice(0, index + 1);
  } else {
    newHistory = [...history];
  }

  // Check for significant change
  const lastEntry = newHistory[newHistory.length - 1];
  if (!hasSignificantChange(viewport, lastEntry)) {
    return;
  }

  // Add new entry
  const entry: NavigationHistoryEntry = {
    viewport: {
      center: { ...viewport.center },
      zoom: viewport.zoom,
      rotation: viewport.rotation,
      bounds: { ...viewport.bounds },
    },
    timestamp: Date.now(),
    slideId,
  };

  newHistory.push(entry);

  // Enforce max size
  if (newHistory.length > MAX_HISTORY_SIZE) {
    newHistory = newHistory.slice(newHistory.length - MAX_HISTORY_SIZE);
  }

  navigationHistory.set(newHistory);
  historyIndex.set(-1); // Reset to latest
  lastRecordTime = Date.now();
}

/**
 * Push a navigation entry to history (debounced)
 * Call this on viewport changes
 */
export function pushNavigation(viewport: ViewportState): void {
  pendingViewport = viewport;

  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Check if enough time has passed for immediate record
  const now = Date.now();
  if (now - lastRecordTime > DEBOUNCE_MS * 2) {
    // Record immediately if it's been a while
    recordEntry(viewport);
    pendingViewport = null;
    return;
  }

  // Otherwise, debounce
  debounceTimer = setTimeout(() => {
    if (pendingViewport) {
      recordEntry(pendingViewport);
      pendingViewport = null;
    }
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

/**
 * Undo navigation - go back in history
 * Returns the viewport state to navigate to, or null if can't undo
 */
export function undo(): ViewportState | null {
  if (!get(canUndo)) return null;

  const history = get(navigationHistory);
  let index = get(historyIndex);

  // If at latest, go to second-to-last entry
  if (index === -1) {
    index = history.length - 2;
  } else {
    index = index - 1;
  }

  if (index < 0 || index >= history.length) return null;

  historyIndex.set(index);

  const entry = history[index];

  // Apply viewport
  const viewer = get(osdViewer);
  if (viewer) {
    const vp = viewer.viewport;
    vp.setRotation(entry.viewport.rotation);
    vp.panTo(
      new OpenSeadragon.Point(
        entry.viewport.center.x,
        entry.viewport.center.y
      ),
      false
    );
    vp.zoomTo(entry.viewport.zoom);
  }

  return entry.viewport;
}

/**
 * Redo navigation - go forward in history
 * Returns the viewport state to navigate to, or null if can't redo
 */
export function redo(): ViewportState | null {
  if (!get(canRedo)) return null;

  const history = get(navigationHistory);
  let index = get(historyIndex);

  // Move forward
  index = index + 1;

  if (index < 0 || index >= history.length) return null;

  // If we reach the end, reset index to -1
  if (index === history.length - 1) {
    historyIndex.set(-1);
  } else {
    historyIndex.set(index);
  }

  const entry = history[index];

  // Apply viewport
  const viewer = get(osdViewer);
  if (viewer) {
    const vp = viewer.viewport;
    vp.setRotation(entry.viewport.rotation);
    vp.panTo(
      new OpenSeadragon.Point(
        entry.viewport.center.x,
        entry.viewport.center.y
      ),
      false
    );
    vp.zoomTo(entry.viewport.zoom);
  }

  return entry.viewport;
}

/**
 * Clear all navigation history
 */
export function clearHistory(): void {
  navigationHistory.set([]);
  historyIndex.set(-1);
  lastRecordTime = 0;
  pendingViewport = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * Clear history for current slide only
 */
export function clearCurrentSlideHistory(): void {
  const slideId = get(currentSlideId);
  if (!slideId) return;

  navigationHistory.update((history) =>
    history.filter((entry) => entry.slideId !== slideId)
  );
  historyIndex.set(-1);
}

/**
 * Reset navigation history state (for slide change)
 */
export function resetNavigationHistory(): void {
  // Don't clear history, but reset index
  historyIndex.set(-1);
  pendingViewport = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
