/**
 * Measurement Types
 *
 * Type definitions for the measurement system per SRS-001 (SYS-MSR-*)
 * Supports linear and area measurements with calibration tracking
 */

import type { GeoJSON } from 'geojson';

/**
 * Calibration state for slide measurements
 * Per SRS-001 SYS-MSR-005
 */
export type CalibrationState =
  | 'site_calibrated' // Validated by site-specific calibration protocol
  | 'factory' // Factory calibration from scanner manufacturer
  | 'unvalidated' // MPP present but not validated
  | 'unknown'; // No MPP available

/**
 * MPP (microns per pixel) source
 * Per SRS-001 SYS-MSR-004
 */
export type MppSource = 'scanner' | 'manual';

/**
 * Measurement type
 */
export type MeasurementType = 'line' | 'rectangle' | 'polygon' | 'ellipse';

/**
 * Measurement unit
 */
export type MeasurementUnit = 'um' | 'mm' | 'px';

/**
 * Active measurement state during drawing
 */
export interface ActiveMeasurement {
  id: string;
  type: MeasurementType;
  points: Array<{ x: number; y: number }>;
  isComplete: boolean;
}

/**
 * Completed measurement record
 * Per SRS-001 SYS-MSR-001, SYS-MSR-002
 */
export interface Measurement {
  /** Unique measurement ID */
  id: string;

  /** Slide this measurement belongs to */
  slideId: string;

  /** Specific scan ID (immutable link per SRS-001 SYS-ANN-003) */
  scanId: string;

  /** Measurement type */
  type: MeasurementType;

  /** GeoJSON geometry in Level 0 coordinates */
  geometry: GeoJSON.Geometry;

  /** Measured value (distance or area) */
  value: number;

  /** Display unit */
  unit: MeasurementUnit;

  /** MPP used for calculation */
  mpp: number;

  /** Source of MPP value */
  mppSource: MppSource;

  /** Calibration state at time of measurement */
  calibrationState: CalibrationState;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** User who created the measurement */
  createdBy?: string;

  /** Optional label */
  label?: string;

  /** Display color */
  color?: string;
}

/**
 * Measurement store state
 */
export interface MeasurementState {
  /** Currently active/drawing measurement */
  activeMeasurement: ActiveMeasurement | null;

  /** Completed measurements for current slide */
  measurements: Measurement[];

  /** Active measurement tool */
  activeTool: MeasurementType | null;

  /** Display unit preference */
  displayUnit: MeasurementUnit;

  /** Whether measurement is blocked (DX mode + unknown calibration) */
  isBlocked: boolean;

  /** Blocking reason if blocked */
  blockReason: string | null;
}

/**
 * Measurement calculation result
 */
export interface MeasurementResult {
  /** Raw value in pixels */
  pixelValue: number;

  /** Converted value based on MPP */
  calibratedValue: number;

  /** Unit of calibrated value */
  unit: MeasurementUnit;

  /** Whether the result is reliable */
  isReliable: boolean;

  /** Warning message if not reliable */
  warning?: string;
}

/**
 * Measurement tool configuration
 */
export interface MeasurementToolConfig {
  /** Tool type */
  type: MeasurementType;

  /** Display name */
  label: string;

  /** Icon (Unicode or SVG path) */
  icon: string;

  /** Keyboard shortcut */
  shortcut?: string;

  /** Whether tool requires closed shape */
  closed: boolean;

  /** Minimum points required */
  minPoints: number;
}

/**
 * Default measurement tools per SRS-001
 */
export const MEASUREMENT_TOOLS: MeasurementToolConfig[] = [
  {
    type: 'line',
    label: 'Ruler',
    icon: '📏',
    shortcut: 'r',
    closed: false,
    minPoints: 2,
  },
  {
    type: 'rectangle',
    label: 'Rectangle Area',
    icon: '⬜',
    shortcut: 'a',
    closed: true,
    minPoints: 2,
  },
  {
    type: 'polygon',
    label: 'Polygon Area',
    icon: '⬡',
    shortcut: 'p',
    closed: true,
    minPoints: 3,
  },
  {
    type: 'ellipse',
    label: 'Ellipse Area',
    icon: '⬭',
    shortcut: 'e',
    closed: true,
    minPoints: 2,
  },
];

/**
 * Calibration state display configuration
 */
export const CALIBRATION_DISPLAY: Record<
  CalibrationState,
  { label: string; color: string; icon: string }
> = {
  site_calibrated: {
    label: 'Site Calibrated',
    color: '#22c55e', // green
    icon: '✓',
  },
  factory: {
    label: 'Factory Calibration',
    color: '#3b82f6', // blue
    icon: '●',
  },
  unvalidated: {
    label: 'Unvalidated',
    color: '#f59e0b', // amber
    icon: '⚠',
  },
  unknown: {
    label: 'Unknown Scale',
    color: '#ef4444', // red
    icon: '✗',
  },
};
