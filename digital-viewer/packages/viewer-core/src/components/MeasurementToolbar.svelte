<script lang="ts">
  /**
   * MeasurementToolbar Component
   *
   * Provides measurement tools with MPP and calibration display
   * Per SRS-001 SYS-MSR-001 through SYS-MSR-007
   */

  import { slideMetadata, diagnosticMode } from '../stores';
  import {
    activeMeasurementTool,
    measurementDisplayUnit,
    currentCalibrationState,
    currentMpp,
    currentMppSource,
    isMeasurementBlocked,
    measurementBlockReason,
    canMeasure,
    startMeasurement,
    cancelMeasurement,
  } from '../stores/measurement';
  import {
    MEASUREMENT_TOOLS,
    CALIBRATION_DISPLAY,
    type MeasurementType,
    type MeasurementUnit,
  } from '../types/measurement';

  /** Props */
  interface Props {
    showCalibration?: boolean;
    onmeasurementstart?: (data: { tool: MeasurementType }) => void;
    onmeasurementcancel?: () => void;
    onblockwarning?: (data: { reason: string }) => void;
  }

  let {
    showCalibration = true,
    onmeasurementstart,
    onmeasurementcancel,
    onblockwarning,
  }: Props = $props();

  /** Select measurement tool */
  function selectTool(type: MeasurementType): void {
    // Check if blocked
    if ($isMeasurementBlocked) {
      onblockwarning?.({ reason: $measurementBlockReason || 'Measurements blocked' });
      return;
    }

    // Toggle off if same tool
    if ($activeMeasurementTool === type) {
      cancelMeasurement();
      onmeasurementcancel?.();
      return;
    }

    // Start new measurement
    if (startMeasurement(type)) {
      onmeasurementstart?.({ tool: type });
    }
  }

  /** Toggle display unit */
  function toggleUnit(): void {
    measurementDisplayUnit.update((current) => {
      if (current === 'um') return 'mm';
      if (current === 'mm') return 'px';
      return 'um';
    });
  }

  /** Format MPP for display */
  function formatMpp(mpp: number | null): string {
    if (mpp === null) return '—';
    if (mpp < 0.1) return mpp.toFixed(4);
    if (mpp < 1) return mpp.toFixed(3);
    return mpp.toFixed(2);
  }

  /** Get calibration display info */
  let calibrationInfo = $derived(CALIBRATION_DISPLAY[$currentCalibrationState]);
</script>

<div class="measurement-toolbar" class:blocked={$isMeasurementBlocked} class:dx-mode={$diagnosticMode}>
  <!-- Measurement Tools -->
  <div class="toolbar__tools">
    {#each MEASUREMENT_TOOLS as tool}
      <button
        class="toolbar__btn"
        class:active={$activeMeasurementTool === tool.type}
        class:disabled={!$canMeasure}
        onclick={() => selectTool(tool.type)}
        title={tool.label + (tool.shortcut ? ` (${tool.shortcut})` : '')}
        aria-label={tool.label}
        aria-pressed={$activeMeasurementTool === tool.type}
        disabled={!$canMeasure}
      >
        <span class="toolbar__icon">{tool.icon}</span>
        <span class="toolbar__label">{tool.label}</span>
      </button>
    {/each}
  </div>

  <!-- Calibration Info -->
  {#if showCalibration && $slideMetadata}
    <div class="toolbar__calibration">
      <!-- MPP Display (SYS-MSR-004) -->
      <div class="calibration__mpp" title="Microns per pixel">
        <span class="calibration__label">MPP:</span>
        <span class="calibration__value">{formatMpp($currentMpp)}</span>
        {#if $currentMppSource}
          <span class="calibration__source">({$currentMppSource})</span>
        {/if}
      </div>

      <!-- Calibration State (SYS-MSR-005) -->
      <div
        class="calibration__state"
        style="--calibration-color: {calibrationInfo.color}"
        title={calibrationInfo.label}
      >
        <span class="calibration__icon">{calibrationInfo.icon}</span>
        <span class="calibration__state-label">{calibrationInfo.label}</span>
      </div>

      <!-- Unit Toggle -->
      <button
        class="calibration__unit-btn"
        onclick={toggleUnit}
        title="Toggle measurement unit"
      >
        {$measurementDisplayUnit === 'um' ? 'μm' : $measurementDisplayUnit}
      </button>
    </div>
  {/if}

  <!-- Block Warning (SYS-MSR-007) -->
  {#if $isMeasurementBlocked}
    <div class="toolbar__warning">
      <span class="warning__icon">⚠</span>
      <span class="warning__text">Measurements blocked: Unknown scale</span>
    </div>
  {/if}
</div>

<style>
  .measurement-toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background-color: rgba(0, 0, 0, 0.85);
    border-radius: 8px;
    backdrop-filter: blur(4px);
    min-width: 200px;
  }

  .measurement-toolbar.dx-mode {
    border: 2px solid #f59e0b;
  }

  .measurement-toolbar.blocked {
    opacity: 0.7;
  }

  .toolbar__tools {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toolbar__btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    text-align: left;
  }

  .toolbar__btn:hover:not(.disabled) {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .toolbar__btn.active {
    background-color: #3b82f6;
  }

  .toolbar__btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toolbar__icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .toolbar__label {
    flex: 1;
  }

  .toolbar__calibration {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }

  .calibration__mpp {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    font-family: monospace;
  }

  .calibration__label {
    color: rgba(255, 255, 255, 0.6);
  }

  .calibration__value {
    font-weight: 600;
  }

  .calibration__source {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
  }

  .calibration__state {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    background-color: rgba(var(--calibration-color), 0.2);
    border-left: 3px solid var(--calibration-color);
  }

  .calibration__icon {
    color: var(--calibration-color);
    font-size: 14px;
  }

  .calibration__state-label {
    color: #fff;
    font-size: 12px;
    font-weight: 500;
  }

  .calibration__unit-btn {
    padding: 4px 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    background: transparent;
    color: #fff;
    font-size: 12px;
    font-family: monospace;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .calibration__unit-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .toolbar__warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background-color: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    border-radius: 4px;
  }

  .warning__icon {
    color: #ef4444;
    font-size: 16px;
  }

  .warning__text {
    color: #fca5a5;
    font-size: 12px;
  }
</style>
