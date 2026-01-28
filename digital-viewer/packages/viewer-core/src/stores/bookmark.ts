/**
 * Bookmark Store
 *
 * Svelte store for bookmark state management
 * Per SRS UN-WFL-001 - Bookmarks/ROI System
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import OpenSeadragon from 'openseadragon';
import { currentSlideId, viewportState, osdViewer, slideMetadata } from '../stores';
import type { Bookmark, BookmarkSortOrder, BookmarkExport } from '../types/bookmark';
import { BOOKMARK_COLORS } from '../types/bookmark';

/**
 * Generate unique bookmark ID
 */
function generateBookmarkId(): string {
  return `bkm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * All bookmarks
 */
export const bookmarks: Writable<Bookmark[]> = writable([]);

/**
 * Currently active/selected bookmark ID
 */
export const activeBookmarkId: Writable<string | null> = writable(null);

/**
 * Sort order for bookmark list
 */
export const bookmarkSortOrder: Writable<BookmarkSortOrder> = writable('created');

/**
 * Whether bookmark panel is visible
 */
export const bookmarkPanelVisible: Writable<boolean> = writable(false);

/**
 * Derived: Bookmarks for the current slide only
 */
export const currentSlideBookmarks: Readable<Bookmark[]> = derived(
  [bookmarks, currentSlideId],
  ([$bookmarks, $currentSlideId]) => {
    if (!$currentSlideId) return [];
    return $bookmarks.filter((b) => b.slideId === $currentSlideId);
  }
);

/**
 * Derived: Sorted bookmarks for display
 */
export const sortedBookmarks: Readable<Bookmark[]> = derived(
  [currentSlideBookmarks, bookmarkSortOrder],
  ([$bookmarks, $sortOrder]) => {
    const sorted = [...$bookmarks];
    switch ($sortOrder) {
      case 'name':
        sorted.sort((a, b) => a.label.localeCompare(b.label));
        break;
      case 'position':
        // Sort by zoom level (higher zoom = more detail = later in list)
        sorted.sort((a, b) => a.viewport.zoom - b.viewport.zoom);
        break;
      case 'created':
      default:
        sorted.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }
    return sorted;
  }
);

/**
 * Derived: Can create bookmark (slide must be loaded)
 */
export const canCreateBookmark: Readable<boolean> = derived(
  [currentSlideId, slideMetadata],
  ([$currentSlideId, $slideMetadata]) => {
    return !!$currentSlideId && !!$slideMetadata;
  }
);

/**
 * Derived: Active bookmark object
 */
export const activeBookmark: Readable<Bookmark | null> = derived(
  [bookmarks, activeBookmarkId],
  ([$bookmarks, $activeBookmarkId]) => {
    if (!$activeBookmarkId) return null;
    return $bookmarks.find((b) => b.id === $activeBookmarkId) || null;
  }
);

/**
 * Derived: Bookmark count for current slide
 */
export const bookmarkCount: Readable<number> = derived(
  currentSlideBookmarks,
  ($bookmarks) => $bookmarks.length
);

/**
 * Create a new bookmark at the current viewport position
 */
export function createBookmark(label: string, description?: string): Bookmark | null {
  if (!get(canCreateBookmark)) {
    console.warn('Cannot create bookmark: no slide loaded');
    return null;
  }

  const slideId = get(currentSlideId);
  const viewport = get(viewportState);
  const metadata = get(slideMetadata);

  if (!slideId || !viewport) return null;

  // Get next color in sequence
  const existingBookmarks = get(currentSlideBookmarks);
  const colorIndex = existingBookmarks.length % BOOKMARK_COLORS.length;
  const color = BOOKMARK_COLORS[colorIndex];

  const bookmark: Bookmark = {
    id: generateBookmarkId(),
    slideId,
    scanId: metadata?.scanId,
    label: label || `Bookmark ${existingBookmarks.length + 1}`,
    description,
    viewport: {
      center: { ...viewport.center },
      zoom: viewport.zoom,
      rotation: viewport.rotation,
    },
    color,
    createdAt: new Date().toISOString(),
  };

  bookmarks.update((current) => [...current, bookmark]);
  activeBookmarkId.set(bookmark.id);

  return bookmark;
}

/**
 * Update an existing bookmark
 */
export function updateBookmark(id: string, updates: Partial<Omit<Bookmark, 'id' | 'slideId' | 'createdAt'>>): boolean {
  let found = false;

  bookmarks.update((current) => {
    return current.map((b) => {
      if (b.id === id) {
        found = true;
        return { ...b, ...updates };
      }
      return b;
    });
  });

  return found;
}

/**
 * Delete a bookmark by ID
 */
export function deleteBookmark(id: string): boolean {
  const current = get(bookmarks);
  const exists = current.some((b) => b.id === id);

  if (!exists) return false;

  bookmarks.update((list) => list.filter((b) => b.id !== id));

  // Clear active if deleted
  if (get(activeBookmarkId) === id) {
    activeBookmarkId.set(null);
  }

  return true;
}

/**
 * Navigate to a bookmark's viewport position
 */
export function goToBookmark(id: string): boolean {
  const viewer = get(osdViewer);
  const bookmark = get(bookmarks).find((b) => b.id === id);

  if (!viewer || !bookmark) {
    return false;
  }

  // Set active bookmark
  activeBookmarkId.set(id);

  // Navigate to the saved viewport position
  const vp = viewer.viewport;

  // Apply rotation first
  if (bookmark.viewport.rotation !== vp.getRotation()) {
    vp.setRotation(bookmark.viewport.rotation);
  }

  // Pan and zoom to the saved position
  vp.panTo(
    new OpenSeadragon.Point(
      bookmark.viewport.center.x,
      bookmark.viewport.center.y
    ),
    false
  );
  vp.zoomTo(bookmark.viewport.zoom);

  return true;
}

/**
 * Update current bookmark's position to current viewport
 */
export function updateBookmarkPosition(id: string): boolean {
  const viewport = get(viewportState);
  if (!viewport) return false;

  return updateBookmark(id, {
    viewport: {
      center: { ...viewport.center },
      zoom: viewport.zoom,
      rotation: viewport.rotation,
    },
  });
}

/**
 * Export bookmarks to JSON string
 */
export function exportBookmarks(slideIdFilter?: string): string {
  const allBookmarks = get(bookmarks);
  const toExport = slideIdFilter
    ? allBookmarks.filter((b) => b.slideId === slideIdFilter)
    : allBookmarks;

  const exportData: BookmarkExport = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    bookmarks: toExport,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import bookmarks from JSON string
 * Returns number of bookmarks imported
 */
export function importBookmarks(json: string): number {
  try {
    const data = JSON.parse(json) as BookmarkExport;

    if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
      console.warn('Invalid bookmark export format');
      return 0;
    }

    // Generate new IDs to avoid conflicts
    const importedBookmarks = data.bookmarks.map((b) => ({
      ...b,
      id: generateBookmarkId(),
      createdAt: b.createdAt || new Date().toISOString(),
    }));

    bookmarks.update((current) => [...current, ...importedBookmarks]);

    return importedBookmarks.length;
  } catch (error) {
    console.error('Failed to import bookmarks:', error);
    return 0;
  }
}

/**
 * Clear all bookmarks for the current slide
 */
export function clearCurrentSlideBookmarks(): void {
  const slideId = get(currentSlideId);
  if (!slideId) return;

  bookmarks.update((current) => current.filter((b) => b.slideId !== slideId));
  activeBookmarkId.set(null);
}

/**
 * Clear all bookmarks
 */
export function clearAllBookmarks(): void {
  bookmarks.set([]);
  activeBookmarkId.set(null);
}

/**
 * Toggle bookmark panel visibility
 */
export function toggleBookmarkPanel(): void {
  bookmarkPanelVisible.update((v) => !v);
}

/**
 * Navigate to the next bookmark in the list
 * Returns true if navigation occurred
 */
export function goToNextBookmark(): boolean {
  const sorted = get(sortedBookmarks);
  if (sorted.length === 0) return false;

  const currentId = get(activeBookmarkId);

  if (!currentId) {
    // No active bookmark, go to the first one
    return goToBookmark(sorted[0].id);
  }

  const currentIndex = sorted.findIndex((b) => b.id === currentId);
  if (currentIndex === -1) {
    // Active bookmark not in list, go to first
    return goToBookmark(sorted[0].id);
  }

  // Go to next, wrap around to first if at end
  const nextIndex = (currentIndex + 1) % sorted.length;
  return goToBookmark(sorted[nextIndex].id);
}

/**
 * Navigate to the previous bookmark in the list
 * Returns true if navigation occurred
 */
export function goToPreviousBookmark(): boolean {
  const sorted = get(sortedBookmarks);
  if (sorted.length === 0) return false;

  const currentId = get(activeBookmarkId);

  if (!currentId) {
    // No active bookmark, go to the last one
    return goToBookmark(sorted[sorted.length - 1].id);
  }

  const currentIndex = sorted.findIndex((b) => b.id === currentId);
  if (currentIndex === -1) {
    // Active bookmark not in list, go to last
    return goToBookmark(sorted[sorted.length - 1].id);
  }

  // Go to previous, wrap around to last if at beginning
  const prevIndex = currentIndex === 0 ? sorted.length - 1 : currentIndex - 1;
  return goToBookmark(sorted[prevIndex].id);
}

/**
 * Reset bookmark state (for slide change)
 */
export function resetBookmarkState(): void {
  activeBookmarkId.set(null);
  // Note: We don't clear bookmarks - they persist across slide navigation
}
