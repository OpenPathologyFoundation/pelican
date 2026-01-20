<script lang="ts">
  /**
   * CaseSwitchDialog Component - Case Change Confirmation
   *
   * Prompts user to confirm when switching between cases to prevent
   * accidental context changes during diagnostic review.
   *
   * Requirements (per FDP spec):
   * - MUST prompt before switching cases
   * - MUST show both current and requested case info
   * - MUST require explicit user action to proceed
   */

  /** Props */
  interface Props {
    /** Whether dialog is open */
    open?: boolean;
    /** Current case ID */
    currentCaseId: string;
    /** Current patient name */
    currentPatient: string;
    /** Requested case ID */
    newCaseId: string;
    /** Requested patient name */
    newPatient: string;
    /** Callback when confirmed */
    onconfirm?: () => void;
    /** Callback when cancelled */
    oncancel?: () => void;
  }

  let {
    open = false,
    currentCaseId,
    currentPatient,
    newCaseId,
    newPatient,
    onconfirm,
    oncancel,
  }: Props = $props();

  /** Handle backdrop click */
  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      oncancel?.();
    }
  }

  /** Handle keydown for escape */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      oncancel?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="dialog-backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
    tabindex="-1"
  >
    <div class="dialog">
      <div class="dialog__header">
        <h2 id="dialog-title" class="dialog__title">Switch Case?</h2>
      </div>

      <div class="dialog__content">
        <p class="dialog__message">
          You are about to switch to a different case. Please confirm this is
          intentional.
        </p>

        <div class="case-comparison">
          <div class="case-comparison__item case-comparison__item--current">
            <span class="case-comparison__label">Current Case</span>
            <span class="case-comparison__id">{currentCaseId}</span>
            <span class="case-comparison__patient">{currentPatient}</span>
          </div>

          <div class="case-comparison__arrow">→</div>

          <div class="case-comparison__item case-comparison__item--new">
            <span class="case-comparison__label">New Case</span>
            <span class="case-comparison__id">{newCaseId}</span>
            <span class="case-comparison__patient">{newPatient}</span>
          </div>
        </div>
      </div>

      <div class="dialog__actions">
        <button class="dialog__btn dialog__btn--cancel" onclick={() => oncancel?.()}>
          Stay on Current Case
        </button>
        <button class="dialog__btn dialog__btn--confirm" onclick={() => onconfirm?.()}>
          Switch Case
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
    animation: fadeIn 150ms ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .dialog {
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    max-width: 500px;
    width: 90%;
    animation: slideIn 200ms ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .dialog__header {
    padding: 20px 24px;
    border-bottom: 1px solid #333;
  }

  .dialog__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
  }

  .dialog__content {
    padding: 20px 24px;
  }

  .dialog__message {
    margin: 0 0 20px;
    color: #ccc;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .case-comparison {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 16px;
  }

  .case-comparison__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
  }

  .case-comparison__item--current {
    border: 1px solid #4b5563;
  }

  .case-comparison__item--new {
    border: 1px solid #3b82f6;
  }

  .case-comparison__label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
  }

  .case-comparison__id {
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
  }

  .case-comparison__patient {
    font-size: 0.85rem;
    color: #ccc;
  }

  .case-comparison__arrow {
    font-size: 1.5rem;
    color: #666;
    flex-shrink: 0;
  }

  .dialog__actions {
    display: flex;
    gap: 12px;
    padding: 16px 24px 20px;
    border-top: 1px solid #333;
  }

  .dialog__btn {
    flex: 1;
    padding: 12px 20px;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms, transform 100ms;
  }

  .dialog__btn:active {
    transform: scale(0.98);
  }

  .dialog__btn--cancel {
    background: #374151;
    color: #fff;
  }

  .dialog__btn--cancel:hover {
    background: #4b5563;
  }

  .dialog__btn--confirm {
    background: #3b82f6;
    color: #fff;
  }

  .dialog__btn--confirm:hover {
    background: #2563eb;
  }
</style>
