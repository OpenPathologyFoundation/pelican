<script lang="ts">
  /**
   * Tooltip Component
   *
   * Hover/focus tooltip for contextual help
   */

  /** Props */
  interface Props {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    children?: import('svelte').Snippet;
  }

  let {
    text,
    position = 'top',
    delay = 200,
    children,
  }: Props = $props();

  let visible = $state(false);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  function show(): void {
    timeout = setTimeout(() => {
      visible = true;
    }, delay);
  }

  function hide(): void {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    visible = false;
  }
</script>

<div
  class="tooltip-wrapper"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  role="group"
>
  {#if children}
    {@render children()}
  {/if}

  {#if visible}
    <div class="tooltip tooltip--{position}" role="tooltip">
      {text}
      <div class="tooltip__arrow"></div>
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }

  .tooltip {
    position: absolute;
    padding: 6px 10px;
    background-color: #111827;
    border: 1px solid #374151;
    border-radius: 6px;
    color: #f9fafb;
    font-size: 12px;
    white-space: nowrap;
    z-index: 1000;
    pointer-events: none;
    animation: tooltip-fade 0.15s ease-out;
  }

  @keyframes tooltip-fade {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .tooltip--top {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
  }

  .tooltip--bottom {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
  }

  .tooltip--left {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-right: 8px;
  }

  .tooltip--right {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 8px;
  }

  .tooltip__arrow {
    position: absolute;
    width: 8px;
    height: 8px;
    background-color: #111827;
    border: 1px solid #374151;
    transform: rotate(45deg);
  }

  .tooltip--top .tooltip__arrow {
    bottom: -5px;
    left: 50%;
    margin-left: -4px;
    border-top: none;
    border-left: none;
  }

  .tooltip--bottom .tooltip__arrow {
    top: -5px;
    left: 50%;
    margin-left: -4px;
    border-bottom: none;
    border-right: none;
  }

  .tooltip--left .tooltip__arrow {
    right: -5px;
    top: 50%;
    margin-top: -4px;
    border-bottom: none;
    border-left: none;
  }

  .tooltip--right .tooltip__arrow {
    left: -5px;
    top: 50%;
    margin-top: -4px;
    border-top: none;
    border-right: none;
  }
</style>
