<script lang="ts">
  /**
   * ShortcutsHelp Component
   *
   * Modal dialog showing all available keyboard shortcuts
   * Per SRS UN-WFL-002 - Keyboard Shortcuts System
   */

  import {
    shortcutsHelpVisible,
    shortcutsByCategory,
    formatShortcut,
    hideShortcutsHelp,
  } from '../stores/shortcuts';
  import {
    SHORTCUT_CATEGORIES,
    type ShortcutCategory,
    type KeyboardShortcut,
    type ShortcutAction,
  } from '../types/shortcuts';

  /** Deduplicated shortcut for display */
  interface DisplayShortcut {
    action: ShortcutAction;
    description: string;
    keys: string[]; // Formatted key strings
  }

  /** Props */
  interface Props {
    onclose?: () => void;
  }

  let { onclose }: Props = $props();

  /** Handle close */
  function handleClose(): void {
    hideShortcutsHelp();
    onclose?.();
  }

  /** Handle backdrop click */
  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  /** Handle escape key */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  /** Get sorted categories */
  function getSortedCategories(): ShortcutCategory[] {
    return (Object.entries(SHORTCUT_CATEGORIES) as [ShortcutCategory, { label: string; order: number }][])
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key]) => key);
  }

  /** Deduplicate shortcuts by action, combining keys */
  function deduplicateShortcuts(shortcuts: KeyboardShortcut[]): DisplayShortcut[] {
    const byAction = new Map<ShortcutAction, DisplayShortcut>();

    for (const shortcut of shortcuts) {
      const existing = byAction.get(shortcut.action);
      const formattedKey = formatShortcut(shortcut);

      if (existing) {
        // Add key if not already present
        if (!existing.keys.includes(formattedKey)) {
          existing.keys.push(formattedKey);
        }
      } else {
        byAction.set(shortcut.action, {
          action: shortcut.action,
          description: shortcut.description,
          keys: [formattedKey],
        });
      }
    }

    return Array.from(byAction.values());
  }

  /** Format multiple keys for display */
  function formatKeys(keys: string[]): string {
    return keys.join(' / ');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $shortcutsHelpVisible}
  <div
    class="shortcuts-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      class="shortcuts-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <!-- Header -->
      <div class="shortcuts-header">
        <h2 id="shortcuts-title" class="shortcuts-title">Keyboard Shortcuts</h2>
        <button
          class="close-btn"
          onclick={handleClose}
          title="Close"
          aria-label="Close shortcuts help"
        >
          &times;
        </button>
      </div>

      <!-- Content -->
      <div class="shortcuts-content">
        {#each getSortedCategories() as category}
          {@const shortcuts = $shortcutsByCategory.get(category) || []}
          {@const displayShortcuts = deduplicateShortcuts(shortcuts)}
          {#if displayShortcuts.length > 0}
            <div class="shortcuts-category">
              <h3 class="category-title">{SHORTCUT_CATEGORIES[category].label}</h3>
              <div class="shortcuts-list">
                {#each displayShortcuts as shortcut}
                  <div class="shortcut-row">
                    <span class="shortcut-description">{shortcut.description}</span>
                    <kbd class="shortcut-key">{formatKeys(shortcut.keys)}</kbd>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Footer -->
      <div class="shortcuts-footer">
        <p class="shortcuts-hint">
          Press <kbd>?</kbd> to toggle this help
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  .shortcuts-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: 20px;
  }

  .shortcuts-dialog {
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #374151;
    background: rgba(0, 0, 0, 0.2);
  }

  .shortcuts-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #f3f4f6;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 6px;
    color: #9ca3af;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #d1d5db;
  }

  .shortcuts-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .shortcuts-category {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .category-title {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    padding-bottom: 8px;
    border-bottom: 1px solid #374151;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  .shortcut-description {
    font-size: 13px;
    color: #d1d5db;
  }

  .shortcut-key {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #4b5563;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
    font-size: 12px;
    color: #e5e7eb;
    white-space: nowrap;
  }

  .shortcuts-footer {
    padding: 12px 20px;
    border-top: 1px solid #374151;
    background: rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  .shortcuts-hint {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
  }

  .shortcuts-hint kbd {
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #4b5563;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
    color: #9ca3af;
  }
</style>
