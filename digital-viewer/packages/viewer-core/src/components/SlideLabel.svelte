<script lang="ts">
  /**
   * SlideLabel Component
   *
   * Display slide label, barcode, and metadata information
   * Per SRS UN-SAF-006 - Slide Label/Barcode View
   */

  import { slideMetadata } from '../stores';

  /** Props */
  interface Props {
    mode?: 'compact' | 'full' | 'modal';
    showBarcode?: boolean;
    showLabelImage?: boolean;
    onclose?: () => void;
  }

  let {
    mode = 'compact',
    showBarcode = true,
    showLabelImage = true,
    onclose,
  }: Props = $props();

  /** State */
  let showModal = $state(false);

  /** Open modal view */
  function openModal(): void {
    showModal = true;
  }

  /** Close modal view */
  function closeModal(): void {
    showModal = false;
    onclose?.();
  }

  /** Handle backdrop click */
  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  /** Handle escape key */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && showModal) {
      closeModal();
    }
  }

  /** Format date for display */
  function formatDate(dateString: string | undefined): string {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  }

  /** Derived: Get metadata properties */
  let properties = $derived($slideMetadata?.properties as Record<string, unknown> || {});
  let barcode = $derived((properties.barcode as string) || (properties.slide_barcode as string) || '');
  let labelImageUrl = $derived((properties.labelImageUrl as string) || (properties.label_image as string) || '');
  let specimenPart = $derived((properties.specimen_part as string) || (properties.tissueType as string) || '');
  let blockId = $derived((properties.block_id as string) || (properties.blockLabel as string) || '');
  let stain = $derived((properties.stain as string) || (properties.stainType as string) || '');
  let scanDate = $derived((properties.scan_date as string) || (properties.acquisitionDate as string) || '');
  let scanner = $derived((properties.scanner as string) || (properties.vendor as string) || $slideMetadata?.vendor || '');
</script>

<svelte:window onkeydown={handleKeydown} />

