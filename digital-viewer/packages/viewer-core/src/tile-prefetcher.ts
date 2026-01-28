/**
 * Tile Prefetcher
 *
 * Implements tile prefetching based on predicted viewport movement
 * Per SRS-001 SYS-VWR-005: The system shall provide tile prefetching based on predicted viewport movement
 * Per SRS-001 SYS-VWR-006: The system shall cache tiles using browser storage with Cache-Control headers
 */

import type OpenSeadragon from 'openseadragon';

/** Prefetch configuration */
export interface TilePrefetchConfig {
  /** Enable prefetching (default: true) */
  enabled: boolean;
  /** Number of tiles to prefetch ahead in each direction (default: 2) */
  prefetchRadius: number;
  /** Prefetch adjacent zoom levels (default: true) */
  prefetchAdjacentLevels: boolean;
  /** Delay before prefetching after viewport change (ms) (default: 150) */
  prefetchDelay: number;
  /** Max concurrent prefetch requests (default: 6) */
  maxConcurrentRequests: number;
  /** Time to wait for viewport to settle before prefetching (ms) (default: 200) */
  settleTime: number;
}

const DEFAULT_CONFIG: TilePrefetchConfig = {
  enabled: true,
  prefetchRadius: 2,
  prefetchAdjacentLevels: true,
  prefetchDelay: 150,
  maxConcurrentRequests: 6,
  settleTime: 200,
};

/** Velocity tracking for movement prediction */
interface VelocityState {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  lastTime: number;
}

/** Pending prefetch request */
interface PrefetchRequest {
  level: number;
  x: number;
  y: number;
  url: string;
  priority: number;
}

/**
 * Create a tile prefetcher for an OpenSeadragon viewer
 */
