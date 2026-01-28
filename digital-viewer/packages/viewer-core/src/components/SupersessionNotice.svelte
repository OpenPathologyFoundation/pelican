<script lang="ts">
  /**
   * SupersessionNotice Component
   *
   * Non-blocking notice when viewing a superseded scan
   * Per SRS-001 SYS-ERR-004
   */

  /** Props */
  interface Props {
    currentScanId: string;
    latestScanId: string;
    supersededAt?: string;
    reason?: string;
    onviewlatest?: () => void;
    ondismiss?: () => void;
  }

  let {
    currentScanId,
    latestScanId,
    supersededAt,
    reason,
    onviewlatest,
    ondismiss,
  }: Props = $props();

  let dismissed = $state(false);

  /** Format date */
  function formatDate(isoString?: string): string {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  function handleDismiss(): void {
    dismissed = true;
    ondismiss?.();
  }
</script>

{#if !dismissed}
  <div class="supersession-notice" role="alert">
    <div class="notice__icon">ℹ️</div>

    <div class="notice__content">
      <div class="notice__title">Viewing Superseded Scan</div>
      <div class="notice__details">
        <span>This scan has been replaced by a newer version.</span>
        {#if supersededAt}
          <span class="notice__date">Superseded {formatDate(supersededAt)}</span>
        {/if}
        {#if reason}
          <span class="notice__reason">Reason: {reason}</span>
        {/if}
      </div>
      <div class="notice__scan-ids">
        <span class="scan-label">Current:</span>
        <code>{currentScanId.slice(-8)}</code>
        <span class="scan-arrow">→</span>
        <span class="scan-label">Latest:</span>
        <code>{latestScanId.slice(-8)}</code>
      </div>
    </div>

    <div class="notice__actions">
      <button class="notice__btn notice__btn--primary" onclick={() => onviewlatest?.()}>
        View Latest
      </button>
      <button class="notice__btn notice__btn--dismiss" onclick={handleDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  </div>
{/if}

<style>
  .supersession-notice {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background-color: rgba(59, 130, 246, 0.15);
    border: 1px solid #3b82f6;
    border-radius: 8px;
    backdrop-filter: blur(4px);
    max-width: 480px;
  }

  .notice__icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .notice__content {
    flex: 1;
    min-width: 0;
  }

  .notice__title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 4px;
  }

  .notice__details {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
  }

  .notice__date,
  .notice__reason {
    display: block;
    margin-top: 2px;
  }

  .notice__scan-ids {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .notice__scan-ids code {
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.3);
    padding: 2px 4px;
    border-radius: 3px;
    color: #93c5fd;
  }

  .scan-label {
    color: rgba(255, 255, 255, 0.5);
  }

  .scan-arrow {
    color: rgba(255, 255, 255, 0.3);
  }

  .notice__actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .notice__btn {
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .notice__btn--primary {
    padding: 6px 12px;
    background-color: #3b82f6;
    color: #fff;
    font-weight: 500;
  }

  .notice__btn--primary:hover {
    background-color: #2563eb;
  }

  .notice__btn--dismiss {
    padding: 2px 8px;
    background-color: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 16px;
  }

  .notice__btn--dismiss:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.1);
  }
</style>