{#if mode === 'compact'}
  <!-- Compact view - button to open modal -->
  <button
    class="label-btn"
    onclick={openModal}
    disabled={!$slideMetadata}
    title="View slide label"
    aria-label="View slide label and barcode"
  >
    <span class="label-icon">&#128203;</span>
    <span class="label-text">Label</span>
  </button>
{:else if mode === 'full'}
  <!-- Full inline view -->
  <div class="slide-label full">
    {#if $slideMetadata}
      <!-- Header -->
      <div class="label-header">
        <span class="label-title">Slide Information</span>
      </div>

      <!-- Content -->
      <div class="label-content">
        <!-- Barcode -->
        {#if showBarcode && barcode}
          <div class="label-row">
            <span class="label-key">Barcode</span>
            <span class="label-value barcode">{barcode}</span>
          </div>
        {/if}

        <!-- Slide ID -->
        <div class="label-row">
          <span class="label-key">Slide ID</span>
          <span class="label-value">{$slideMetadata.slideId}</span>
        </div>

        <!-- Scan ID -->
        {#if $slideMetadata.scanId}
          <div class="label-row">
            <span class="label-key">Scan ID</span>
            <span class="label-value mono">{$slideMetadata.scanId}</span>
          </div>
        {/if}

        <!-- Specimen Info -->
        {#if specimenPart}
          <div class="label-row">
            <span class="label-key">Specimen</span>
            <span class="label-value">{specimenPart}</span>
          </div>
        {/if}

        {#if blockId}
          <div class="label-row">
            <span class="label-key">Block</span>
            <span class="label-value">{blockId}</span>
          </div>
        {/if}

        {#if stain}
          <div class="label-row">
            <span class="label-key">Stain</span>
            <span class="label-value">{stain}</span>
          </div>
        {/if}

        <!-- Scan Info -->
        {#if scanDate}
          <div class="label-row">
            <span class="label-key">Scan Date</span>
            <span class="label-value">{formatDate(scanDate)}</span>
          </div>
        {/if}

        {#if scanner}
          <div class="label-row">
            <span class="label-key">Scanner</span>
            <span class="label-value">{scanner}</span>
          </div>
        {/if}

        <!-- Image Info -->
        <div class="label-row">
          <span class="label-key">Dimensions</span>
          <span class="label-value mono">
            {$slideMetadata.width.toLocaleString()} x {$slideMetadata.height.toLocaleString()} px
          </span>
        </div>

        {#if $slideMetadata.magnification}
          <div class="label-row">
            <span class="label-key">Magnification</span>
            <span class="label-value">{$slideMetadata.magnification}x</span>
          </div>
        {/if}

        {#if $slideMetadata.mpp}
          <div class="label-row">
            <span class="label-key">Resolution</span>
            <span class="label-value mono">{$slideMetadata.mpp.toFixed(4)} &micro;m/px</span>
          </div>
        {/if}

        <!-- Label Image -->
        {#if showLabelImage && labelImageUrl}
          <div class="label-image-container">
            <span class="label-key">Label Image</span>
            <img
              src={labelImageUrl}
              alt="Slide label"
              class="label-image"
            />
          </div>
        {/if}
      </div>
    {:else}
      <div class="no-slide">No slide loaded</div>
    {/if}
  </div>
{/if}

<!-- Modal View -->
{#if showModal}
  <div
    class="label-modal-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      class="label-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-modal-title"
    >
      <!-- Header -->
      <div class="modal-header">
        <h3 id="label-modal-title" class="modal-title">Slide Information</h3>
        <button
          class="modal-close-btn"
          onclick={closeModal}
          title="Close"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      <!-- Content -->
      <div class="modal-content">
        {#if $slideMetadata}
          <div class="modal-grid">
            <!-- Left column: Text info -->
            <div class="modal-info">
              <!-- Barcode -->
              {#if showBarcode && barcode}
                <div class="info-section">
                  <span class="info-label">Barcode</span>
                  <span class="info-value barcode-large">{barcode}</span>
                </div>
              {/if}

              <!-- Slide ID -->
              <div class="info-section">
                <span class="info-label">Slide ID</span>
                <span class="info-value">{$slideMetadata.slideId}</span>
              </div>

              <!-- Scan ID -->
              {#if $slideMetadata.scanId}
                <div class="info-section">
                  <span class="info-label">Scan ID</span>
                  <span class="info-value mono">{$slideMetadata.scanId}</span>
                </div>
              {/if}

              <!-- Specimen Info -->
              {#if specimenPart || blockId || stain}
                <div class="info-group">
                  <span class="info-group-title">Specimen</span>
                  {#if specimenPart}
                    <div class="info-row">
                      <span class="info-row-label">Part:</span>
                      <span class="info-row-value">{specimenPart}</span>
                    </div>
                  {/if}
                  {#if blockId}
                    <div class="info-row">
                      <span class="info-row-label">Block:</span>
                      <span class="info-row-value">{blockId}</span>
                    </div>
                  {/if}
                  {#if stain}
                    <div class="info-row">
                      <span class="info-row-label">Stain:</span>
                      <span class="info-row-value">{stain}</span>
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Scan Info -->
              <div class="info-group">
                <span class="info-group-title">Scan Details</span>
                {#if scanDate}
                  <div class="info-row">
                    <span class="info-row-label">Date:</span>
                    <span class="info-row-value">{formatDate(scanDate)}</span>
                  </div>
                {/if}
                {#if scanner}
                  <div class="info-row">
                    <span class="info-row-label">Scanner:</span>
                    <span class="info-row-value">{scanner}</span>
                  </div>
                {/if}
                <div class="info-row">
                  <span class="info-row-label">Size:</span>
                  <span class="info-row-value mono">
                    {$slideMetadata.width.toLocaleString()} x {$slideMetadata.height.toLocaleString()} px
                  </span>
                </div>
                {#if $slideMetadata.magnification}
                  <div class="info-row">
                    <span class="info-row-label">Mag:</span>
                    <span class="info-row-value">{$slideMetadata.magnification}x</span>
                  </div>
                {/if}
                {#if $slideMetadata.mpp}
                  <div class="info-row">
                    <span class="info-row-label">MPP:</span>
                    <span class="info-row-value mono">{$slideMetadata.mpp.toFixed(4)} &micro;m/px</span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Right column: Label image -->
            {#if showLabelImage && labelImageUrl}
              <div class="modal-image">
                <span class="info-label">Label Image</span>
                <img
                  src={labelImageUrl}
                  alt="Slide label"
                  class="label-image-large"
                />
              </div>
            {/if}
          </div>
        {:else}
          <div class="no-slide">No slide loaded</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Compact button */
  .label-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid #374151;
    border-radius: 6px;
    color: #d1d5db;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .label-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: #4b5563;
  }

  .label-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .label-icon {
    font-size: 16px;
  }

  /* Full inline view */
  .slide-label.full {
    background: rgba(31, 41, 55, 0.95);
    border: 1px solid #374151;
    border-radius: 8px;
    overflow: hidden;
  }

  .label-header {
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid #374151;
  }

  .label-title {
    font-size: 12px;
    font-weight: 600;
    color: #f3f4f6;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .label-content {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    font-size: 12px;
  }

  .label-key {
    color: #9ca3af;
    white-space: nowrap;
  }

  .label-value {
    color: #d1d5db;
    text-align: right;
    word-break: break-word;
  }

  .label-value.barcode {
    font-family: monospace;
    font-weight: 600;
    color: #60a5fa;
  }

  .label-value.mono {
    font-family: monospace;
    font-size: 11px;
  }

  .label-image-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #374151;
  }

  .label-image {
    max-width: 100%;
    border-radius: 4px;
    border: 1px solid #374151;
  }

  .no-slide {
    padding: 20px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
  }

  /* Modal view */
  .label-modal-backdrop {
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

  .label-modal {
    width: 100%;
    max-width: 700px;
    max-height: 80vh;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #374151;
    background: rgba(0, 0, 0, 0.2);
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #f3f4f6;
  }

  .modal-close-btn {
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

  .modal-close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #d1d5db;
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .modal-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
  }

  .modal-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
  }

  .info-value {
    font-size: 14px;
    color: #d1d5db;
  }

  .barcode-large {
    font-family: monospace;
    font-size: 18px;
    font-weight: 600;
    color: #60a5fa;
    padding: 8px 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 6px;
  }

  .info-group {
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-group-title {
    font-size: 12px;
    font-weight: 600;
    color: #f3f4f6;
    margin-bottom: 4px;
  }

  .info-row {
    display: flex;
    gap: 8px;
    font-size: 13px;
  }

  .info-row-label {
    color: #9ca3af;
    min-width: 60px;
  }

  .info-row-value {
    color: #d1d5db;
  }

  .modal-image {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label-image-large {
    max-width: 200px;
    border-radius: 6px;
    border: 1px solid #374151;
  }
</style>
