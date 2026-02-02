<script lang="ts">
  /**
   * SlideGallery Component - Slide List with Part Grouping
   *
   * Displays slides grouped by part/block with thumbnail previews.
   * Supports selection and part/block grouping per spec Section 6.
   * Includes hover preview for label images and info button.
   */

  import { currentSlideId } from '../stores';
  import { getApiClient } from '../api-client';
  import type { SlideInfo } from '../api-client';

  /** Props */
  interface Props {
    /** Current case ID */
    caseId: string;
    /** List of slides in the case */
    slides: SlideInfo[];
    /** Callback when a slide is selected */
    onslideselect?: (data: { slide: SlideInfo }) => void;
    /** Callback when slide info is requested */
    onslideinfo?: (data: { slide: SlideInfo }) => void;
  }

  let { caseId, slides, onslideselect, onslideinfo }: Props = $props();

  const client = getApiClient();

  /** Hover preview state */
  let hoverSlide = $state<SlideInfo | null>(null);
  let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let hoverPosition = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let showPreview = $state(false);

  /** Computed: slides grouped by part */
  let groupedSlides = $derived(groupSlidesByPart(slides));

  /** Group slides by their part designation */
  function groupSlidesByPart(slideList: SlideInfo[]): Map<string, SlideInfo[]> {
    const groups = new Map<string, SlideInfo[]>();

    for (const slide of slideList) {
      // Extract part from slideId (e.g., S26-0001_A1_S1 -> A1)
      const partMatch = slide.slideId.match(/_([A-Z]\d+)_/);
      const part = partMatch ? partMatch[1] : 'Other';

      if (!groups.has(part)) {
        groups.set(part, []);
      }
      groups.get(part)!.push(slide);
    }

    return groups;
  }

  /** Get thumbnail image URL for a slide */
  function getThumbnailUrl(slideId: string): string {
    return client.getSlideThumbnailUrl(slideId, 140, 100);
  }

  /** Get label image URL for a slide */
  function getLabelUrl(slideId: string): string {
    return client.getSlideLabelUrl(slideId);
  }

  /** Handle slide selection */
  function selectSlide(slide: SlideInfo): void {
    currentSlideId.set(slide.slideId);
    onslideselect?.({ slide });
  }

  /** Handle slide info button click */
  function showSlideInfo(slide: SlideInfo, event: MouseEvent): void {
    event.stopPropagation();
    onslideinfo?.({ slide });
  }

  /** Handle mouse enter - start hover timer */
  function handleMouseEnter(slide: SlideInfo, event: MouseEvent): void {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    // Start 2-second timer for preview
    hoverTimeout = setTimeout(() => {
      hoverSlide = slide;
      showPreview = true;
    }, 2000);

    // Track position for preview placement
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    hoverPosition = { x: rect.right + 10, y: rect.top };
  }

  /** Handle mouse leave - cancel hover timer */
  function handleMouseLeave(): void {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    showPreview = false;
    hoverSlide = null;
  }

  /** Handle image error (fallback) */
  function handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
</script>

<div class="slide-gallery">
  <div class="slide-gallery__header">
    <h3 class="slide-gallery__title">Slides</h3>
    <span class="slide-gallery__count">{slides.length}</span>
  </div>

  <div class="slide-gallery__list">
    {#each [...groupedSlides.entries()] as [part, partSlides]}
      <div class="slide-gallery__group">
        <div class="slide-gallery__group-header">
          <span class="slide-gallery__group-label">Part {part}</span>
          <span class="slide-gallery__group-desc">
            {partSlides[0]?.partDescription || ''}
          </span>
        </div>

        {#each partSlides as slide}
          <div
            class="slide-item-wrapper"
            onmouseenter={(e) => handleMouseEnter(slide, e)}
            onmouseleave={handleMouseLeave}
          >
            <button
              class="slide-item"
              class:selected={$currentSlideId === slide.slideId}
              onclick={() => selectSlide(slide)}
            >
              <div class="slide-item__thumb">
                <img
                  src={getThumbnailUrl(slide.slideId)}
                  alt=""
                  onerror={handleImageError}
                  loading="lazy"
                />
              </div>
              <div class="slide-item__info">
                <span class="slide-item__id">{slide.slideId}</span>
                <span class="slide-item__stain">{slide.stain}</span>
                {#if slide.blockDescription}
                  <span class="slide-item__desc">{slide.blockDescription}</span>
                {/if}
                {#if slide.notes}
                  <span class="slide-item__notes">{slide.notes}</span>
                {/if}
              </div>
            </button>
            <!-- Info button -->
            <button
              class="slide-item__info-btn"
              onclick={(e) => showSlideInfo(slide, e)}
              title="View slide information"
              aria-label="View slide information for {slide.slideId}"
            >
              ?
            </button>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<!-- Hover Preview Popup -->
{#if showPreview && hoverSlide}
  <div
    class="label-preview"
    style="left: {hoverPosition.x}px; top: {hoverPosition.y}px;"
  >
    <div class="label-preview__header">
      <span class="label-preview__title">Label</span>
      <span class="label-preview__slide-id">{hoverSlide.slideId}</span>
    </div>
    <img
      src={getLabelUrl(hoverSlide.slideId)}
      alt="Slide label for {hoverSlide.slideId}"
      class="label-preview__image"
      onerror={handleImageError}
    />
  </div>
{/if}

<style>
  .slide-gallery {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a2e;
    color: #fff;
  }

  .slide-gallery__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .slide-gallery__title {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #90caf9;
    margin: 0;
  }

  .slide-gallery__count {
    background: rgba(144, 202, 249, 0.2);
    color: #90caf9;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .slide-gallery__list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .slide-gallery__group {
    margin-bottom: 16px;
  }

  .slide-gallery__group-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 8px 4px;
    border-bottom: 1px solid #333;
    margin-bottom: 8px;
  }

  .slide-gallery__group-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #90caf9;
  }

  .slide-gallery__group-desc {
    font-size: 0.75rem;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slide-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 10px;
    margin-bottom: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    color: inherit;
    transition: background 150ms, border-color 150ms;
  }

  .slide-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .slide-item.selected {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
  }

  .slide-item__thumb {
    width: 70px;
    height: 52px;
    background: #333;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .slide-item__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .slide-item__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .slide-item__id {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .slide-item__stain {
    font-size: 0.75rem;
    color: #90caf9;
  }

  .slide-item__desc {
    font-size: 0.75rem;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slide-item__notes {
    font-size: 0.7rem;
    color: #f59e0b;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Slide item wrapper for positioning info button */
  .slide-item-wrapper {
    position: relative;
  }

  /* Info button */
  .slide-item__info-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(59, 130, 246, 0.9);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms, background 150ms;
    z-index: 10;
  }

  .slide-item-wrapper:hover .slide-item__info-btn {
    opacity: 1;
  }

  .slide-item__info-btn:hover {
    background: rgba(59, 130, 246, 1);
  }

  /* Label preview popup */
  .label-preview {
    position: fixed;
    z-index: 200;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    max-width: 420px;
    pointer-events: none;
  }

  .label-preview__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid #374151;
  }

  .label-preview__title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #9ca3af;
  }

  .label-preview__slide-id {
    font-size: 12px;
    font-weight: 500;
    color: #60a5fa;
  }

  .label-preview__image {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
