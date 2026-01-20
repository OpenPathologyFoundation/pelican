<script lang="ts">
  /**
   * Viewer Component - Main OpenSeadragon Viewer
   *
   * Based on Pathology Portal Platform Specification v2.1
   * Updated for Svelte 5 with runes
   */

  import { onMount, onDestroy } from 'svelte';
  import OpenSeadragon from 'openseadragon';
  import { TileSourceFactory } from '../tile-source';
  import {
    viewerConfig,
    slideMetadata,
    currentSlideId,
    viewportState,
    viewerReady,
    isLoading,
    viewerError,
  } from '../stores';
  import type {
    ViewerConfig,
    ViewportState,
    SlideMetadata,
  } from '../types';

  /** Props */
  interface Props {
    slideId?: string | null;
    config?: Partial<ViewerConfig>;
    onready?: () => void;
    onopen?: (data: { metadata: SlideMetadata }) => void;
    onopenfailed?: (data: { error: string }) => void;
    onclose?: () => void;
    onviewportchange?: (data: { viewport: ViewportState }) => void;
    onzoom?: (data: { zoom: number }) => void;
    onpan?: (data: { center: { x: number; y: number } }) => void;
    onrotate?: (data: { rotation: number }) => void;
    oncanvasclick?: (data: { point: { x: number; y: number } }) => void;
    oncanvasdoubleclick?: (data: { point: { x: number; y: number } }) => void;
  }

  let {
    slideId = null,
    config = {},
    onready,
    onopen,
    onopenfailed,
    onclose,
    onviewportchange,
    onzoom,
    onpan,
    onrotate,
    oncanvasclick,
    oncanvasdoubleclick,
  }: Props = $props();

  /** Internal state */
  let containerEl: HTMLDivElement | undefined = $state();
  let viewer: OpenSeadragon.Viewer | null = $state(null);
  let tileSourceFactory: TileSourceFactory | null = $state(null);

  /** Update viewport state from OSD */
  function updateViewportState(): void {
    if (!viewer || !viewer.viewport) return;

    const vp = viewer.viewport;
    const center = vp.getCenter(true);
    const bounds = vp.getBounds(true);

    const state: ViewportState = {
      center: { x: center.x, y: center.y },
      zoom: vp.getZoom(true),
      rotation: vp.getRotation(),
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    };

    viewportState.set(state);
    onviewportchange?.({ viewport: state });
  }

  /** Initialize OpenSeadragon viewer */
  function initViewer(): void {
    if (!containerEl) return;

    const currentConfig = { ...$viewerConfig, ...config };

    viewer = OpenSeadragon({
      element: containerEl,
      prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',

      // Navigator
      showNavigator: currentConfig.showNavigator,
      navigatorPosition: currentConfig.navigatorPosition,

      // Controls
      showNavigationControl: currentConfig.showNavigationControl,
      showZoomControl: currentConfig.showZoomControl,
      showHomeControl: currentConfig.showHomeControl,
      showFullPageControl: currentConfig.showFullPageControl,
      showRotationControl: currentConfig.showRotationControl,

      // Behavior
      minZoomLevel: currentConfig.minZoomLevel,
      maxZoomLevel: currentConfig.maxZoomLevel,
      defaultZoomLevel: currentConfig.defaultZoomLevel,
      visibilityRatio: currentConfig.visibilityRatio,
      constrainDuringPan: currentConfig.constrainDuringPan,

      // Animation
      animationTime: currentConfig.animationTime,
      springStiffness: currentConfig.springStiffness,

      // Appearance
      debugMode: currentConfig.debugMode,
      crossOriginPolicy: currentConfig.crossOriginPolicy,

      // Gesture settings
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: true,
        pinchToZoom: true,
      },
      gestureSettingsTouch: {
        clickToZoom: false,
        dblClickToZoom: true,
        pinchToZoom: true,
      },
    });

    // Create tile source factory
    tileSourceFactory = new TileSourceFactory(currentConfig);

    // Set up event handlers
    viewer.addHandler('open', () => {
      viewerReady.set(true);
      isLoading.set(false);
      updateViewportState();

      const metadata = $slideMetadata;
      if (metadata) {
        onopen?.({ metadata });
      }
    });

    viewer.addHandler('open-failed', (event: OpenSeadragon.OpenFailedEvent) => {
      const errorMsg = event.message || 'Failed to open slide';
      viewerError.set(errorMsg);
      isLoading.set(false);
      onopenfailed?.({ error: errorMsg });
    });

    viewer.addHandler('close', () => {
      viewerReady.set(false);
      onclose?.();
    });

    viewer.addHandler('animation-finish', () => {
      updateViewportState();
    });

    viewer.addHandler('zoom', (event: OpenSeadragon.ZoomEvent) => {
      updateViewportState();
      onzoom?.({ zoom: event.zoom });
    });

    viewer.addHandler('pan', () => {
      updateViewportState();
      const center = viewer!.viewport.getCenter(true);
      onpan?.({ center: { x: center.x, y: center.y } });
    });

    viewer.addHandler('rotate', (event: OpenSeadragon.RotateEvent) => {
      updateViewportState();
      onrotate?.({ rotation: event.degrees });
    });

    viewer.addHandler('canvas-click', (event: OpenSeadragon.CanvasClickEvent) => {
      if (event.quick) {
        const webPoint = event.position;
        const viewportPoint = viewer!.viewport.pointFromPixel(webPoint);
        oncanvasclick?.({
          point: { x: viewportPoint.x, y: viewportPoint.y },
        });
      }
    });

    viewer.addHandler('canvas-double-click', (event: OpenSeadragon.CanvasDoubleClickEvent) => {
      const webPoint = event.position;
      const viewportPoint = viewer!.viewport.pointFromPixel(webPoint);
      oncanvasdoubleclick?.({
        point: { x: viewportPoint.x, y: viewportPoint.y },
      });
    });

    onready?.();
  }

  /** Open a slide */
  async function openSlide(id: string): Promise<void> {
    if (!viewer || !tileSourceFactory) return;

    isLoading.set(true);
    viewerError.set(null);
    currentSlideId.set(id);

    try {
      const { tileSource, metadata } = await tileSourceFactory.createTileSource(id);
      slideMetadata.set(metadata);

      viewer.open(tileSource);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to open slide';
      viewerError.set(errorMsg);
      isLoading.set(false);
      onopenfailed?.({ error: errorMsg });
    }
  }

  /** Close the current slide */
  function closeSlide(): void {
    if (!viewer) return;

    viewer.close();
    slideMetadata.set(null);
    currentSlideId.set(null);
  }

  /** Navigate to a specific point */
  export function panTo(x: number, y: number, immediately = false): void {
    if (!viewer) return;
    viewer.viewport.panTo(new OpenSeadragon.Point(x, y), immediately);
  }

  /** Zoom to a specific level */
  export function zoomTo(zoom: number, immediately = false): void {
    if (!viewer) return;
    viewer.viewport.zoomTo(zoom, undefined, immediately);
  }

  /** Set rotation */
  export function setRotation(degrees: number, immediately = false): void {
    if (!viewer) return;
    viewer.viewport.setRotation(degrees, immediately);
  }

  /** Go to home position */
  export function goHome(immediately = false): void {
    if (!viewer) return;
    viewer.viewport.goHome(immediately);
  }

  /** Fit bounds */
  export function fitBounds(
    x: number,
    y: number,
    width: number,
    height: number,
    immediately = false
  ): void {
    if (!viewer) return;
    const rect = new OpenSeadragon.Rect(x, y, width, height);
    viewer.viewport.fitBounds(rect, immediately);
  }

  /** Get the OpenSeadragon viewer instance */
  export function getViewer(): OpenSeadragon.Viewer | null {
    return viewer;
  }

  /** Lifecycle */
  onMount(() => {
    initViewer();
  });

  onDestroy(() => {
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
  });

  /** Effect: Open slide when slideId changes */
  $effect(() => {
    if (slideId && viewer) {
      openSlide(slideId);
    }
  });

  /** Effect: Update config */
  $effect(() => {
    if (config) {
      viewerConfig.update((c) => ({ ...c, ...config }));
    }
  });
</script>

<div class="viewer-container" bind:this={containerEl}>
  {#if $isLoading}
    <div class="viewer-loading">
      <div class="spinner"></div>
      <span>Loading slide...</span>
    </div>
  {/if}

  {#if $viewerError}
    <div class="viewer-error">
      <span class="error-icon">⚠</span>
      <span>{$viewerError}</span>
    </div>
  {/if}
</div>

<style>
  .viewer-container {
    width: 100%;
    height: 100%;
    position: relative;
    background-color: var(--viewer-bg, #000);
  }

  .viewer-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #fff;
    z-index: 100;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .viewer-error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    background-color: rgba(220, 53, 69, 0.9);
    color: #fff;
    border-radius: 4px;
    z-index: 100;
  }

  .error-icon {
    font-size: 1.5rem;
  }

  /* OpenSeadragon navigator styling */
  :global(.navigator) {
    border: 2px solid rgba(255, 255, 255, 0.5) !important;
    background-color: rgba(0, 0, 0, 0.7) !important;
  }

  :global(.displayregion) {
    border: 2px solid #007bff !important;
  }
</style>
