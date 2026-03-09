<script lang="ts">
  /**
   * FrameNavigator Component - Multi-Frame Navigation
   *
   * Compact stepper for navigating multi-page/multi-frame images
   * (e.g. Z-stack OME-TIFF). Only visible when frameCount > 1.
   */

  import { currentFrameIndex, slideMetadata } from '../stores';
  import type { FrameInfo } from '../types';

  interface Props {
    onframechange?: (data: { frame: number }) => void;
  }

  let { onframechange }: Props = $props();

  const metadata = $derived($slideMetadata);
  const frameCount = $derived(metadata?.frameCount ?? 1);
  const frames = $derived(metadata?.frames);
  const frameIndex = $derived($currentFrameIndex);

  /** Label for the current frame (Z-index, channel name, or plain index) */
  const frameLabel = $derived.by(() => {
    if (!frames || frameIndex >= frames.length) return '';
    const f = frames[frameIndex];
    const parts: string[] = [];
    if (f.indexZ !== undefined && (metadata?.frameIndexRange?.IndexZ ?? 0) > 1) {
      parts.push(`Z${f.indexZ + 1}`);
    }
    if (f.indexT !== undefined && (metadata?.frameIndexRange?.IndexT ?? 0) > 1) {
      parts.push(`T${f.indexT + 1}`);
    }
    if (f.channel) {
      parts.push(f.channel);
    } else if (f.indexC !== undefined && (metadata?.frameIndexRange?.IndexC ?? 0) > 1) {
      parts.push(`Ch${f.indexC + 1}`);
    }
    return parts.length > 0 ? parts.join(' ') : '';
  });

  /** Dimension summary for the tooltip */
  const dimensionSummary = $derived.by(() => {
    const r = metadata?.frameIndexRange;
    if (!r) return '';
    const parts: string[] = [];
    if (r.IndexZ && r.IndexZ > 1) parts.push(`${r.IndexZ} Z-planes`);
    if (r.IndexC && r.IndexC > 1) parts.push(`${r.IndexC} channels`);
    if (r.IndexT && r.IndexT > 1) parts.push(`${r.IndexT} time points`);
    return parts.join(', ');
  });

  function prevFrame(): void {
    if (frameIndex > 0) {
      const next = frameIndex - 1;
      currentFrameIndex.set(next);
      onframechange?.({ frame: next });
    }
  }

  function nextFrame(): void {
    if (frameIndex < frameCount - 1) {
      const next = frameIndex + 1;
      currentFrameIndex.set(next);
      onframechange?.({ frame: next });
    }
  }
</script>

{#if frameCount > 1}
  <div class="frame-nav" title={dimensionSummary}>
    <button
      class="frame-nav__btn"
      onclick={prevFrame}
      disabled={frameIndex === 0}
      title="Previous frame ( [ )"
      aria-label="Previous frame"
    >
      &lsaquo;
    </button>
    <span class="frame-nav__label">
      <span class="frame-nav__index">{frameIndex + 1}/{frameCount}</span>
      {#if frameLabel}
        <span class="frame-nav__dim">{frameLabel}</span>
      {/if}
    </span>
    <button
      class="frame-nav__btn"
      onclick={nextFrame}
      disabled={frameIndex === frameCount - 1}
      title="Next frame ( ] )"
      aria-label="Next frame"
    >
      &rsaquo;
    </button>
  </div>
{/if}

<style>
  .frame-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 6px;
    backdrop-filter: blur(4px);
    user-select: none;
  }

  .frame-nav__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background-color: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.15s ease;
    line-height: 1;
  }

  .frame-nav__btn:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.25);
  }

  .frame-nav__btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .frame-nav__label {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 48px;
  }

  .frame-nav__index {
    color: #fff;
    font-size: 12px;
    font-family: monospace;
    font-weight: 600;
  }

  .frame-nav__dim {
    color: rgba(255, 255, 255, 0.6);
    font-size: 9px;
    font-family: monospace;
    white-space: nowrap;
  }
</style>
