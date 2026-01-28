/**
 * Keyboard Shortcuts Types
 *
 * Type definitions for the keyboard shortcuts system per SRS UN-WFL-002
 * Supports customizable keyboard shortcuts for viewer actions
 */

/**
 * Available shortcut actions
 */
export type ShortcutAction =
  | 'bookmark.create'
  | 'bookmark.panel.toggle'
  | 'bookmark.next'
  | 'bookmark.previous'
  | 'navigation.undo'
  | 'navigation.redo'
  | 'navigation.home'
  | 'zoom.in'
  | 'zoom.out'
  | 'zoom.fit'
  | 'tools.measure.line'
  | 'tools.measure.area'
  | 'tools.panel.toggle'
  | 'slide.next'
  | 'slide.previous'
  | 'help.shortcuts';

/**
 * Shortcut category for grouping in help display
 */
export type ShortcutCategory = 'navigation' | 'bookmarks' | 'tools' | 'slides' | 'help';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Unique shortcut ID */
  id: string;

  /** Action to perform when triggered */
  action: ShortcutAction;

  /** Key code (e.g., 'b', 'z', 'Escape') */
  key: string;

  /** Required modifier keys */
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean; // Cmd on Mac, Windows key on PC
  };

  /** Human-readable description */
  description: string;

  /** Category for grouping */
  category: ShortcutCategory;

  /** Whether shortcut is enabled */
  enabled: boolean;
}

/**
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  {
    id: 'nav-undo',
    action: 'navigation.undo',
    key: 'z',
    modifiers: { meta: true },
    description: 'Undo navigation',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'nav-redo',
    action: 'navigation.redo',
    key: 'z',
    modifiers: { meta: true, shift: true },
    description: 'Redo navigation',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'nav-home',
    action: 'navigation.home',
    key: 'Home',
    modifiers: {},
    description: 'Go to home view',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'zoom-in-plus',
    action: 'zoom.in',
    key: '+',
    modifiers: {},
    description: 'Zoom in',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'zoom-in-equal',
    action: 'zoom.in',
    key: '=',
    modifiers: {},
    description: 'Zoom in',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'zoom-out-minus',
    action: 'zoom.out',
    key: '-',
    modifiers: {},
    description: 'Zoom out',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'zoom-fit',
    action: 'zoom.fit',
    key: '0',
    modifiers: { meta: true },
    description: 'Fit to screen',
    category: 'navigation',
    enabled: true,
  },

  // Bookmarks
  {
    id: 'bookmark-create',
    action: 'bookmark.create',
    key: 'b',
    modifiers: { meta: true },
    description: 'Create bookmark',
    category: 'bookmarks',
    enabled: true,
  },
  {
    id: 'bookmark-panel-toggle',
    action: 'bookmark.panel.toggle',
    key: 'b',
    modifiers: {},
    description: 'Toggle bookmark panel',
    category: 'bookmarks',
    enabled: true,
  },
  {
    id: 'bookmark-next',
    action: 'bookmark.next',
    key: 'n',
    modifiers: {},
    description: 'Next bookmark',
    category: 'bookmarks',
    enabled: true,
  },
  {
    id: 'bookmark-previous',
    action: 'bookmark.previous',
    key: 'p',
    modifiers: {},
    description: 'Previous bookmark',
    category: 'bookmarks',
    enabled: true,
  },

  // Tools
  {
    id: 'tools-toggle',
    action: 'tools.panel.toggle',
    key: 't',
    modifiers: {},
    description: 'Toggle tools panel',
    category: 'tools',
    enabled: true,
  },
  {
    id: 'measure-line',
    action: 'tools.measure.line',
    key: 'm',
    modifiers: {},
    description: 'Activate line measurement',
    category: 'tools',
    enabled: true,
  },
  {
    id: 'measure-area',
    action: 'tools.measure.area',
    key: 'a',
    modifiers: {},
    description: 'Activate area measurement',
    category: 'tools',
    enabled: true,
  },

  // Slides
  {
    id: 'slide-next',
    action: 'slide.next',
    key: ']',
    modifiers: {},
    description: 'Next slide',
    category: 'slides',
    enabled: true,
  },
  {
    id: 'slide-previous',
    action: 'slide.previous',
    key: '[',
    modifiers: {},
    description: 'Previous slide',
    category: 'slides',
    enabled: true,
  },

  // Help
  {
    id: 'help-shortcuts',
    action: 'help.shortcuts',
    key: '?',
    modifiers: { shift: true },
    description: 'Show keyboard shortcuts',
    category: 'help',
    enabled: true,
  },
];

/**
 * Category display configuration
 */
export const SHORTCUT_CATEGORIES: Record<ShortcutCategory, { label: string; order: number }> = {
  navigation: { label: 'Navigation', order: 1 },
  bookmarks: { label: 'Bookmarks', order: 2 },
  tools: { label: 'Tools', order: 3 },
  slides: { label: 'Slides', order: 4 },
  help: { label: 'Help', order: 5 },
};
