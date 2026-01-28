<script lang="ts">
  /**
   * Toast Component
   *
   * Notification toasts for transient messages
   */

  import { onMount } from 'svelte';

  /** Props */
  interface Props {
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
    duration?: number; // 0 for no auto-dismiss
    dismissible?: boolean;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    ondismiss?: () => void;
  }

  let {
    message,
    variant = 'info',
    duration = 5000,
    dismissible = true,
    position = 'bottom-right',
    ondismiss,
  }: Props = $props();

  let visible = $state(true);
  let progress = $state(100);
  let animationFrame: number;
  let startTime: number;

  const icons: Record<typeof variant, string> = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠',
    error: '✗',
  };

  function dismiss(): void {
    visible = false;
    ondismiss?.();
  }

  onMount(() => {
    if (duration > 0) {
      startTime = Date.now();

      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.max(0, 100 - (elapsed / duration) * 100);

        if (progress > 0) {
          animationFrame = requestAnimationFrame(updateProgress);
        } else {
          dismiss();
        }
      };

      animationFrame = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  });
</script>

{#if visible}
  <div class="toast toast--{variant} toast--{position}" role="alert">
    <span class="toast__icon">{icons[variant]}</span>
    <span class="toast__message">{message}</span>
    {#if dismissible}
      <button class="toast__dismiss" onclick={dismiss} aria-label="Dismiss">
        ×
      </button>
    {/if}
    {#if duration > 0}
      <div class="toast__progress" style="width: {progress}%"></div>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    background-color: #1f2937;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    z-index: 3000;
    max-width: 400px;
    overflow: hidden;
    animation: slide-in 0.3s ease-out;
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Positions */
  .toast--top-right {
    top: 20px;
    right: 20px;
  }

  .toast--top-left {
    top: 20px;
    left: 20px;
  }

  .toast--bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .toast--bottom-left {
    bottom: 20px;
    left: 20px;
  }

  /* Variants */
  .toast--info {
    border-left: 4px solid #3b82f6;
  }

  .toast--success {
    border-left: 4px solid #22c55e;
  }

  .toast--warning {
    border-left: 4px solid #f59e0b;
  }

  .toast--error {
    border-left: 4px solid #ef4444;
  }

  .toast__icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .toast--info .toast__icon {
    color: #3b82f6;
  }

  .toast--success .toast__icon {
    color: #22c55e;
  }

  .toast--warning .toast__icon {
    color: #f59e0b;
  }

  .toast--error .toast__icon {
    color: #ef4444;
  }

  .toast__message {
    flex: 1;
    font-size: 14px;
    color: #f9fafb;
  }

  .toast__dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #9ca3af;
    font-size: 18px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .toast__dismiss:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #f9fafb;
  }

  .toast__progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background-color: currentColor;
    opacity: 0.3;
    transition: width 0.1s linear;
  }

  .toast--info .toast__progress {
    background-color: #3b82f6;
  }

  .toast--success .toast__progress {
    background-color: #22c55e;
  }

  .toast--warning .toast__progress {
    background-color: #f59e0b;
  }

  .toast--error .toast__progress {
    background-color: #ef4444;
  }
</style>
