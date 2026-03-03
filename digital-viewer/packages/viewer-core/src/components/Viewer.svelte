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
  import { createTilePrefetcher, type TilePrefetchConfig } from '../tile-prefetcher';
  import { createTileFailureTracker, type TileFailureConfig } from '../tile-failure-tracker';
  import { get } from 'svelte/store';
  import {
    viewerConfig,
    slideMetadata,
    currentSlideId,
    viewportState,
    viewerReady,
    isLoading,
    viewerError,
    osdViewer,
    viewerSize,
    tileFailureState,
    authToken,
    authExpired,
    orchestratorState,
  } from '../stores';
  import ErrorOverlay from './ErrorOverlay.svelte';
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
  let resizeObserver: ResizeObserver | null = null;
  let tilePrefetcher: ReturnType<typeof createTilePrefetcher> | null = null;
  let tileFailureTracker: ReturnType<typeof createTileFailureTracker> | null = null;

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

    // Build initial ajax headers if we have an auth token (SRS SYS-INT-002)
    const currentToken = get(authToken);
    const initialAjaxHeaders: Record<string, string> = {};
    if (currentToken) {
      initialAjaxHeaders['Authorization'] = `Bearer ${currentToken}`;
    }

    viewer = OpenSeadragon({
      element: containerEl,
      prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',

      // Authentication: Use XHR for tile requests so we can attach Bearer token
      loadTilesWithAjax: true,
      ajaxHeaders: initialAjaxHeaders,

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

      // Tile retry — automatically retry failed tiles instead of permanently
      // marking them as non-existent (fixes blurry-stays-forever on transient 502s)
      tileRetryMax: 2,
      tileRetryDelay: 2500,

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

    // Create tile source factory and sync auth token
    tileSourceFactory = new TileSourceFactory(currentConfig);
    if (currentToken) {
      tileSourceFactory.setAccessToken(currentToken);
    }

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

    // Initialize tile failure tracker (SYS-ERR-001)
    tileFailureTracker = createTileFailureTracker({
      failureThreshold: 0.5, // 50% failure rate triggers error
      timeWindowMs: 30000,   // 30 second window
      minRequestsForEvaluation: 10,
      onThresholdExceeded: (state) => {
        tileFailureState.set({
          thresholdExceeded: true,
          failureRate: state.failureRate,
          lastError: state.lastError,
        });
      },
      onThresholdRecovered: () => {
        tileFailureState.set({
          thresholdExceeded: false,
          failureRate: 0,
        });
      },
    });

    // Wire tile events to failure tracker
    viewer.addHandler('tile-loaded', (event: OpenSeadragon.TileEvent) => {
      if (event.tile && tileFailureTracker) {
        tileFailureTracker.recordRequest(
          event.tile.level,
          event.tile.x,
          event.tile.y,
          true
        );
      }
    });

    viewer.addHandler('tile-load-failed', (event: OpenSeadragon.TileEvent) => {
      if (event.tile && tileFailureTracker) {
        tileFailureTracker.recordRequest(
          event.tile.level,
          event.tile.x,
          event.tile.y,
          false,
          'Tile load failed'
        );
      }
    });

    // Initialize tile prefetcher (SYS-VWR-005)
    tilePrefetcher = createTilePrefetcher(viewer, {
      enabled: true,
      prefetchRadius: 1,
      prefetchAdjacentLevels: true,
      settleTime: 300,
      maxConcurrentRequests: 4,
    });

    // Publish viewer instance to store
    osdViewer.set(viewer);

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
    tileFailureTracker?.reset();
    tilePrefetcher?.clearCache();
    tileFailureState.set({ thresholdExceeded: false, failureRate: 0 });
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

    // Track container size for overlays
    if (containerEl) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          viewerSize.set({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      resizeObserver.observe(containerEl);

      // Initial size
      viewerSize.set({
        width: containerEl.clientWidth,
        height: containerEl.clientHeight,
      });
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    tilePrefetcher?.destroy();
    tilePrefetcher = null;
    tileFailureTracker?.reset();
    tileFailureTracker = null;
    if (viewer) {
      osdViewer.set(null);
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

  /** Effect: Update OSD ajax headers when auth token changes (SRS SYS-INT-002) */
  $effect(() => {
    const token = $authToken;
    if (viewer) {
      if (token) {
        // Update OSD headers for all subsequent tile requests
        (viewer as any).ajaxHeaders = { Authorization: `Bearer ${token}` };
        // Clear auth expired state since we have a fresh token
        authExpired.set(false);
      } else {
        (viewer as any).ajaxHeaders = {};
      }
    }
    // Also update the tile source factory for metadata fetches
    if (tileSourceFactory) {
      tileSourceFactory.setAccessToken(token);
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

  <!-- Lifecycle & error overlays (priority order) -->
  {#if $orchestratorState === 'ended'}
    <ErrorOverlay type="auth-expired" message="Session ended by workstation" />
  {:else if $orchestratorState === 'lost'}
    <ErrorOverlay type="service-unavailable" message="Connection to workstation lost" />
  {:else if $orchestratorState === 'disconnected'}
    <div class="reconnecting-banner">
      <span class="reconnecting-dot"></span>
      Reconnecting to workstation...
    </div>
  {:else if $authExpired}
    <ErrorOverlay type="auth-expired" />
  {:else if $tileFailureState.thresholdExceeded}
    <ErrorOverlay type="tile-failure" onretry={() => {
      // Reset failure tracker and clear error state
      tileFailureTracker?.reset();
      tileFailureState.set({ thresholdExceeded: false, failureRate: 0 });
      // Force OSD to re-request tiles
      if (viewer) {
        const tiledImage = viewer.world.getItemAt(0);
        if (tiledImage) {
          (tiledImage as any).reset();
        }
      }
    }} />
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

  /* Reconnecting banner (orchestrator temporarily disconnected) */
  .reconnecting-banner {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(234, 179, 8, 0.15);
    border-bottom: 1px solid rgba(234, 179, 8, 0.3);
    color: #eab308;
    font-size: 0.85rem;
    font-weight: 500;
    backdrop-filter: blur(4px);
  }

  .reconnecting-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #eab308;
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
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
