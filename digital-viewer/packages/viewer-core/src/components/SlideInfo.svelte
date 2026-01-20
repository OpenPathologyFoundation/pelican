<script lang="ts">
  /**
   * SlideInfo Component - Slide Metadata Display
   *
   * Shows slide information and properties
   * Updated for Svelte 5 with runes
   */

  import { slideMetadata, caseContext, diagnosticMode } from '../stores';

  /** Props */
  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  /** Format file size */
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /** Format dimensions */
  function formatDimensions(width: number, height: number): string {
    return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
  }
</script>

{#if $slideMetadata}
  <div class="slide-info" class:compact class:diagnostic-mode={$diagnosticMode}>
    {#if $caseContext}
      <div class="slide-info__case">
        <span class="slide-info__case-id">{$caseContext.caseId}</span>
        <span class="slide-info__patient">{$caseContext.patientName}</span>
      </div>
    {/if}

    {#if !compact}
      <div class="slide-info__details">
        <div class="slide-info__row">
          <span class="slide-info__label">Dimensions</span>
          <span class="slide-info__value">
            {formatDimensions($slideMetadata.width, $slideMetadata.height)}
          </span>
        </div>

        <div class="slide-info__row">
          <span class="slide-info__label">Levels</span>
          <span class="slide-info__value">{$slideMetadata.levels}</span>
        </div>

        {#if $slideMetadata.magnification}
          <div class="slide-info__row">
            <span class="slide-info__label">Magnification</span>
            <span class="slide-info__value">{$slideMetadata.magnification}×</span>
          </div>
        {/if}

        {#if $slideMetadata.mpp}
          <div class="slide-info__row">
            <span class="slide-info__label">Resolution</span>
            <span class="slide-info__value">
              {$slideMetadata.mpp.toFixed(4)} μm/px
            </span>
          </div>
        {/if}

        {#if $slideMetadata.format}
          <div class="slide-info__row">
            <span class="slide-info__label">Format</span>
            <span class="slide-info__value">{$slideMetadata.format}</span>
          </div>
        {/if}

        {#if $slideMetadata.vendor}
          <div class="slide-info__row">
            <span class="slide-info__label">Scanner</span>
            <span class="slide-info__value">{$slideMetadata.vendor}</span>
          </div>
        {/if}
      </div>
    {:else}
      <div class="slide-info__compact">
        <span>{formatDimensions($slideMetadata.width, $slideMetadata.height)}</span>
        {#if $slideMetadata.magnification}
          <span>•</span>
          <span>{$slideMetadata.magnification}×</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .slide-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
  }

  .slide-info.compact {
    padding: 8px 12px;
    gap: 4px;
  }

  .slide-info.diagnostic-mode {
    border-left: 3px solid #f59e0b;
  }

  .slide-info__case {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .slide-info__case-id {
    font-weight: bold;
    font-size: 14px;
  }

  .slide-info__patient {
    opacity: 0.8;
  }

  .slide-info__details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .slide-info__row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .slide-info__label {
    opacity: 0.7;
  }

  .slide-info__value {
    font-family: monospace;
  }

  .slide-info__compact {
    display: flex;
    gap: 8px;
    font-size: 12px;
    opacity: 0.9;
  }
</style>
