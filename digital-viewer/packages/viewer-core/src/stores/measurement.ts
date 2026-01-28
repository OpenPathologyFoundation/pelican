/**
 * Measurement Store
 *
 * Svelte store for measurement state management
 * Per SRS-001 (SYS-MSR-001 through SYS-MSR-007)
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { slideMetadata, diagnosticMode } from '../stores';
import type {
  ActiveMeasurement,
  Measurement,
  MeasurementType,
  MeasurementUnit,
  MeasurementResult,
  CalibrationState,
  MppSource,
} from '../types/measurement';

/**
 * Generate unique measurement ID
 */
function generateMeasurementId(): string {
  return `msr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Active measurement tool
 */
export const activeMeasurementTool: Writable<MeasurementType | null> = writable(null);

/**
 * Currently drawing measurement
 */
export const activeMeasurement: Writable<ActiveMeasurement | null> = writable(null);

/**
 * Completed measurements for current slide
 */
export const measurements: Writable<Measurement[]> = writable([]);

/**
 * Display unit preference
 */
export const measurementDisplayUnit: Writable<MeasurementUnit> = writable('um');

/**
 * Derived: Current calibration state from slide metadata
 */
export const currentCalibrationState: Readable<CalibrationState> = derived(
  slideMetadata,
  ($slideMetadata) => {
    if (!$slideMetadata) return 'unknown';
    return $slideMetadata.calibrationState || 'unknown';
  }
);

/**
 * Derived: Current MPP from slide metadata
 */
export const currentMpp: Readable<number | null> = derived(
  slideMetadata,
  ($slideMetadata) => $slideMetadata?.mpp || null
);

/**
 * Derived: Current MPP source from slide metadata
 */
export const currentMppSource: Readable<MppSource | null> = derived(
  slideMetadata,
  ($slideMetadata) => $slideMetadata?.mppSource || null
);

/**
 * Derived: Is measurement blocked in diagnostic mode
 * Per SRS-001 SYS-MSR-007 - Block measurements on unknown-scale slides in DX mode
 */
export const isMeasurementBlocked: Readable<boolean> = derived(
  [diagnosticMode, currentCalibrationState],
  ([$diagnosticMode, $calibrationState]) => {
    if (!$diagnosticMode) return false;
    return $calibrationState === 'unknown';
  }
);

/**
 * Derived: Measurement blocking reason
 */
export const measurementBlockReason: Readable<string | null> = derived(
  [isMeasurementBlocked, currentCalibrationState],
  ([$isBlocked, $calibrationState]) => {
    if (!$isBlocked) return null;
    if ($calibrationState === 'unknown') {
      return 'Measurements are blocked in Diagnostic Mode for slides with unknown scale. ' +
        'Exit Diagnostic Mode or use a calibrated slide.';
    }
    return null;
  }
);

/**
 * Derived: Can make measurements
 */
export const canMeasure: Readable<boolean> = derived(
  [slideMetadata, isMeasurementBlocked],
  ([$slideMetadata, $isBlocked]) => {
    if (!$slideMetadata) return false;
    if ($isBlocked) return false;
    return true;
  }
);

/**
 * Start a new measurement
 */
export function startMeasurement(type: MeasurementType): boolean {
  if (!get(canMeasure)) {
    console.warn('Cannot start measurement: blocked or no slide loaded');
    return false;
  }

  activeMeasurementTool.set(type);
  activeMeasurement.set({
    id: generateMeasurementId(),
    type,
    points: [],
    isComplete: false,
  });

  return true;
}

/**
 * Add point to active measurement
 */
export function addMeasurementPoint(x: number, y: number): void {
  activeMeasurement.update((current) => {
    if (!current || current.isComplete) return current;

    const newPoints = [...current.points, { x, y }];

    // Check if measurement is complete based on type
    let isComplete = false;
    if (current.type === 'line' && newPoints.length >= 2) {
      isComplete = true;
    }
    // Rectangle and ellipse complete on second click
    if ((current.type === 'rectangle' || current.type === 'ellipse') && newPoints.length >= 2) {
      isComplete = true;
    }
    // Polygon needs explicit completion (double-click or close button)

    return {
      ...current,
      points: newPoints,
      isComplete,
    };
  });
}

/**
 * Complete polygon measurement (close the shape)
 */
export function completeMeasurement(): void {
  activeMeasurement.update((current) => {
    if (!current) return current;
    return { ...current, isComplete: true };
  });
}

/**
 * Cancel active measurement
 */
export function cancelMeasurement(): void {
  activeMeasurement.set(null);
  activeMeasurementTool.set(null);
}

/**
 * Save completed measurement
 */
export function saveMeasurement(measurement: Measurement): void {
  measurements.update((current) => [...current, measurement]);
  activeMeasurement.set(null);
  activeMeasurementTool.set(null);
}

/**
 * Delete measurement by ID
 */
export function deleteMeasurement(id: string): void {
  measurements.update((current) => current.filter((m) => m.id !== id));
}

/**
 * Clear all measurements for current slide
 */
export function clearMeasurements(): void {
  measurements.set([]);
}

/**
 * Calculate line distance in pixels
 */
export function calculateLineDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate polygon area using Shoelace formula
 */
export function calculatePolygonArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Calculate rectangle area from two corner points
 */
export function calculateRectangleArea(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const width = Math.abs(p2.x - p1.x);
  const height = Math.abs(p2.y - p1.y);
  return width * height;
}

/**
 * Calculate ellipse area from bounding box
 */
export function calculateEllipseArea(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const a = Math.abs(p2.x - p1.x) / 2; // semi-major axis
  const b = Math.abs(p2.y - p1.y) / 2; // semi-minor axis
  return Math.PI * a * b;
}

/**
 * Convert pixel value to calibrated value
 */
export function convertToCalibrated(
  pixelValue: number,
  mpp: number | null,
  unit: MeasurementUnit,
  isArea: boolean
): MeasurementResult {
  if (!mpp || unit === 'px') {
    return {
      pixelValue,
      calibratedValue: pixelValue,
      unit: 'px',
      isReliable: false,
      warning: 'No calibration data available',
    };
  }

  // Convert pixels to microns
  let calibratedValue: number;
  let targetUnit: MeasurementUnit = unit;

  if (isArea) {
    // Area: square microns
    calibratedValue = pixelValue * mpp * mpp;
    if (unit === 'mm') {
      calibratedValue = calibratedValue / 1000000; // um² to mm²
    }
  } else {
    // Linear: microns
    calibratedValue = pixelValue * mpp;
    if (unit === 'mm') {
      calibratedValue = calibratedValue / 1000; // um to mm
    }
  }

  const calibrationState = get(currentCalibrationState);
  const isReliable = calibrationState === 'site_calibrated' || calibrationState === 'factory';

  return {
    pixelValue,
    calibratedValue,
    unit: targetUnit,
    isReliable,
    warning: !isReliable ? 'Calibration not validated' : undefined,
  };
}

/**
 * Format measurement value for display
 */
export function formatMeasurementValue(
  value: number,
  unit: MeasurementUnit,
  isArea: boolean
): string {
  let formatted: string;

  if (unit === 'px') {
    formatted = `${Math.round(value)} px`;
    if (isArea) formatted += '²';
  } else if (unit === 'um') {
    if (isArea) {
      if (value >= 1000000) {
        formatted = `${(value / 1000000).toFixed(2)} mm²`;
      } else {
        formatted = `${Math.round(value)} μm²`;
      }
    } else {
      if (value >= 1000) {
        formatted = `${(value / 1000).toFixed(2)} mm`;
      } else {
        formatted = `${Math.round(value)} μm`;
      }
    }
  } else {
    // mm
    if (isArea) {
      formatted = `${value.toFixed(4)} mm²`;
    } else {
      formatted = `${value.toFixed(2)} mm`;
    }
  }

  return formatted;
}

/**
 * Reset measurement state (for slide change)
 */
export function resetMeasurementState(): void {
  activeMeasurementTool.set(null);
  activeMeasurement.set(null);
  measurements.set([]);
}
