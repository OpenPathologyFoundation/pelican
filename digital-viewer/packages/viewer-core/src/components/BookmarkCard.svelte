<script lang="ts">
  /**
   * BookmarkCard Component
   *
   * Individual bookmark item display with navigation and edit actions
   * Per SRS UN-WFL-001 - Bookmarks/ROI System
   */

  import type { Bookmark } from '../types/bookmark';
  import { activeBookmarkId, goToBookmark, deleteBookmark, updateBookmark } from '../stores/bookmark';

  /** Props */
  interface Props {
    bookmark: Bookmark;
    onnavigate?: (bookmark: Bookmark) => void;
    ondelete?: (bookmark: Bookmark) => void;
  }

  let { bookmark, onnavigate, ondelete }: Props = $props();

  /** State */
  let isEditing = $state(false);
  let editLabel = $state('');

  /** Derived: Is this bookmark active */
  let isActive = $derived($activeBookmarkId === bookmark.id);

  /** Handle card click - navigate to bookmark */
  function handleClick(): void {
    if (isEditing) return;
    goToBookmark(bookmark.id);
    onnavigate?.(bookmark);
  }

  /** Handle delete button click */
  function handleDelete(event: MouseEvent): void {
    event.stopPropagation();
    deleteBookmark(bookmark.id);
    ondelete?.(bookmark);
  }

  /** Start editing label */
  function startEdit(event: MouseEvent): void {
    event.stopPropagation();
    editLabel = bookmark.label;
    isEditing = true;
  }

  /** Save edited label */
  function saveEdit(): void {
    if (editLabel.trim()) {
      updateBookmark(bookmark.id, { label: editLabel.trim() });
    }
    isEditing = false;
  }

  /** Cancel editing */
  function cancelEdit(): void {
    isEditing = false;
    editLabel = '';
  }

  /** Handle key press in edit input */
  function handleEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      saveEdit();
    } else if (event.key === 'Escape') {
      cancelEdit();
    }
  }

  /** Format zoom level for display */
  function formatZoom(zoom: number): string {
    return `${zoom.toFixed(1)}x`;
  }

  /** Format timestamp for display */
  function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div
  class="bookmark-card"
  class:active={isActive}
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabindex="0"
  style="--bookmark-color: {bookmark.color || '#3b82f6'}"
>
  <!-- Color indicator -->
  <div class="bookmark-card__indicator"></div>

  <!-- Content -->
  <div class="bookmark-card__content">
    {#if isEditing}
      <input
        type="text"
        class="bookmark-card__edit-input"
        bind:value={editLabel}
        onkeydown={handleEditKeydown}
        onblur={saveEdit}
        onclick={(e) => e.stopPropagation()}
      />
    {:else}
      <div class="bookmark-card__label">{bookmark.label}</div>
    {/if}

    {#if bookmark.description && !isEditing}
      <div class="bookmark-card__description">{bookmark.description}</div>
    {/if}

    <div class="bookmark-card__meta">
      <span class="bookmark-card__zoom">{formatZoom(bookmark.viewport.zoom)}</span>
      <span class="bookmark-card__time">{formatTime(bookmark.createdAt)}</span>
    </div>
  </div>

  <!-- Actions -->
  <div class="bookmark-card__actions">
    {#if !isEditing}
      <button
        class="bookmark-card__action-btn"
        onclick={startEdit}
        title="Edit label"
        aria-label="Edit bookmark label"
      >
        <span class="action-icon">&#9998;</span>
      </button>
    {/if}
    <button
      class="bookmark-card__action-btn delete"
      onclick={handleDelete}
      title="Delete bookmark"
      aria-label="Delete bookmark"
    >
      <span class="action-icon">&times;</span>
    </button>
  </div>
</div>

<style>
  .bookmark-card {
    display: flex;
    align-items: stretch;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #374151;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bookmark-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: #4b5563;
  }

  .bookmark-card:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }

  .bookmark-card.active {
    background: rgba(59, 130, 246, 0.15);
    border-color: #3b82f6;
  }

  .bookmark-card__indicator {
    width: 4px;
    min-height: 100%;
    background: var(--bookmark-color);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .bookmark-card__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bookmark-card__label {
    font-size: 13px;
    font-weight: 500;
    color: #f3f4f6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bookmark-card__edit-input {
    width: 100%;
    padding: 4px 8px;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #3b82f6;
    border-radius: 4px;
    color: #f3f4f6;
  }

  .bookmark-card__edit-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }

  .bookmark-card__description {
    font-size: 11px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bookmark-card__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    color: #6b7280;
  }

  .bookmark-card__zoom {
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    font-family: monospace;
  }

  .bookmark-card__actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .bookmark-card:hover .bookmark-card__actions {
    opacity: 1;
  }

  .bookmark-card__action-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 4px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s;
  }

  .bookmark-card__action-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #d1d5db;
  }

  .bookmark-card__action-btn.delete:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .action-icon {
    font-size: 14px;
    line-height: 1;
  }
</style>
