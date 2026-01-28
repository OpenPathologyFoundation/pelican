/**
 * Bookmark Types
 *
 * Type definitions for the bookmark/ROI system per SRS UN-WFL-001
 * Supports saving and navigating to viewport positions (Regions of Interest)
 */

/**
 * Bookmark representing a saved viewport position
 */
export interface Bookmark {
  /** Unique bookmark ID */
  id: string;

  /** Slide this bookmark belongs to */
  slideId: string;

  /** Specific scan ID (immutable link) */
  scanId?: string;

  /** User-provided label */
  label: string;

  /** Optional description */
  description?: string;

  /** Saved viewport state */
  viewport: {
    center: { x: number; y: number };
    zoom: number;
    rotation: number;
  };

  /** Base64 or data URL thumbnail (optional) */
  thumbnail?: string;

  /** Display color for bookmark marker */
  color?: string;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** User who created the bookmark */
  createdBy?: string;
}

/**
 * Bookmark group for organizing bookmarks
 */
export interface BookmarkGroup {
  /** Unique group ID */
  id: string;

  /** Group name */
  name: string;

  /** Bookmark IDs in this group */
  bookmarks: string[];
}

/**
 * Sort order options for bookmarks
 */
export type BookmarkSortOrder = 'created' | 'name' | 'position';

/**
 * Export format for bookmarks
 */
export interface BookmarkExport {
  /** Export version for compatibility */
  version: string;

  /** Export timestamp */
  exportedAt: string;

  /** Exported by user */
  exportedBy?: string;

  /** Bookmarks data */
  bookmarks: Bookmark[];

  /** Bookmark groups */
  groups?: BookmarkGroup[];
}

/**
 * Default bookmark colors
 */
export const BOOKMARK_COLORS: string[] = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];
