/**
 * Measurement System Tests
 *
 * VVP Test Cases: TEST-MSR-001 through TEST-MSR-007
 * Verifies SRS requirements SYS-MSR-001 through SYS-MSR-007
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  activeMeasurementTool,
  activeMeasurement,
  measurements,
  measurementDisplayUnit,
  currentCalibrationState,
  currentMpp,
  isMeasurementBlocked,
  canMeasure,
  startMeasurement,
  addMeasurementPoint,
  completeMeasurement,
  cancelMeasurement,
  saveMeasurement,
  deleteMeasurement,
  clearMeasurements,
  calculateLineDistance,
  calculateRectangleArea,
  calculatePolygonArea,
  calculateEllipseArea,
  convertToCalibrated,
  formatMeasurementValue,
  resetMeasurementState,
} from '../stores/measurement';
import { slideMetadata, diagnosticMode } from '../stores';
import type { Measurement, CalibrationState } from '../types/measurement';

describe('Measurement System (SYS-MSR-*)', () => {
  beforeEach(() => {
    // Reset all stores
    resetMeasurementState();
    slideMetadata.set(null);
    diagnosticMode.set(false);
  });

  describe('TEST-MSR-001: Linear Measurement Tool', () => {
    it('should allow starting a line measurement', () => {
      // Setup: slide with valid MPP
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
      });

      const started = startMeasurement('line');

      expect(started).toBe(true);
      expect(get(activeMeasurementTool)).toBe('line');
      expect(get(activeMeasurement)).not.toBeNull();
      expect(get(activeMeasurement)?.type).toBe('line');
    });

    it('should calculate line distance correctly', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };

      const distance = calculateLineDistance(p1, p2);

      expect(distance).toBe(100);
    });

    it('should calculate diagonal distance correctly', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };

      const distance = calculateLineDistance(p1, p2);

      expect(distance).toBe(5); // 3-4-5 triangle
    });
  });

  describe('TEST-MSR-002: Area Measurement Tool', () => {
    beforeEach(() => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
      });
    });

    it('should calculate rectangle area correctly', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 50 };

      const area = calculateRectangleArea(p1, p2);

      expect(area).toBe(5000);
    });

    it('should calculate ellipse area correctly', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 10, y: 10 };

      const area = calculateEllipseArea(p1, p2);

      // Semi-axes: a = 5, b = 5
      // Area = π × 5 × 5 ≈ 78.54
      expect(area).toBeCloseTo(Math.PI * 25, 2);
    });

    it('should calculate polygon area using Shoelace formula', () => {
      // Square with vertices at (0,0), (10,0), (10,10), (0,10)
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const area = calculatePolygonArea(points);

      expect(area).toBe(100);
    });

    it('should start area measurement with rectangle tool', () => {
      const started = startMeasurement('rectangle');

      expect(started).toBe(true);
      expect(get(activeMeasurementTool)).toBe('rectangle');
    });

    it('should start area measurement with polygon tool', () => {
      const started = startMeasurement('polygon');

      expect(started).toBe(true);
      expect(get(activeMeasurementTool)).toBe('polygon');
    });
  });

  describe('TEST-MSR-003: Measurement Units (um/mm)', () => {
    it('should default to micrometers', () => {
      expect(get(measurementDisplayUnit)).toBe('um');
    });

    it('should convert pixels to micrometers', () => {
      const mpp = 0.25; // 0.25 microns per pixel
      const pixelValue = 400; // 400 pixels

      const result = convertToCalibrated(pixelValue, mpp, 'um', false);

      expect(result.calibratedValue).toBe(100); // 400 * 0.25 = 100 μm
      expect(result.unit).toBe('um');
    });

    it('should convert pixels to millimeters', () => {
      const mpp = 0.25;
      const pixelValue = 4000; // 4000 pixels = 1000 μm = 1 mm

      const result = convertToCalibrated(pixelValue, mpp, 'mm', false);

      expect(result.calibratedValue).toBe(1);
      expect(result.unit).toBe('mm');
    });

    it('should convert area to square micrometers', () => {
      const mpp = 0.25;
      const pixelArea = 1600; // 1600 px²

      const result = convertToCalibrated(pixelArea, mpp, 'um', true);

      // 1600 × 0.25² = 1600 × 0.0625 = 100 μm²
      expect(result.calibratedValue).toBe(100);
    });

    it('should format measurement values correctly', () => {
      expect(formatMeasurementValue(100, 'um', false)).toBe('100 μm');
      expect(formatMeasurementValue(1500, 'um', false)).toBe('1.50 mm');
      expect(formatMeasurementValue(1000000, 'um', true)).toBe('1.00 mm²');
    });
  });

  describe('TEST-MSR-004: MPP Display', () => {
    it('should derive current MPP from slide metadata', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.2456,
        mppSource: 'scanner',
        calibrationState: 'factory',
      });

      expect(get(currentMpp)).toBe(0.2456);
    });

    it('should return null MPP when no slide loaded', () => {
      slideMetadata.set(null);

      expect(get(currentMpp)).toBeNull();
    });
  });

  describe('TEST-MSR-005: Calibration State Display', () => {
    it('should derive calibration state from slide metadata', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'site_calibrated',
      });

      expect(get(currentCalibrationState)).toBe('site_calibrated');
    });

    it('should default to unknown when not specified', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
      });

      expect(get(currentCalibrationState)).toBe('unknown');
    });

    const calibrationStates: CalibrationState[] = [
      'site_calibrated',
      'factory',
      'unvalidated',
      'unknown',
    ];

    calibrationStates.forEach((state) => {
      it(`should handle calibration state: ${state}`, () => {
        slideMetadata.set({
          slideId: 'slide-1',
          width: 100000,
          height: 80000,
          tileWidth: 256,
          tileHeight: 256,
          levels: 10,
          mpp: 0.25,
          calibrationState: state,
        });

        expect(get(currentCalibrationState)).toBe(state);
      });
    });
  });

  describe('TEST-MSR-006: MPP from IMS', () => {
    it('should track MPP source as scanner', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
      });

      // MPP source should be from scanner metadata
      expect(get(slideMetadata)?.mppSource).toBe('scanner');
    });

    it('should mark result as reliable for factory calibration', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
      });

      const result = convertToCalibrated(100, 0.25, 'um', false);

      expect(result.isReliable).toBe(true);
    });

    it('should mark result as unreliable for unvalidated calibration', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        mppSource: 'manual',
        calibrationState: 'unvalidated',
      });

      const result = convertToCalibrated(100, 0.25, 'um', false);

      expect(result.isReliable).toBe(false);
      expect(result.warning).toBeDefined();
    });
  });

  describe('TEST-MSR-007: Block Unknown Scale in DX Mode', () => {
    it('should NOT block measurements when not in diagnostic mode', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        calibrationState: 'unknown',
      });
      diagnosticMode.set(false);

      expect(get(isMeasurementBlocked)).toBe(false);
      expect(get(canMeasure)).toBe(true);
    });

    it('should block measurements when in DX mode with unknown scale', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        calibrationState: 'unknown',
      });
      diagnosticMode.set(true);

      expect(get(isMeasurementBlocked)).toBe(true);
      expect(get(canMeasure)).toBe(false);
    });

    it('should allow measurements in DX mode with calibrated slide', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        calibrationState: 'factory',
      });
      diagnosticMode.set(true);

      expect(get(isMeasurementBlocked)).toBe(false);
      expect(get(canMeasure)).toBe(true);
    });

    it('should prevent starting measurement when blocked', () => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        calibrationState: 'unknown',
      });
      diagnosticMode.set(true);

      const started = startMeasurement('line');

      expect(started).toBe(false);
      expect(get(activeMeasurementTool)).toBeNull();
    });
  });

  describe('Measurement Workflow', () => {
    beforeEach(() => {
      slideMetadata.set({
        slideId: 'slide-1',
        width: 100000,
        height: 80000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
      });
    });

    it('should complete line measurement on second point', () => {
      startMeasurement('line');
      addMeasurementPoint(0, 0);
      addMeasurementPoint(100, 0);

      const active = get(activeMeasurement);

      expect(active?.isComplete).toBe(true);
      expect(active?.points).toHaveLength(2);
    });

    it('should complete rectangle measurement on second point', () => {
      startMeasurement('rectangle');
      addMeasurementPoint(0, 0);
      addMeasurementPoint(100, 50);

      const active = get(activeMeasurement);

      expect(active?.isComplete).toBe(true);
    });

    it('should NOT auto-complete polygon measurement', () => {
      startMeasurement('polygon');
      addMeasurementPoint(0, 0);
      addMeasurementPoint(100, 0);
      addMeasurementPoint(100, 100);

      const active = get(activeMeasurement);

      expect(active?.isComplete).toBe(false);
      expect(active?.points).toHaveLength(3);
    });

    it('should complete polygon measurement explicitly', () => {
      startMeasurement('polygon');
      addMeasurementPoint(0, 0);
      addMeasurementPoint(100, 0);
      addMeasurementPoint(100, 100);
      completeMeasurement();

      const active = get(activeMeasurement);

      expect(active?.isComplete).toBe(true);
    });

    it('should save completed measurement', () => {
      const measurement: Measurement = {
        id: 'msr-1',
        slideId: 'slide-1',
        scanId: 'scan-1',
        type: 'line',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [100, 0],
          ],
        },
        value: 100,
        unit: 'um',
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
        createdAt: new Date().toISOString(),
      };

      saveMeasurement(measurement);

      expect(get(measurements)).toHaveLength(1);
      expect(get(measurements)[0].id).toBe('msr-1');
    });

    it('should delete measurement by ID', () => {
      saveMeasurement({
        id: 'msr-1',
        slideId: 'slide-1',
        scanId: 'scan-1',
        type: 'line',
        geometry: { type: 'LineString', coordinates: [[0, 0], [100, 0]] },
        value: 100,
        unit: 'um',
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
        createdAt: new Date().toISOString(),
      });

      deleteMeasurement('msr-1');

      expect(get(measurements)).toHaveLength(0);
    });

    it('should cancel active measurement', () => {
      startMeasurement('line');
      addMeasurementPoint(0, 0);
      cancelMeasurement();

      expect(get(activeMeasurement)).toBeNull();
      expect(get(activeMeasurementTool)).toBeNull();
    });

    it('should clear all measurements', () => {
      saveMeasurement({
        id: 'msr-1',
        slideId: 'slide-1',
        scanId: 'scan-1',
        type: 'line',
        geometry: { type: 'LineString', coordinates: [[0, 0], [100, 0]] },
        value: 100,
        unit: 'um',
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
        createdAt: new Date().toISOString(),
      });
      saveMeasurement({
        id: 'msr-2',
        slideId: 'slide-1',
        scanId: 'scan-1',
        type: 'rectangle',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [100, 0], [100, 50], [0, 50], [0, 0]]] },
        value: 5000,
        unit: 'um',
        mpp: 0.25,
        mppSource: 'scanner',
        calibrationState: 'factory',
        createdAt: new Date().toISOString(),
      });

      clearMeasurements();

      expect(get(measurements)).toHaveLength(0);
    });
  });
});
