<script lang="ts">
  /**
   * SlideGallery Component - Slide List with Part Grouping
   *
   * Displays slides grouped by part/block with thumbnail previews.
   * Supports selection and part/block grouping per spec Section 6.
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
  }

  let { caseId, slides, onslideselect }: Props = $props();

  const client = getApiClient();

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

  /** Get macro image URL for a slide */
  function getMacroUrl(slideId: string): string {
    return client.getSlideMacroUrl(slideId);
  }

  /** Handle slide selection */
  function selectSlide(slide: SlideInfo): void {
    currentSlideId.set(slide.slideId);
    onslideselect?.({ slide });
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
          <button
            class="slide-item"
            class:selected={$currentSlideId === slide.slideId}
            onclick={() => selectSlide(slide)}
          >
            <div class="slide-item__thumb">
              <img
                src={getMacroUrl(slide.slideId)}
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
        {/each}
      </div>
    {/each}
  </div>
</div>

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
</style>
