<script lang="ts">
  /**
   * Badge Component
   *
   * Status badges and labels
   */

  /** Props */
  interface Props {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    size?: 'sm' | 'md';
    pill?: boolean;
    icon?: string;
    children?: import('svelte').Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    pill = false,
    icon,
    children,
  }: Props = $props();
</script>

<span class="badge badge--{variant} badge--{size}" class:badge--pill={pill}>
  {#if icon}
    <span class="badge__icon">{icon}</span>
  {/if}
  <span class="badge__text">
    {#if children}
      {@render children()}
    {/if}
  </span>
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    border-radius: 4px;
  }

  .badge--pill {
    border-radius: 9999px;
  }

  /* Sizes */
  .badge--sm {
    padding: 2px 6px;
    font-size: 10px;
  }

  .badge--md {
    padding: 4px 10px;
    font-size: 12px;
  }

  /* Variants */
  .badge--default {
    background-color: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
  }

  .badge--success {
    background-color: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .badge--warning {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .badge--error {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .badge--info {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .badge__icon {
    font-size: 1em;
  }
</style>
