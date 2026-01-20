<script lang="ts">
  /**
   * ScaleBar Component - Dynamic Scale Bar
   *
   * Displays a scale bar that updates with zoom level
   * Updated for Svelte 5 with runes
   */

  import { slideMetadata, scaleBarMicrons, measurementUnit } from '../stores';

  /** Props */
  interface Props {
    barWidth?: number;
    position?: 'bottom-left' | 'bottom-right';
  }

  let { barWidth = 100, position = 'bottom-left' }: Props = $props();

  /** Computed: formatted scale text */
  let scaleText = $derived(formatScale($scaleBarMicrons, $measurementUnit));

  /** Check if we have calibration data */
  let hasCalibration = $derived($slideMetadata?.mpp !== undefined);

  /** Format scale value with unit */
  function formatScale(
    microns: number | null,
    unit: 'um' | 'mm' | 'px'
  ): string {
    if (microns === null) return '';

    const metadata = $slideMetadata;

    switch (unit) {
      case 'mm':
        if (microns >= 1000) {
          return `${(microns / 1000).toFixed(1)} mm`;
        }
        return `${(microns / 1000).toFixed(2)} mm`;

      case 'px':
        // Calculate pixels based on mpp
        if (!metadata?.mpp) return '';
        const pixels = microns / metadata.mpp;
        return `${Math.round(pixels)} px`;

      case 'um':
      default:
        if (microns >= 1000) {
          return `${(microns / 1000).toFixed(1)} mm`;
        }
        return `${Math.round(microns)} μm`;
    }
  }
</script>

{#if hasCalibration && $scaleBarMicrons !== null}
  <div class="scale-bar {position}">
    <div class="scale-bar__line" style="width: {barWidth}px;"></div>
    <div class="scale-bar__label">{scaleText}</div>
  </div>
{/if}

<style>
  .scale-bar {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px;
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 4px;
    pointer-events: none;
    z-index: 50;
  }

  .scale-bar.bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .scale-bar.bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .scale-bar__line {
    height: 4px;
    background-color: #fff;
    border-left: 2px solid #fff;
    border-right: 2px solid #fff;
  }

  .scale-bar__label {
    color: #fff;
    font-size: 12px;
    font-family: monospace;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }
</style>
