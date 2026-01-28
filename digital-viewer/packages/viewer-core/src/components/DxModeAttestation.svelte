<script lang="ts">
  /**
   * DxModeAttestation Component
   *
   * Attestation form required before disabling Diagnostic Mode
   * Per SRS-001 SYS-DXM-004
   *
   * This ensures users acknowledge the implications of disabling
   * diagnostic safety controls before proceeding.
   */

  import { createEventDispatcher } from 'svelte';
  import { diagnosticMode } from '../stores';

  const dispatch = createEventDispatcher<{
    confirm: { reason: string; attestedAt: string };
    cancel: void;
  }>();

  /** Props */
  interface Props {
    caseId?: string;
    patientId?: string;
    onconfirm?: (data: { reason: string; attestedAt: string }) => void;
    oncancel?: () => void;
  }

  let {
    caseId,
    patientId,
    onconfirm,
    oncancel,
  }: Props = $props();

  let reason = $state('');
  let acknowledged = $state(false);
  let error = $state('');

  /** Predefined reasons for disabling DX mode */
  const REASONS = [
    { value: 'education', label: 'Educational/Training Purpose' },
    { value: 'research', label: 'Research/Non-Clinical Review' },
    { value: 'conference', label: 'Case Conference Preparation' },
    { value: 'second-opinion', label: 'Second Opinion (Non-Signout)' },
    { value: 'other', label: 'Other (specify in notes)' },
  ];

  let selectedReason = $state('');
  let otherReason = $state('');

  /** Get the full reason text */
  function getFullReason(): string {
    if (selectedReason === 'other') {
      return otherReason.trim() || 'Other (unspecified)';
    }
    const found = REASONS.find((r) => r.value === selectedReason);
    return found?.label || selectedReason;
  }

  /** Validate and confirm */
  function handleConfirm(): void {
    error = '';

    if (!selectedReason) {
      error = 'Please select a reason for disabling Diagnostic Mode';
      return;
    }

    if (selectedReason === 'other' && !otherReason.trim()) {
      error = 'Please specify the reason';
      return;
    }

    if (!acknowledged) {
      error = 'Please acknowledge the attestation statement';
      return;
    }

    const attestation = {
      reason: getFullReason(),
      attestedAt: new Date().toISOString(),
    };

    // Disable diagnostic mode
    diagnosticMode.set(false);

    dispatch('confirm', attestation);
    onconfirm?.(attestation);
  }

  /** Cancel and keep DX mode enabled */
  function handleCancel(): void {
    dispatch('cancel');
    oncancel?.();
  }
</script>

