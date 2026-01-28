<script lang="ts">
  /**
   * Button Component
   *
   * Reusable button with variants and states
   */

  /** Props */
  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    type = 'button',
    onclick,
    children,
  }: Props = $props();
</script>

<button
  class="btn btn--{variant} btn--{size}"
  class:btn--full-width={fullWidth}
  class:btn--loading={loading}
  {type}
  disabled={disabled || loading}
  onclick={(e) => onclick?.(e)}
>
  {#if loading}
    <span class="btn__spinner"></span>
  {/if}
  <span class="btn__content" class:hidden={loading}>
    {#if children}
      {@render children()}
    {/if}
  </span>
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
    position: relative;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn--sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn--md {
    padding: 10px 20px;
    font-size: 14px;
  }

  .btn--lg {
    padding: 14px 28px;
    font-size: 16px;
  }

  /* Variants */
  .btn--primary {
    background-color: #3b82f6;
    color: #fff;
  }

  .btn--primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .btn--secondary {
    background-color: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .btn--secondary:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .btn--ghost {
    background-color: transparent;
    color: #d1d5db;
  }

  .btn--ghost:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .btn--danger {
    background-color: #ef4444;
    color: #fff;
  }

  .btn--danger:hover:not(:disabled) {
    background-color: #dc2626;
  }

  /* Full width */
  .btn--full-width {
    width: 100%;
  }

  /* Loading state */
  .btn--loading .btn__content {
    visibility: hidden;
  }

  .btn__spinner {
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .hidden {
    visibility: hidden;
  }
</style>
