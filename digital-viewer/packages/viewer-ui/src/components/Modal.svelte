<script lang="ts">
  /**
   * Modal Component
   *
   * Accessible modal dialog with backdrop
   */

  import { onMount, onDestroy } from 'svelte';

  /** Props */
  interface Props {
    open: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
    onclose?: () => void;
    header?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  }

  let {
    open = false,
    title,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true,
    onclose,
    header,
    children,
    footer,
  }: Props = $props();

  let dialog: HTMLDialogElement;

  function handleBackdropClick(e: MouseEvent): void {
    if (closeOnBackdrop && e.target === dialog) {
      onclose?.();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (closeOnEscape && e.key === 'Escape') {
      onclose?.();
    }
  }

  $effect(() => {
    if (open) {
      dialog?.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog?.close();
      document.body.style.overflow = '';
    }
  });

  onDestroy(() => {
    document.body.style.overflow = '';
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<dialog
  bind:this={dialog}
  class="modal modal--{size}"
  onclick={handleBackdropClick}
  aria-labelledby={title ? 'modal-title' : undefined}
>
  {#if open}
    <div class="modal__container">
      {#if header || title || showCloseButton}
        <div class="modal__header">
          {#if header}
            {@render header()}
          {:else if title}
            <h2 id="modal-title" class="modal__title">{title}</h2>
          {/if}
          {#if showCloseButton}
            <button
              class="modal__close"
              onclick={() => onclose?.()}
              aria-label="Close modal"
            >
              ×
            </button>
          {/if}
        </div>
      {/if}

      <div class="modal__body">
        {#if children}
          {@render children()}
        {/if}
      </div>

      {#if footer}
        <div class="modal__footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    max-width: 100%;
    max-height: 100%;
  }

  .modal::backdrop {
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .modal__container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal--sm .modal__container {
    width: 320px;
  }

  .modal--md .modal__container {
    width: 480px;
  }

  .modal--lg .modal__container {
    width: 640px;
  }

  .modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #374151;
  }

  .modal__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #f9fafb;
  }

  .modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #9ca3af;
    font-size: 24px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .modal__close:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #f9fafb;
  }

  .modal__body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
    color: #d1d5db;
  }

  .modal__footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 16px 20px;
    border-top: 1px solid #374151;
  }
</style>