<div class="attestation-modal" role="dialog" aria-modal="true" aria-labelledby="attestation-title">
  <div class="attestation__backdrop"></div>

  <div class="attestation__dialog">
    <div class="attestation__header">
      <div class="attestation__icon">⚠️</div>
      <h2 id="attestation-title" class="attestation__title">
        Disable Diagnostic Mode
      </h2>
    </div>

    <div class="attestation__body">
      <div class="attestation__warning">
        <strong>Warning:</strong> Diagnostic Mode provides important safety controls
        for clinical case review, including:
        <ul>
          <li>Non-collapsible case identification header</li>
          <li>Measurement blocking on uncalibrated slides</li>
          <li>Enhanced focus declaration protocol</li>
        </ul>
      </div>

      {#if caseId || patientId}
        <div class="attestation__context">
          {#if caseId}
            <span class="context-item">Case: <strong>{caseId}</strong></span>
          {/if}
          {#if patientId}
            <span class="context-item">Patient: <strong>{patientId}</strong></span>
          {/if}
        </div>
      {/if}

      <div class="attestation__form">
        <label class="form-label" for="reason-select">
          Reason for disabling Diagnostic Mode:
          <span class="required">*</span>
        </label>
        <select
          id="reason-select"
          class="form-select"
          bind:value={selectedReason}
        >
          <option value="">Select a reason...</option>
          {#each REASONS as r}
            <option value={r.value}>{r.label}</option>
          {/each}
        </select>

        {#if selectedReason === 'other'}
          <input
            type="text"
            class="form-input"
            placeholder="Please specify..."
            bind:value={otherReason}
          />
        {/if}

        <div class="attestation__checkbox">
          <input
            type="checkbox"
            id="acknowledge"
            bind:checked={acknowledged}
          />
          <label for="acknowledge">
            I attest that I am disabling Diagnostic Mode for a non-clinical
            purpose and understand that clinical sign-out should not be performed
            without Diagnostic Mode enabled.
          </label>
        </div>

        {#if error}
          <div class="attestation__error" role="alert">
            {error}
          </div>
        {/if}
      </div>
    </div>

    <div class="attestation__footer">
      <button
        class="attestation-btn attestation-btn--secondary"
        onclick={handleCancel}
      >
        Cancel
      </button>
      <button
        class="attestation-btn attestation-btn--danger"
        onclick={handleConfirm}
        disabled={!selectedReason || !acknowledged}
      >
        Disable Diagnostic Mode
      </button>
    </div>

    <div class="attestation__notice">
      This action will be logged for audit purposes (Tier 2 event).
    </div>
  </div>
</div>

<style>
  .attestation-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .attestation__backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
  }

  .attestation__dialog {
    position: relative;
    width: 100%;
    max-width: 520px;
    margin: 16px;
    background-color: #1f2937;
    border-radius: 12px;
    border: 2px solid #f59e0b;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .attestation__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 24px 16px;
    background: linear-gradient(135deg, #451a03 0%, #1f2937 100%);
    border-bottom: 1px solid #374151;
  }

  .attestation__icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .attestation__title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    color: #fbbf24;
  }

  .attestation__body {
    padding: 20px 24px;
  }

  .attestation__warning {
    padding: 12px 16px;
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid #f59e0b;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 13px;
    color: #fcd34d;
  }

  .attestation__warning ul {
    margin: 8px 0 0 20px;
    padding: 0;
  }

  .attestation__warning li {
    margin: 4px 0;
  }

  .attestation__context {
    display: flex;
    gap: 16px;
    padding: 10px 12px;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 12px;
  }

  .context-item {
    color: #9ca3af;
  }

  .context-item strong {
    color: #f9fafb;
  }

  .attestation__form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-label {
    font-size: 14px;
    color: #d1d5db;
    font-weight: 500;
  }

  .required {
    color: #ef4444;
  }

  .form-select,
  .form-input {
    width: 100%;
    padding: 10px 12px;
    background-color: #374151;
    border: 1px solid #4b5563;
    border-radius: 6px;
    color: #f9fafb;
    font-size: 14px;
  }

  .form-select:focus,
  .form-input:focus {
    outline: none;
    border-color: #f59e0b;
  }

  .attestation__checkbox {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    margin-top: 8px;
  }

  .attestation__checkbox input {
    margin-top: 2px;
    width: 18px;
    height: 18px;
    accent-color: #f59e0b;
  }

  .attestation__checkbox label {
    font-size: 13px;
    color: #d1d5db;
    line-height: 1.5;
  }

  .attestation__error {
    padding: 10px 12px;
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    border-radius: 4px;
    color: #fca5a5;
    font-size: 13px;
  }

  .attestation__footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 16px 24px;
    border-top: 1px solid #374151;
  }

  .attestation-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .attestation-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .attestation-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attestation-btn--secondary {
    background-color: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
  }

  .attestation-btn--secondary:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .attestation-btn--danger {
    background-color: #dc2626;
    color: #fff;
  }

  .attestation-btn--danger:hover:not(:disabled) {
    background-color: #b91c1c;
  }

  .attestation__notice {
    padding: 10px 24px;
    background-color: rgba(0, 0, 0, 0.3);
    font-size: 11px;
    color: #6b7280;
    text-align: center;
  }
</style>
