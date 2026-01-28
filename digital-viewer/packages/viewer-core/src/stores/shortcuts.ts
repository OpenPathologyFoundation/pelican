/**
 * Keyboard Shortcuts Store
 *
 * Svelte store for keyboard shortcut handling
 * Per SRS UN-WFL-002 - Keyboard Shortcuts System
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  type KeyboardShortcut,
  type ShortcutAction,
  type ShortcutCategory,
} from '../types/shortcuts';

/**
 * All keyboard shortcuts
 */
export const shortcuts: Writable<KeyboardShortcut[]> = writable([...DEFAULT_SHORTCUTS]);

/**
 * Whether shortcuts are globally enabled
 */
export const shortcutsEnabled: Writable<boolean> = writable(true);

/**
 * Whether shortcuts help modal is visible
 */
export const shortcutsHelpVisible: Writable<boolean> = writable(false);

/**
 * Derived: Map of action to shortcut for quick lookup
 */
export const shortcutsByAction: Readable<Map<ShortcutAction, KeyboardShortcut>> = derived(
  shortcuts,
  ($shortcuts) => {
    const map = new Map<ShortcutAction, KeyboardShortcut>();
    for (const shortcut of $shortcuts) {
      if (shortcut.enabled) {
        map.set(shortcut.action, shortcut);
      }
    }
    return map;
  }
);

/**
 * Derived: Only enabled shortcuts
 */
export const enabledShortcuts: Readable<KeyboardShortcut[]> = derived(
  shortcuts,
  ($shortcuts) => $shortcuts.filter((s) => s.enabled)
);

/**
 * Derived: Shortcuts grouped by category for display
 */
export const shortcutsByCategory: Readable<Map<ShortcutCategory, KeyboardShortcut[]>> = derived(
  enabledShortcuts,
  ($shortcuts) => {
    const map = new Map<ShortcutCategory, KeyboardShortcut[]>();

    // Initialize with empty arrays for all categories
    const categories = Object.keys(SHORTCUT_CATEGORIES) as ShortcutCategory[];
    for (const cat of categories) {
      map.set(cat, []);
    }

    // Group shortcuts by category
    for (const shortcut of $shortcuts) {
      const list = map.get(shortcut.category) || [];
      list.push(shortcut);
      map.set(shortcut.category, list);
    }

    return map;
  }
);

/**
 * Check if a keyboard event matches a shortcut
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Match key (case-insensitive for letters)
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  if (eventKey !== shortcutKey) {
    return false;
  }

  // Match modifiers
  const mods = shortcut.modifiers;
  const isMac = typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Determine expected modifier states
  const expectMeta = Boolean(mods.meta);
  const expectShift = Boolean(mods.shift);
  const expectAlt = Boolean(mods.alt);
  const expectCtrl = Boolean(mods.ctrl);

  // On Mac, treat meta as Cmd; on other platforms, treat meta shortcut as Ctrl
  const actualMeta = isMac ? event.metaKey : event.ctrlKey;

  // Check meta/ctrl (unified as "command" key)
  if (expectMeta !== actualMeta) {
    return false;
  }

  // Check shift
  // Some keys require shift to type (like +, ?, !, @, etc.)
  // Only enforce shift check if:
  // 1. The shortcut explicitly requires shift, OR
  // 2. It's a letter key where shift would change meaning (a-z vs A-Z)
  const isLetterKey = /^[a-z]$/i.test(shortcutKey);
  const keysRequiringShift = ['+', '?', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '{', '}', '|', ':', '"', '<', '>', '~'];
  const keyRequiresShift = keysRequiringShift.includes(shortcut.key);

  if (expectShift && !event.shiftKey) {
    // Shortcut requires shift but shift not pressed
    return false;
  }
  if (!expectShift && event.shiftKey && isLetterKey && !keyRequiresShift) {
    // Shift pressed but not expected, and it's a letter key
    return false;
  }

  // Check alt
  if (expectAlt !== event.altKey) {
    return false;
  }

  // Check ctrl (explicit ctrl, separate from meta handling)
  // On non-Mac, we've already used ctrlKey for meta, so skip this check
  if (!isMac && expectCtrl !== event.ctrlKey) {
    return false;
  }
  if (isMac && expectCtrl !== event.ctrlKey) {
    return false;
  }

  return true;
}

/**
 * Check if target is an input element that should capture keyboard events
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // Check for contenteditable
  if (target.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Handle keydown event and return matching action (if any)
 * Returns null if no matching shortcut or shortcuts are disabled
 */
export function handleKeydown(event: KeyboardEvent): ShortcutAction | null {
  // Check if shortcuts are enabled
  if (!get(shortcutsEnabled)) {
    return null;
  }

  // Don't intercept when typing in input elements
  if (isInputElement(event.target)) {
    return null;
  }

  // Find matching shortcut
  const enabledList = get(enabledShortcuts);

  for (const shortcut of enabledList) {
    if (matchesShortcut(event, shortcut)) {
      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();
      return shortcut.action;
    }
  }

  return null;
}

/**
 * Get shortcut definition for an action
 */
export function getShortcutForAction(action: ShortcutAction): KeyboardShortcut | undefined {
  return get(shortcuts).find((s) => s.action === action && s.enabled);
}

/**
 * Format shortcut for display (e.g., "Cmd+B" or "Ctrl+B")
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const parts: string[] = [];

  if (shortcut.modifiers.meta) {
    parts.push(isMac ? '\u2318' : 'Ctrl'); // Command symbol or Ctrl
  }
  if (shortcut.modifiers.ctrl) {
    parts.push('Ctrl');
  }
  if (shortcut.modifiers.alt) {
    parts.push(isMac ? '\u2325' : 'Alt'); // Option symbol or Alt
  }
  if (shortcut.modifiers.shift) {
    parts.push('\u21E7'); // Shift symbol
  }

  // Format key
  let keyDisplay = shortcut.key;
  if (keyDisplay === ' ') {
    keyDisplay = 'Space';
  } else if (keyDisplay.length === 1) {
    keyDisplay = keyDisplay.toUpperCase();
  }
  parts.push(keyDisplay);

  return parts.join(isMac ? '' : '+');
}

/**
 * Update a shortcut
 */
export function updateShortcut(
  id: string,
  updates: Partial<Pick<KeyboardShortcut, 'key' | 'modifiers' | 'enabled'>>
): boolean {
  let found = false;

  shortcuts.update((current) => {
    return current.map((s) => {
      if (s.id === id) {
        found = true;
        return { ...s, ...updates };
      }
      return s;
    });
  });

  return found;
}

/**
 * Enable or disable a specific shortcut
 */
export function setShortcutEnabled(id: string, enabled: boolean): boolean {
  return updateShortcut(id, { enabled });
}

/**
 * Reset all shortcuts to defaults
 */
export function resetToDefaults(): void {
  shortcuts.set([...DEFAULT_SHORTCUTS]);
}

/**
 * Toggle shortcuts help visibility
 */
export function toggleShortcutsHelp(): void {
  shortcutsHelpVisible.update((v) => !v);
}

/**
 * Show shortcuts help
 */
export function showShortcutsHelp(): void {
  shortcutsHelpVisible.set(true);
}

/**
 * Hide shortcuts help
 */
export function hideShortcutsHelp(): void {
  shortcutsHelpVisible.set(false);
}