export function createTilePrefetcher(
  viewer: OpenSeadragon.Viewer,
  config: Partial<TilePrefetchConfig> = {}
) {
  const mergedConfig: TilePrefetchConfig = { ...DEFAULT_CONFIG, ...config };

  // State
  let velocity: VelocityState = {
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    lastTime: Date.now(),
  };
  let prefetchTimer: ReturnType<typeof setTimeout> | null = null;
  let activeRequests = 0;
  let pendingRequests: PrefetchRequest[] = [];
  let prefetchedUrls = new Set<string>();
  let isDestroyed = false;

  /**
   * Update velocity based on viewport movement
   */
  function updateVelocity(): void {
    const viewport = viewer.viewport;
    if (!viewport) return;

    const center = viewport.getCenter(true);
    const now = Date.now();
    const dt = (now - velocity.lastTime) / 1000; // seconds

    if (dt > 0 && dt < 1) {
      // Only update velocity for reasonable time intervals
      velocity.x = (center.x - velocity.lastX) / dt;
      velocity.y = (center.y - velocity.lastY) / dt;
    } else {
      velocity.x = 0;
      velocity.y = 0;
    }

    velocity.lastX = center.x;
    velocity.lastY = center.y;
    velocity.lastTime = now;
  }

  /**
   * Predict viewport center position based on current velocity
   */
  function predictCenter(timeAhead: number = 0.3): { x: number; y: number } {
    const viewport = viewer.viewport;
    if (!viewport) return { x: 0.5, y: 0.5 };

    const center = viewport.getCenter(true);

    return {
      x: center.x + velocity.x * timeAhead,
      y: center.y + velocity.y * timeAhead,
    };
  }

  /**
   * Get tile coordinates for a viewport region
   */
  function getTilesInRegion(
    bounds: OpenSeadragon.Rect,
    level: number,
    tiledImage: OpenSeadragon.TiledImage
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];
    const source = tiledImage.source;

    if (!source) return tiles;

    // Get tile dimensions at this level
    const levelScale = source.getLevelScale(level);
    const tileSize = source.getTileWidth(level);
    const numTilesX = Math.ceil((source.width * levelScale) / tileSize);
    const numTilesY = Math.ceil((source.height * levelScale) / tileSize);

    // Convert viewport bounds to tile coordinates
    const tileStartX = Math.max(0, Math.floor(bounds.x * numTilesX));
    const tileStartY = Math.max(0, Math.floor(bounds.y * numTilesY));
    const tileEndX = Math.min(numTilesX - 1, Math.ceil((bounds.x + bounds.width) * numTilesX));
    const tileEndY = Math.min(numTilesY - 1, Math.ceil((bounds.y + bounds.height) * numTilesY));

    for (let x = tileStartX; x <= tileEndX; x++) {
      for (let y = tileStartY; y <= tileEndY; y++) {
        tiles.push({ x, y });
      }
    }

    return tiles;
  }

  /**
   * Calculate tiles to prefetch based on current viewport and movement
   */
  function calculatePrefetchTiles(): PrefetchRequest[] {
    if (!viewer.world || viewer.world.getItemCount() === 0) return [];

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage || !tiledImage.source) return [];

    const viewport = viewer.viewport;
    if (!viewport) return [];

    const source = tiledImage.source;
    const currentLevel = Math.floor(Math.log2(viewport.getZoom(true)));
    const maxLevel = source.maxLevel;
    const targetLevel = Math.min(Math.max(0, currentLevel), maxLevel);

    const requests: PrefetchRequest[] = [];
    const predictedCenter = predictCenter();

    // Get current bounds expanded by prefetch radius
    const bounds = viewport.getBounds(true);
    const expandedBounds = new (viewer as any).Rect(
      bounds.x - bounds.width * mergedConfig.prefetchRadius,
      bounds.y - bounds.height * mergedConfig.prefetchRadius,
      bounds.width * (1 + 2 * mergedConfig.prefetchRadius),
      bounds.height * (1 + 2 * mergedConfig.prefetchRadius)
    );

    // Bias expansion toward predicted movement direction
    if (Math.abs(velocity.x) > 0.01 || Math.abs(velocity.y) > 0.01) {
      const moveExpansion = 0.5;
      if (velocity.x > 0) {
        expandedBounds.width += bounds.width * moveExpansion;
      } else if (velocity.x < 0) {
        expandedBounds.x -= bounds.width * moveExpansion;
        expandedBounds.width += bounds.width * moveExpansion;
      }
      if (velocity.y > 0) {
        expandedBounds.height += bounds.height * moveExpansion;
      } else if (velocity.y < 0) {
        expandedBounds.y -= bounds.height * moveExpansion;
        expandedBounds.height += bounds.height * moveExpansion;
      }
    }

    // Get tiles at current level
    const currentTiles = getTilesInRegion(expandedBounds, targetLevel, tiledImage);

    for (const tile of currentTiles) {
      const url = source.getTileUrl(targetLevel, tile.x, tile.y);
      if (!url || prefetchedUrls.has(url)) continue;

      // Calculate priority based on distance from predicted center
      const tileCenterX = (tile.x + 0.5) / Math.pow(2, targetLevel);
      const tileCenterY = (tile.y + 0.5) / Math.pow(2, targetLevel);
      const distance = Math.sqrt(
        Math.pow(tileCenterX - predictedCenter.x, 2) +
        Math.pow(tileCenterY - predictedCenter.y, 2)
      );

      requests.push({
        level: targetLevel,
        x: tile.x,
        y: tile.y,
        url,
        priority: 1 / (1 + distance), // Higher priority for closer tiles
      });
    }

    // Prefetch adjacent zoom levels if enabled
    if (mergedConfig.prefetchAdjacentLevels) {
      const adjacentLevels = [targetLevel - 1, targetLevel + 1].filter(
        (l) => l >= 0 && l <= maxLevel
      );

      for (const level of adjacentLevels) {
        const levelBounds = viewport.getBounds(true);
        const levelTiles = getTilesInRegion(levelBounds, level, tiledImage);

        for (const tile of levelTiles.slice(0, 4)) {
          // Limit adjacent level prefetch
          const url = source.getTileUrl(level, tile.x, tile.y);
          if (!url || prefetchedUrls.has(url)) continue;

          requests.push({
            level,
            x: tile.x,
            y: tile.y,
            url,
            priority: 0.5, // Lower priority for adjacent levels
          });
        }
      }
    }

    // Sort by priority (highest first)
    requests.sort((a, b) => b.priority - a.priority);

    return requests;
  }

  /**
   * Prefetch a single tile
   */
  async function prefetchTile(request: PrefetchRequest): Promise<void> {
    if (isDestroyed || prefetchedUrls.has(request.url)) return;

    activeRequests++;
    prefetchedUrls.add(request.url);

    try {
      // Use fetch with cache hints
      const response = await fetch(request.url, {
        mode: 'cors',
        credentials: 'same-origin',
        // Let browser cache handle this based on Cache-Control headers
      });

      if (!response.ok) {
        prefetchedUrls.delete(request.url);
      }

      // We just want to populate the browser cache, don't need to process the response
    } catch {
      // Silently ignore prefetch failures
      prefetchedUrls.delete(request.url);
    } finally {
      activeRequests--;
      processQueue();
    }
  }

  /**
   * Process the prefetch queue
   */
  function processQueue(): void {
    if (isDestroyed) return;

    while (
      pendingRequests.length > 0 &&
      activeRequests < mergedConfig.maxConcurrentRequests
    ) {
      const request = pendingRequests.shift();
      if (request && !prefetchedUrls.has(request.url)) {
        prefetchTile(request);
      }
    }
  }

  /**
   * Schedule prefetch after viewport settles
   */
  function schedulePrefetch(): void {
    if (!mergedConfig.enabled || isDestroyed) return;

    // Clear any existing timer
    if (prefetchTimer) {
      clearTimeout(prefetchTimer);
    }

    // Update velocity tracking
    updateVelocity();

    // Wait for viewport to settle before prefetching
    prefetchTimer = setTimeout(() => {
      if (isDestroyed) return;

      const requests = calculatePrefetchTiles();
      pendingRequests = requests;
      processQueue();
    }, mergedConfig.settleTime);
  }

  /**
   * Handle viewport changes
   */
  function onViewportChange(): void {
    schedulePrefetch();
  }

  // Set up event listeners
  viewer.addHandler('viewport-change', onViewportChange);
  viewer.addHandler('animation-finish', onViewportChange);
  viewer.addHandler('open', () => {
    // Clear cache when new image opens
    prefetchedUrls.clear();
    pendingRequests = [];
    schedulePrefetch();
  });

  /**
   * Update prefetcher configuration
   */
  function updateConfig(newConfig: Partial<TilePrefetchConfig>): void {
    Object.assign(mergedConfig, newConfig);
  }

  /**
   * Get current configuration
   */
  function getConfig(): TilePrefetchConfig {
    return { ...mergedConfig };
  }

  /**
   * Clear prefetch cache
   */
  function clearCache(): void {
    prefetchedUrls.clear();
    pendingRequests = [];
  }

  /**
   * Get prefetch statistics
   */
  function getStats(): {
    prefetchedCount: number;
    pendingCount: number;
    activeCount: number;
  } {
    return {
      prefetchedCount: prefetchedUrls.size,
      pendingCount: pendingRequests.length,
      activeCount: activeRequests,
    };
  }

  /**
   * Destroy the prefetcher
   */
  function destroy(): void {
    isDestroyed = true;

    if (prefetchTimer) {
      clearTimeout(prefetchTimer);
      prefetchTimer = null;
    }

    viewer.removeHandler('viewport-change', onViewportChange);
    viewer.removeHandler('animation-finish', onViewportChange);

    prefetchedUrls.clear();
    pendingRequests = [];
  }

  return {
    updateConfig,
    getConfig,
    clearCache,
    getStats,
    destroy,
  };
}

/** Singleton prefetcher for the main viewer */
let defaultPrefetcher: ReturnType<typeof createTilePrefetcher> | null = null;

/**
 * Get or create the default tile prefetcher
 */
export function getTilePrefetcher(
  viewer: OpenSeadragon.Viewer,
  config?: Partial<TilePrefetchConfig>
): ReturnType<typeof createTilePrefetcher> {
  if (!defaultPrefetcher) {
    defaultPrefetcher = createTilePrefetcher(viewer, config);
  }
  return defaultPrefetcher;
}

/**
 * Reset the default prefetcher
 */
export function resetTilePrefetcher(): void {
  defaultPrefetcher?.destroy();
  defaultPrefetcher = null;
}
