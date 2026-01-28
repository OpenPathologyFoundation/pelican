<script lang="ts">
  /**
   * ErrorOverlay Component
   *
   * Displays error states for the viewer
   * Per SRS-001 SYS-ERR-001 through SYS-ERR-004
   */

  /** Error types */
  export type ErrorType =
    | 'tile-failure' // >50% tile failures (SYS-ERR-001)
    | 'service-unavailable' // Portal endpoint unreachable (SYS-ERR-002)
    | 'auth-expired' // JWT expired (SYS-ERR-003)
    | 'superseded'; // Viewing superseded scan (SYS-ERR-004)

  /** Props */
  interface Props {
    type: ErrorType;
    message?: string;
    currentScanId?: string;
    latestScanId?: string;
    onretry?: () => void;
    onreauth?: () => void;
    onviewlatest?: () => void;
    ondismiss?: () => void;
  }

  let {
    type,
    message,
    currentScanId,
    latestScanId,
    onretry,
    onreauth,
    onviewlatest,
    ondismiss,
  }: Props = $props();

  /** Get error configuration */
  function getErrorConfig(errorType: ErrorType): {
    title: string;
    defaultMessage: string;
    icon: string;
    severity: 'warning' | 'error' | 'info';
    canDismiss: boolean;
  } {
    switch (errorType) {
      case 'tile-failure':
        return {
          title: 'Image Temporarily Unavailable',
          defaultMessage:
            'Unable to load image tiles. This may be due to network issues or server load.',
          icon: '🖼️',
          severity: 'error',
          canDismiss: false,
        };
      case 'service-unavailable':
        return {
          title: 'Service Unavailable',
          defaultMessage:
            'Unable to connect to the portal service. Please check your network connection.',
          icon: '🔌',
          severity: 'error',
          canDismiss: false,
        };
      case 'auth-expired':
        return {
          title: 'Session Expired',
          defaultMessage:
            'Your session has expired. Please sign in again to continue.',
          icon: '🔒',
          severity: 'warning',
          canDismiss: false,
        };
      case 'superseded':
        return {
          title: 'Viewing Superseded Scan',
          defaultMessage:
            'This scan has been superseded by a newer version. Annotations and measurements are preserved on this scan.',
          icon: 'ℹ️',
          severity: 'info',
          canDismiss: true,
        };
      default:
        return {
          title: 'Error',
          defaultMessage: 'An unexpected error occurred.',
          icon: '⚠️',
          severity: 'error',
          canDismiss: true,
        };
    }
  }

  let config = $derived(getErrorConfig(type));
  let displayMessage = $derived(message || config.defaultMessage);
</script>

<div class="error-overlay" class:warning={config.severity === 'warning'} class:info={config.severity === 'info'}>
  <div class="error-overlay__backdrop"></div>

  <div class="error-overlay__content">
    <div class="error-overlay__icon">{config.icon}</div>
    <h2 class="error-overlay__title">{config.title}</h2>
    <p class="error-overlay__message">{displayMessage}</p>

    {#if type === 'superseded' && currentScanId && latestScanId}
      <div class="error-overlay__scan-info">
        <span class="scan-label">Current scan:</span>
        <code class="scan-id">{currentScanId}</code>
        <span class="scan-label">Latest scan:</span>
        <code class="scan-id">{latestScanId}</code>
      </div>
    {/if}

    <div class="error-overlay__actions">
      {#if type === 'tile-failure' || type === 'service-unavailable'}
        <button class="error-btn error-btn--primary" onclick={() => onretry?.()}>
          Retry
        </button>
      {/if}

      {#if type === 'auth-expired'}
        <button class="error-btn error-btn--primary" onclick={() => onreauth?.()}>
          Sign In
        </button>
      {/if}

      {#if type === 'superseded'}
        <button class="error-btn error-btn--primary" onclick={() => onviewlatest?.()}>
          View Latest Scan
        </button>
        <button class="error-btn error-btn--secondary" onclick={() => ondismiss?.()}>
          Continue Viewing
        </button>
      {/if}

      {#if config.canDismiss && type !== 'superseded'}
        <button class="error-btn error-btn--secondary" onclick={() => ondismiss?.()}>
          Dismiss
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .error-overlay__backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .error-overlay__content {
    position: relative;
    max-width: 480px;
    padding: 32px;
    background-color: #1f2937;
    border-radius: 12px;
    border: 2px solid #ef4444;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .error-overlay.warning .error-overlay__content {
    border-color: #f59e0b;
  }

  .error-overlay.info .error-overlay__content {
    border-color: #3b82f6;
  }

  .error-overlay__icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .error-overlay__title {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 600;
    color: #f9fafb;
  }

  .error-overlay__message {
    margin: 0 0 24px 0;
    font-size: 14px;
    line-height: 1.6;
    color: #9ca3af;
  }

  .error-overlay__scan-info {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    margin-bottom: 24px;
    padding: 12px;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    text-align: left;
    font-size: 12px;
  }

  .scan-label {
    color: #6b7280;
  }

  .scan-id {
    color: #d1d5db;
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .error-overlay__actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .error-btn {
    padding: 10px 24px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .error-btn:active {
    transform: scale(0.98);
  }

  .error-btn--primary {
    background-color: #3b82f6;
    color: #fff;
  }

  .error-btn--primary:hover {
    background-color: #2563eb;
  }

  .error-btn--secondary {
    background-color: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
  }

  .error-btn--secondary:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }
</style>
