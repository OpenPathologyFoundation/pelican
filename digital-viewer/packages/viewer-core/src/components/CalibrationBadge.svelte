<script lang="ts">
  /**
   * CalibrationBadge Component
   *
   * Compact display of MPP and calibration state
   * Per SRS-001 SYS-MSR-004, SYS-MSR-005
   */

  import { slideMetadata } from '../stores';
  import {
    currentCalibrationState,
    currentMpp,
    currentMppSource,
  } from '../stores/measurement';
  import { CALIBRATION_DISPLAY } from '../types/measurement';

  /** Props */
  interface Props {
    compact?: boolean;
    showMpp?: boolean;
    showSource?: boolean;
  }

  let {
    compact = false,
    showMpp = true,
    showSource = true,
  }: Props = $props();

  /** Get calibration display info */
  let calibrationInfo = $derived(CALIBRATION_DISPLAY[$currentCalibrationState]);

  /** Format MPP for display */
  function formatMpp(mpp: number | null): string {
    if (mpp === null) return '—';
    if (mpp < 0.1) return mpp.toFixed(4);
    if (mpp < 1) return mpp.toFixed(3);
    return mpp.toFixed(2);
  }
</script>

{#if $slideMetadata}
  <div
    class="calibration-badge"
    class:compact
    style="--badge-color: {calibrationInfo.color}"
    title="{calibrationInfo.label}{$currentMpp ? ` - ${formatMpp($currentMpp)} μm/px` : ''}"
  >
    <!-- Calibration state icon -->
    <span class="badge__icon">{calibrationInfo.icon}</span>

    {#if !compact}
      <!-- Calibration state label -->
      <span class="badge__state">{calibrationInfo.label}</span>

      {#if showMpp && $currentMpp !== null}
        <span class="badge__divider">|</span>
        <span class="badge__mpp">
          {formatMpp($currentMpp)} μm/px
          {#if showSource && $currentMppSource}
            <span class="badge__source">({$currentMppSource})</span>
          {/if}
        </span>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .calibration-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background-color: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    border-left: 3px solid var(--badge-color);
    font-size: 12px;
    color: #fff;
  }

  .calibration-badge.compact {
    padding: 2px 6px;
  }

  .badge__icon {
    color: var(--badge-color);
    font-size: 14px;
    font-weight: bold;
  }

  .badge__state {
    font-weight: 500;
  }

  .badge__divider {
    color: rgba(255, 255, 255, 0.3);
  }

  .badge__mpp {
    font-family: monospace;
    color: rgba(255, 255, 255, 0.9);
  }

  .badge__source {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
  }
</style>
