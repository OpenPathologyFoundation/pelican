<script lang="ts">
  /**
   * ViewerToolbar Component - Navigation Controls
   *
   * Provides zoom, pan, rotation, and tool controls
   * Updated for Svelte 5 with runes
   */

  import {
    viewportState,
    currentMagnification,
    activeDrawingTool,
    diagnosticMode,
  } from '../stores';
  import type { AnnotationType } from '../types';

  /** Props */
  interface Props {
    showZoom?: boolean;
    showRotation?: boolean;
    showDrawing?: boolean;
    showHome?: boolean;
    onzoomin?: () => void;
    onzoomout?: () => void;
    onzoomfit?: () => void;
    onrotateleft?: () => void;
    onrotateright?: () => void;
    onrotatereset?: () => void;
    onhome?: () => void;
    ontoolselect?: (data: { tool: AnnotationType | null }) => void;
  }

  let {
    showZoom = true,
    showRotation = true,
    showDrawing = true,
    showHome = true,
    onzoomin,
    onzoomout,
    onzoomfit,
    onrotateleft,
    onrotateright,
    onrotatereset,
    onhome,
    ontoolselect,
  }: Props = $props();

  /** Drawing tools */
  const drawingTools: { id: AnnotationType; icon: string; label: string }[] = [
    { id: 'point', icon: '•', label: 'Point' },
    { id: 'rectangle', icon: '□', label: 'Rectangle' },
    { id: 'ellipse', icon: '○', label: 'Ellipse' },
    { id: 'polygon', icon: '⬡', label: 'Polygon' },
    { id: 'polyline', icon: '⌇', label: 'Line' },
    { id: 'freehand', icon: '✎', label: 'Freehand' },
  ];

  /** Select drawing tool */
  function selectTool(tool: AnnotationType | null): void {
    if ($activeDrawingTool === tool) {
      activeDrawingTool.set(null);
      ontoolselect?.({ tool: null });
    } else {
      activeDrawingTool.set(tool);
      ontoolselect?.({ tool });
    }
  }

  /** Format zoom percentage */
  function formatZoom(zoom: number): string {
    return `${Math.round(zoom * 100)}%`;
  }

  /** Format magnification */
  function formatMag(mag: number | null): string {
    if (mag === null) return '';
    if (mag < 1) return `${mag.toFixed(1)}×`;
    return `${Math.round(mag)}×`;
  }
</script>

<div class="toolbar" class:diagnostic-mode={$diagnosticMode}>
  <!-- Zoom controls -->
  {#if showZoom}
    <div class="toolbar__group">
      <button
        class="toolbar__btn"
        onclick={() => onzoomout?.()}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        −
      </button>
      <span class="toolbar__zoom-level">
        {formatZoom($viewportState.zoom)}
        {#if $currentMagnification !== null}
          <small>({formatMag($currentMagnification)})</small>
        {/if}
      </span>
      <button
        class="toolbar__btn"
        onclick={() => onzoomin?.()}
        title="Zoom In"
        aria-label="Zoom In"
      >
        +
      </button>
      <button
        class="toolbar__btn"
        onclick={() => onzoomfit?.()}
        title="Fit to View"
        aria-label="Fit to View"
      >
        ⊡
      </button>
    </div>
  {/if}

  <!-- Rotation controls -->
  {#if showRotation}
    <div class="toolbar__group">
      <button
        class="toolbar__btn"
        onclick={() => onrotateleft?.()}
        title="Rotate Left 90°"
        aria-label="Rotate Left"
      >
        ↺
      </button>
      <span class="toolbar__rotation">
        {Math.round($viewportState.rotation)}°
      </span>
      <button
        class="toolbar__btn"
        onclick={() => onrotateright?.()}
        title="Rotate Right 90°"
        aria-label="Rotate Right"
      >
        ↻
      </button>
      {#if $viewportState.rotation !== 0}
        <button
          class="toolbar__btn toolbar__btn--small"
          onclick={() => onrotatereset?.()}
          title="Reset Rotation"
          aria-label="Reset Rotation"
        >
          ⟲
        </button>
      {/if}
    </div>
  {/if}

  <!-- Home button -->
  {#if showHome}
    <div class="toolbar__group">
      <button
        class="toolbar__btn"
        onclick={() => onhome?.()}
        title="Go to Home View"
        aria-label="Home"
      >
        ⌂
      </button>
    </div>
  {/if}

  <!-- Drawing tools -->
  {#if showDrawing}
    <div class="toolbar__group toolbar__group--drawing">
      {#each drawingTools as tool}
        <button
          class="toolbar__btn toolbar__btn--tool"
          class:active={$activeDrawingTool === tool.id}
          onclick={() => selectTool(tool.id)}
          title={tool.label}
          aria-label={tool.label}
          aria-pressed={$activeDrawingTool === tool.id}
        >
          {tool.icon}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    backdrop-filter: blur(4px);
  }

  .toolbar.diagnostic-mode {
    border: 2px solid #f59e0b;
  }

  .toolbar__group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar__group--drawing {
    border-left: 1px solid rgba(255, 255, 255, 0.2);
    padding-left: 16px;
  }

  .toolbar__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .toolbar__btn:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .toolbar__btn:active {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .toolbar__btn--small {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }

  .toolbar__btn--tool.active {
    background-color: #3b82f6;
  }

  .toolbar__zoom-level,
  .toolbar__rotation {
    color: #fff;
    font-size: 12px;
    font-family: monospace;
    min-width: 60px;
    text-align: center;
  }

  .toolbar__zoom-level small {
    opacity: 0.7;
    margin-left: 4px;
  }
</style>
