/**
 * Tile Failure Tracker
 *
 * Tracks tile load success/failure rates and triggers error states
 * Per SRS-001 SYS-ERR-001: Display "Image temporarily unavailable" when >50% tile requests fail
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';

/** Tile request record */
export interface TileRequest {
  level: number;
  x: number;
  y: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

/** Tile failure state */
export interface TileFailureState {
  totalRequests: number;
  failedRequests: number;
  failureRate: number;
  recentRequests: TileRequest[];
  lastError?: string;
  thresholdExceeded: boolean;
}

/** Tile failure tracker configuration */
export interface TileFailureConfig {
  /** Failure rate threshold (0-1) to trigger error state (default: 0.5 = 50%) */
  failureThreshold: number;
  /** Time window in ms to consider for failure rate (default: 30000 = 30s) */
  timeWindowMs: number;
  /** Minimum requests before evaluating threshold (default: 10) */
  minRequestsForEvaluation: number;
  /** Callback when threshold is exceeded */
  onThresholdExceeded?: (state: TileFailureState) => void;
  /** Callback when threshold is recovered */
  onThresholdRecovered?: () => void;
}

const DEFAULT_CONFIG: TileFailureConfig = {
  failureThreshold: 0.5,
  timeWindowMs: 30000,
  minRequestsForEvaluation: 10,
};

/**
 * Create a tile failure tracker
 */
export function createTileFailureTracker(config: Partial<TileFailureConfig> = {}) {
  const mergedConfig: TileFailureConfig = { ...DEFAULT_CONFIG, ...config };

  // Internal state
  const requests: Writable<TileRequest[]> = writable([]);
  let wasThresholdExceeded = false;

  /**
   * Record a tile request result
   */
  function recordRequest(
    level: number,
    x: number,
    y: number,
    success: boolean,
    error?: string
  ): void {
    const now = Date.now();
    const request: TileRequest = {
      level,
      x,
      y,
      timestamp: now,
      success,
      error,
    };

    requests.update((current) => {
      // Add new request
      const updated = [...current, request];

      // Remove requests outside time window
      const cutoff = now - mergedConfig.timeWindowMs;
      const filtered = updated.filter((r) => r.timestamp >= cutoff);

      // Check threshold
      const totalRequests = filtered.length;
      const failedRequests = filtered.filter((r) => !r.success).length;
      const failureRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

      const thresholdExceeded =
        totalRequests >= mergedConfig.minRequestsForEvaluation &&
        failureRate > mergedConfig.failureThreshold;

      // Trigger callbacks
      if (thresholdExceeded && !wasThresholdExceeded) {
        wasThresholdExceeded = true;
        mergedConfig.onThresholdExceeded?.({
          totalRequests,
          failedRequests,
          failureRate,
          recentRequests: filtered.slice(-20),
          lastError: error,
          thresholdExceeded: true,
        });
      } else if (!thresholdExceeded && wasThresholdExceeded) {
        wasThresholdExceeded = false;
        mergedConfig.onThresholdRecovered?.();
      }

      return filtered;
    });
  }

  /**
   * Derived store for current failure state
   */
  const failureState: Readable<TileFailureState> = derived(requests, ($requests) => {
    const now = Date.now();
    const cutoff = now - mergedConfig.timeWindowMs;
    const recentRequests = $requests.filter((r) => r.timestamp >= cutoff);

    const totalRequests = recentRequests.length;
    const failedRequests = recentRequests.filter((r) => !r.success).length;
    const failureRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    const thresholdExceeded =
      totalRequests >= mergedConfig.minRequestsForEvaluation &&
      failureRate > mergedConfig.failureThreshold;

    const lastFailedRequest = recentRequests.filter((r) => !r.success).pop();

    return {
      totalRequests,
      failedRequests,
      failureRate,
      recentRequests: recentRequests.slice(-20),
      lastError: lastFailedRequest?.error,
      thresholdExceeded,
    };
  });

  /**
   * Derived: Is threshold exceeded
   */
  const isThresholdExceeded: Readable<boolean> = derived(
    failureState,
    ($state) => $state.thresholdExceeded
  );

  /**
   * Reset tracker state
   */
  function reset(): void {
    requests.set([]);
    wasThresholdExceeded = false;
  }

  /**
   * Get current state snapshot
   */
  function getState(): TileFailureState {
    return get(failureState);
  }

  return {
    recordRequest,
    failureState,
    isThresholdExceeded,
    reset,
    getState,
  };
}

/** Singleton tracker for the main viewer */
let defaultTracker: ReturnType<typeof createTileFailureTracker> | null = null;

/**
 * Get or create the default tile failure tracker
 */
export function getTileFailureTracker(
  config?: Partial<TileFailureConfig>
): ReturnType<typeof createTileFailureTracker> {
  if (!defaultTracker) {
    defaultTracker = createTileFailureTracker(config);
  }
  return defaultTracker;
}

/**
 * Reset the default tracker
 */
export function resetTileFailureTracker(): void {
  defaultTracker?.reset();
}
