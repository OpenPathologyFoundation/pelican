<script lang="ts">
  /**
   * BookmarkPanel Component
   *
   * Panel for viewing and managing bookmarks/ROIs
   * Per SRS UN-WFL-001 - Bookmarks/ROI System
   *
   * Visibility is controlled by the bookmarkPanelVisible store (toggle with 'B' key)
   */

  import type { Bookmark, BookmarkSortOrder } from '../types/bookmark';
  import {
    sortedBookmarks,
    bookmarkCount,
    bookmarkSortOrder,
    canCreateBookmark,
    createBookmark,
    exportBookmarks,
    importBookmarks,
    clearCurrentSlideBookmarks,
    toggleBookmarkPanel,
  } from '../stores/bookmark';
  import { currentSlideId } from '../stores';
  import BookmarkCard from './BookmarkCard.svelte';

  /** Props */
  interface Props {
    position?: 'left' | 'right';
    onbookmarknavigate?: (bookmark: Bookmark) => void;
    onbookmarkcreate?: (bookmark: Bookmark) => void;
    onbookmarkdelete?: (bookmark: Bookmark) => void;
  }

  let {
    position = 'left',
    onbookmarknavigate,
    onbookmarkcreate,
    onbookmarkdelete,
  }: Props = $props();

  /** State */
  let showNewBookmarkInput = $state(false);
  let newBookmarkLabel = $state('');
  let newBookmarkDescription = $state('');
  let showImportDialog = $state(false);
  let importJson = $state('');
  let importError = $state('');

  /** Sort options */
  const SORT_OPTIONS: { value: BookmarkSortOrder; label: string }[] = [
    { value: 'created', label: 'Recent' },
    { value: 'name', label: 'Name' },
    { value: 'position', label: 'Zoom' },
  ];

  /** Show new bookmark input */
  function showAddBookmark(): void {
    showNewBookmarkInput = true;
    newBookmarkLabel = `Bookmark ${$bookmarkCount + 1}`;
  }

  /** Create new bookmark */
  function handleCreateBookmark(): void {
    if (!$canCreateBookmark) return;

    const bookmark = createBookmark(
      newBookmarkLabel.trim() || `Bookmark ${$bookmarkCount + 1}`,
      newBookmarkDescription.trim() || undefined
    );

    if (bookmark) {
      onbookmarkcreate?.(bookmark);
    }

    // Reset form
    showNewBookmarkInput = false;
    newBookmarkLabel = '';
    newBookmarkDescription = '';
  }

  /** Cancel new bookmark */
  function cancelNewBookmark(): void {
    showNewBookmarkInput = false;
    newBookmarkLabel = '';
    newBookmarkDescription = '';
  }

  /** Handle key press in new bookmark input */
  function handleNewKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleCreateBookmark();
    } else if (event.key === 'Escape') {
      cancelNewBookmark();
    }
  }

  /** Handle sort change */
  function handleSortChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    bookmarkSortOrder.set(target.value as BookmarkSortOrder);
  }

  /** Handle export */
  function handleExport(): void {
    const json = exportBookmarks($currentSlideId || undefined);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks-${$currentSlideId || 'all'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Handle import */
  function handleImport(): void {
    importError = '';
    try {
      const count = importBookmarks(importJson);
      if (count > 0) {
        showImportDialog = false;
        importJson = '';
      } else {
        importError = 'No bookmarks found in file';
      }
    } catch {
      importError = 'Invalid bookmark file format';
    }
  }

  /** Handle bookmark navigate */
  function handleNavigate(bookmark: Bookmark): void {
    onbookmarknavigate?.(bookmark);
  }

  /** Handle bookmark delete */
  function handleDelete(bookmark: Bookmark): void {
    onbookmarkdelete?.(bookmark);
  }
</script>

<!-- Panel -->
<div
  class="bookmark-panel"
  class:left={position === 'left'}
  class:right={position === 'right'}
>
    <!-- Header -->
    <div class="bookmark-panel__header">
      <h3 class="bookmark-panel__title">
        Bookmarks
        {#if $bookmarkCount > 0}
          <span class="bookmark-panel__count">({$bookmarkCount})</span>
        {/if}
      </h3>

      <div class="bookmark-panel__actions">
        <button
          class="header-btn"
          onclick={showAddBookmark}
          disabled={!$canCreateBookmark}
          title="Add bookmark (Cmd/Ctrl+B)"
          aria-label="Add bookmark"
        >
          +
        </button>
        <button
          class="header-btn close-btn"
          onclick={toggleBookmarkPanel}
          title="Close (B)"
          aria-label="Close bookmarks panel"
        >
          &times;
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="bookmark-panel__toolbar">
      <select
        class="sort-select"
        value={$bookmarkSortOrder}
        onchange={handleSortChange}
        aria-label="Sort bookmarks"
      >
        {#each SORT_OPTIONS as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <div class="toolbar-actions">
        <button
          class="toolbar-btn"
          onclick={handleExport}
          disabled={$bookmarkCount === 0}
          title="Export bookmarks"
          aria-label="Export bookmarks"
        >
          Export
        </button>
        <button
          class="toolbar-btn"
          onclick={() => showImportDialog = true}
          title="Import bookmarks"
          aria-label="Import bookmarks"
        >
          Import
        </button>
      </div>
    </div>

    <!-- New Bookmark Form -->
    {#if showNewBookmarkInput}
      <div class="new-bookmark-form">
        <input
          type="text"
          class="new-bookmark-input"
          placeholder="Bookmark name"
          bind:value={newBookmarkLabel}
          onkeydown={handleNewKeydown}
        />
        <textarea
          class="new-bookmark-desc"
          placeholder="Description (optional)"
          bind:value={newBookmarkDescription}
          rows="2"
        ></textarea>
        <div class="new-bookmark-actions">
          <button class="form-btn primary" onclick={handleCreateBookmark}>
            Save
          </button>
          <button class="form-btn" onclick={cancelNewBookmark}>
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <!-- Bookmark List -->
    <div class="bookmark-panel__list">
      {#if $sortedBookmarks.length === 0}
        <div class="bookmark-panel__empty">
          <span class="empty-icon">&#128278;</span>
          <p>No bookmarks yet</p>
          <p class="empty-hint">
            {#if $canCreateBookmark}
              Click + to save your current view
            {:else}
              Open a slide to create bookmarks
            {/if}
          </p>
        </div>
      {:else}
        {#each $sortedBookmarks as bookmark (bookmark.id)}
          <BookmarkCard
            {bookmark}
            onnavigate={handleNavigate}
            ondelete={handleDelete}
          />
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    {#if $bookmarkCount > 0}
      <div class="bookmark-panel__footer">
        <button
          class="clear-btn"
          onclick={clearCurrentSlideBookmarks}
          title="Clear all bookmarks for this slide"
        >
          Clear All
        </button>
      </div>
    {/if}
</div>

<!-- Import Dialog -->
{#if showImportDialog}
  <div class="import-dialog-backdrop" onclick={() => showImportDialog = false} role="presentation">
    <div class="import-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <h4 class="import-dialog__title">Import Bookmarks</h4>
      <textarea
        class="import-dialog__input"
        placeholder="Paste bookmark JSON here..."
        bind:value={importJson}
        rows="10"
      ></textarea>
      {#if importError}
        <div class="import-dialog__error">{importError}</div>
      {/if}
      <div class="import-dialog__actions">
        <button class="form-btn primary" onclick={handleImport}>
          Import
        </button>
        <button class="form-btn" onclick={() => showImportDialog = false}>
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bookmark-panel {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 260px;
    background: rgba(31, 41, 55, 0.98);
    border: 1px solid #374151;
    z-index: 140;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .bookmark-panel.left {
    left: 0;
    border-left: none;
    border-radius: 0 8px 8px 0;
  }

  .bookmark-panel.right {
    right: 0;
    border-right: none;
    border-radius: 8px 0 0 8px;
  }

  .bookmark-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid #374151;
    background: rgba(0, 0, 0, 0.2);
  }

  .bookmark-panel__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #f3f4f6;
  }

  .bookmark-panel__count {
    font-weight: 400;
    color: #9ca3af;
  }

  .bookmark-panel__actions {
    display: flex;
    gap: 4px;
  }

  .header-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid #3b82f6;
    border-radius: 4px;
    color: #60a5fa;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .header-btn:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
  }

  .header-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-btn.close-btn {
    background: rgba(255, 255, 255, 0.08);
    border-color: #4b5563;
    color: #9ca3af;
  }

  .header-btn.close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #d1d5db;
  }

  .bookmark-panel__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid #374151;
  }

  .sort-select {
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 12px;
    cursor: pointer;
  }

  .toolbar-actions {
    display: flex;
    gap: 6px;
  }

  .toolbar-btn {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #9ca3af;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
  }

  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .new-bookmark-form {
    padding: 12px 14px;
    border-bottom: 1px solid #374151;
    background: rgba(59, 130, 246, 0.05);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .new-bookmark-input,
  .new-bookmark-desc {
    width: 100%;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #f3f4f6;
    font-size: 13px;
    resize: none;
  }

  .new-bookmark-input:focus,
  .new-bookmark-desc:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .new-bookmark-actions {
    display: flex;
    gap: 8px;
  }

  .form-btn {
    flex: 1;
    padding: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .form-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .form-btn.primary {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #60a5fa;
  }

  .form-btn.primary:hover {
    background: rgba(59, 130, 246, 0.3);
  }

  .bookmark-panel__list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bookmark-panel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.5;
    margin-bottom: 12px;
  }

  .bookmark-panel__empty p {
    margin: 0;
    font-size: 13px;
  }

  .empty-hint {
    margin-top: 8px;
    font-size: 11px;
    color: #4b5563;
  }

  .bookmark-panel__footer {
    padding: 10px 14px;
    border-top: 1px solid #374151;
    background: rgba(0, 0, 0, 0.2);
  }

  .clear-btn {
    width: 100%;
    padding: 8px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #fca5a5;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* Import Dialog */
  .import-dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .import-dialog {
    width: 90%;
    max-width: 500px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 20px;
  }

  .import-dialog__title {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: #f3f4f6;
  }

  .import-dialog__input {
    width: 100%;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #f3f4f6;
    font-size: 12px;
    font-family: monospace;
    resize: vertical;
  }

  .import-dialog__input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .import-dialog__error {
    margin-top: 8px;
    padding: 8px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #fca5a5;
    font-size: 12px;
  }

  .import-dialog__actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
</style>
