<script lang="ts">
  /**
   * MeasurementOverlay Component
   *
   * Renders active and completed measurements on the viewer canvas
   * Per SRS-001 SYS-MSR-001, SYS-MSR-002
   */

  import { onMount, onDestroy } from 'svelte';
  import OpenSeadragon from 'openseadragon';
  import {
    slideMetadata,
    viewportState,
    osdViewer,
    viewerSize,
    textAnnotationMode,
    textAnnotations,
    pendingTextPosition,
    type TextAnnotation,
  } from '../stores';
  import {
    activeMeasurement,
    activeMeasurementTool,
    measurements,
    measurementDisplayUnit,
    currentMpp,
    currentCalibrationState,
    calculateLineDistance,
    calculateRectangleArea,
    calculatePolygonArea,
    calculateEllipseArea,
    convertToCalibrated,
    formatMeasurementValue,
    addMeasurementPoint,
    completeMeasurement,
    saveMeasurement,
  } from '../stores/measurement';
  import type { Measurement, MeasurementType } from '../types/measurement';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let mousePos: { x: number; y: number } | null = null;

  /** Get viewer and size from stores */
  let viewer = $derived($osdViewer);
  let width = $derived($viewerSize.width);
  let height = $derived($viewerSize.height);

  /** Convert image coordinates to viewport coordinates */
  function imageToViewport(point: { x: number; y: number }): { x: number; y: number } | null {
    if (!viewer || !$slideMetadata) return null;

    try {
      const imagePoint = new OpenSeadragon.Point(point.x, point.y);
      const viewportPoint = viewer.viewport.imageToViewportCoordinates(imagePoint);
      const webPoint = viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);
      return { x: webPoint.x, y: webPoint.y };
    } catch {
      return null;
    }
  }

  /** Convert viewport coordinates to image coordinates */
  function viewportToImage(point: { x: number; y: number }): { x: number; y: number } | null {
    if (!viewer) return null;

    try {
      const webPoint = new OpenSeadragon.Point(point.x, point.y);
      const viewportPoint = viewer.viewport.viewerElementToViewportCoordinates(webPoint);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
      return { x: imagePoint.x, y: imagePoint.y };
    } catch {
      return null;
    }
  }

  /** Draw measurement path */
  function drawPath(
    points: Array<{ x: number; y: number }>,
    type: MeasurementType,
    isActive: boolean = false,
    mousePoint: { x: number; y: number } | null = null
  ): void {
    if (!ctx || points.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = isActive ? '#3b82f6' : '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash(isActive ? [5, 5] : []);

    const viewportPoints = points.map(imageToViewport).filter((p): p is { x: number; y: number } => p !== null);
    if (viewportPoints.length === 0) return;

    if (type === 'line') {
      ctx.moveTo(viewportPoints[0].x, viewportPoints[0].y);
      if (viewportPoints.length > 1) {
        ctx.lineTo(viewportPoints[1].x, viewportPoints[1].y);
      } else if (mousePoint) {
        ctx.lineTo(mousePoint.x, mousePoint.y);
      }
    } else if (type === 'rectangle') {
      if (viewportPoints.length >= 2) {
        const x = Math.min(viewportPoints[0].x, viewportPoints[1].x);
        const y = Math.min(viewportPoints[0].y, viewportPoints[1].y);
        const w = Math.abs(viewportPoints[1].x - viewportPoints[0].x);
        const h = Math.abs(viewportPoints[1].y - viewportPoints[0].y);
        ctx.rect(x, y, w, h);
      } else if (mousePoint) {
        const x = Math.min(viewportPoints[0].x, mousePoint.x);
        const y = Math.min(viewportPoints[0].y, mousePoint.y);
        const w = Math.abs(mousePoint.x - viewportPoints[0].x);
        const h = Math.abs(mousePoint.y - viewportPoints[0].y);
        ctx.rect(x, y, w, h);
      }
    } else if (type === 'ellipse') {
      if (viewportPoints.length >= 2) {
        const cx = (viewportPoints[0].x + viewportPoints[1].x) / 2;
        const cy = (viewportPoints[0].y + viewportPoints[1].y) / 2;
        const rx = Math.abs(viewportPoints[1].x - viewportPoints[0].x) / 2;
        const ry = Math.abs(viewportPoints[1].y - viewportPoints[0].y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      } else if (mousePoint) {
        const cx = (viewportPoints[0].x + mousePoint.x) / 2;
        const cy = (viewportPoints[0].y + mousePoint.y) / 2;
        const rx = Math.abs(mousePoint.x - viewportPoints[0].x) / 2;
        const ry = Math.abs(mousePoint.y - viewportPoints[0].y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      }
    } else if (type === 'polygon') {
      ctx.moveTo(viewportPoints[0].x, viewportPoints[0].y);
      for (let i = 1; i < viewportPoints.length; i++) {
        ctx.lineTo(viewportPoints[i].x, viewportPoints[i].y);
      }
      if (mousePoint && isActive) {
        ctx.lineTo(mousePoint.x, mousePoint.y);
      }
      if (!isActive || viewportPoints.length >= 3) {
        ctx.closePath();
      }
    }

    ctx.stroke();

    // Fill for closed shapes
    if (type !== 'line') {
      ctx.fillStyle = isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)';
      ctx.fill();
    }

    // Draw points
    ctx.fillStyle = isActive ? '#3b82f6' : '#22c55e';
    for (const p of viewportPoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /** Draw measurement label */
  function drawLabel(
    points: Array<{ x: number; y: number }>,
    type: MeasurementType,
    label: string
  ): void {
    if (!ctx || points.length < 2) return;

    const viewportPoints = points.map(imageToViewport).filter((p): p is { x: number; y: number } => p !== null);
    if (viewportPoints.length < 2) return;

    // Find label position
    let labelX: number;
    let labelY: number;

    if (type === 'line') {
      labelX = (viewportPoints[0].x + viewportPoints[1].x) / 2;
      labelY = (viewportPoints[0].y + viewportPoints[1].y) / 2 - 10;
    } else {
      // Center of bounding box
      const minX = Math.min(...viewportPoints.map((p) => p.x));
      const maxX = Math.max(...viewportPoints.map((p) => p.x));
      const minY = Math.min(...viewportPoints.map((p) => p.y));
      const maxY = Math.max(...viewportPoints.map((p) => p.y));
      labelX = (minX + maxX) / 2;
      labelY = (minY + maxY) / 2;
    }

    // Draw label background
    ctx.font = '12px monospace';
    const metrics = ctx.measureText(label);
    const padding = 4;
    const bgWidth = metrics.width + padding * 2;
    const bgHeight = 16 + padding * 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(labelX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight);

    // Draw label text
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, labelX, labelY);
  }

  /** Calculate measurement value */
  function calculateValue(
    points: Array<{ x: number; y: number }>,
    type: MeasurementType
  ): { value: number; isArea: boolean } {
    if (points.length < 2) return { value: 0, isArea: false };

    let value: number;
    let isArea = false;

    switch (type) {
      case 'line':
        value = calculateLineDistance(points[0], points[1]);
        break;
      case 'rectangle':
        value = calculateRectangleArea(points[0], points[1]);
        isArea = true;
        break;
      case 'ellipse':
        value = calculateEllipseArea(points[0], points[1]);
        isArea = true;
        break;
      case 'polygon':
        value = calculatePolygonArea(points);
        isArea = true;
        break;
      default:
        value = 0;
    }

    return { value, isArea };
  }

  /** Render all measurements */
  function render(): void {
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw completed measurements
    for (const measurement of $measurements) {
      const points = extractPointsFromGeometry(measurement.geometry);
      drawPath(points, measurement.type, false);

      // Format and draw label
      const result = convertToCalibrated(
        measurement.value,
        measurement.mpp,
        $measurementDisplayUnit,
        measurement.type !== 'line'
      );
      const label = formatMeasurementValue(result.calibratedValue, result.unit, measurement.type !== 'line');
      drawLabel(points, measurement.type, label);
    }

    // Draw active measurement
    if ($activeMeasurement && $activeMeasurement.points.length > 0) {
      drawPath($activeMeasurement.points, $activeMeasurement.type, true, mousePos);

      // Calculate and show current value
      const allPoints = mousePos
        ? [...$activeMeasurement.points, viewportToImage(mousePos)].filter((p): p is { x: number; y: number } => p !== null)
        : $activeMeasurement.points;

      if (allPoints.length >= 2) {
        const { value, isArea } = calculateValue(allPoints, $activeMeasurement.type);
        const result = convertToCalibrated(value, $currentMpp, $measurementDisplayUnit, isArea);
        const label = formatMeasurementValue(result.calibratedValue, result.unit, isArea);
        drawLabel(allPoints, $activeMeasurement.type, label);
      }
    }

    // Draw text annotations
    for (const annotation of $textAnnotations) {
      drawTextAnnotation(annotation);
    }
  }

  /** Draw a text annotation */
  function drawTextAnnotation(annotation: TextAnnotation): void {
    if (!ctx) return;

    const viewportPos = imageToViewport(annotation.position);
    if (!viewportPos) return;

    const text = annotation.text;
    const color = annotation.color || '#ffff00';

    // Draw text with background
    ctx.font = 'bold 14px sans-serif';
    const metrics = ctx.measureText(text);
    const padding = 6;
    const bgWidth = metrics.width + padding * 2;
    const bgHeight = 18 + padding * 2;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(viewportPos.x - padding, viewportPos.y - bgHeight + padding, bgWidth, bgHeight);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportPos.x - padding, viewportPos.y - bgHeight + padding, bgWidth, bgHeight);

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, viewportPos.x, viewportPos.y);

    // Draw marker dot
    ctx.beginPath();
    ctx.arc(viewportPos.x, viewportPos.y + 4, 4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /** Extract points from GeoJSON geometry */
  function extractPointsFromGeometry(geometry: any): Array<{ x: number; y: number }> {
    if (!geometry) return [];

    if (geometry.type === 'LineString') {
      return geometry.coordinates.map((c: number[]) => ({ x: c[0], y: c[1] }));
    }
    if (geometry.type === 'Polygon') {
      return geometry.coordinates[0].map((c: number[]) => ({ x: c[0], y: c[1] }));
    }
    if (geometry.type === 'Point') {
      return [{ x: geometry.coordinates[0], y: geometry.coordinates[1] }];
    }

    return [];
  }

  /** Handle mouse move */
  function handleMouseMove(event: MouseEvent): void {
    if (!canvas || !$activeMeasurement) return;

    const rect = canvas.getBoundingClientRect();
    mousePos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    render();
  }

  /** Handle click to add point */
  function handleClick(event: MouseEvent): void {
    if (!canvas || !viewer) return;

    const rect = canvas.getBoundingClientRect();
    const clickPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    const imagePoint = viewportToImage(clickPos);
    if (!imagePoint) return;

    // Handle text annotation mode
    if ($textAnnotationMode) {
      pendingTextPosition.set(imagePoint);
      return;
    }

    // Handle measurement tool
    const tool = $activeMeasurementTool;
    if (!tool) return;

    // Add point to measurement
    addMeasurementPoint(imagePoint.x, imagePoint.y);

    // Re-read the store after adding point (it may now be complete)
    setTimeout(() => {
      const active = $activeMeasurement;
      if (active?.isComplete) {
        const { value } = calculateValue(active.points, active.type);
        const measurement: Measurement = {
          id: active.id,
          slideId: $slideMetadata?.slideId || '',
          scanId: $slideMetadata?.scanId || '',
          type: active.type,
          geometry: createGeometry(active.points, active.type),
          value,
          unit: $measurementDisplayUnit,
          mpp: $currentMpp || 0,
          mppSource: $slideMetadata?.mppSource || 'scanner',
          calibrationState: $currentCalibrationState,
          createdAt: new Date().toISOString(),
        };
        saveMeasurement(measurement);
      }
    }, 0);
  }

  /** Handle double-click to complete polygon/ellipse */
  function handleDoubleClick(): void {
    const active = $activeMeasurement;
    if (!active) return;

    // Polygon needs at least 3 points
    if (active.type === 'polygon' && active.points.length >= 3) {
      // Capture data before completing
      const { value } = calculateValue(active.points, active.type);
      const measurement: Measurement = {
        id: active.id,
        slideId: $slideMetadata?.slideId || '',
        scanId: $slideMetadata?.scanId || '',
        type: active.type,
        geometry: createGeometry(active.points, active.type),
        value,
        unit: $measurementDisplayUnit,
        mpp: $currentMpp || 0,
        mppSource: $slideMetadata?.mppSource || 'scanner',
        calibrationState: $currentCalibrationState,
        createdAt: new Date().toISOString(),
      };
      saveMeasurement(measurement);
    }
  }

  /** Create GeoJSON geometry from points */
  function createGeometry(points: Array<{ x: number; y: number }>, type: MeasurementType): any {
    if (type === 'line') {
      return {
        type: 'LineString',
        coordinates: points.map((p) => [p.x, p.y]),
      };
    }
    return {
      type: 'Polygon',
      coordinates: [[...points.map((p) => [p.x, p.y]), [points[0].x, points[0].y]]],
    };
  }

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      render();
    }
  });

  // Re-render when measurements change
  $effect(() => {
    // Access stores to create dependency
    const active = $activeMeasurement;
    const completed = $measurements;
    const tool = $activeMeasurementTool;
    const vp = $viewportState;
    const w = width;
    const h = height;
    const txtMode = $textAnnotationMode;
    const txtAnnotations = $textAnnotations;

    if (ctx && canvas) {
      // Ensure canvas size matches
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      render();
    }
  });
</script>

<canvas
  bind:this={canvas}
  {width}
  {height}
  class="measurement-overlay"
  class:active={$activeMeasurementTool !== null || $textAnnotationMode}
  onmousemove={handleMouseMove}
  onclick={handleClick}
  ondblclick={handleDoubleClick}
  aria-hidden="true"
></canvas>

<style>
  .measurement-overlay {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 100;
  }

  .measurement-overlay.active {
    pointer-events: auto;
    cursor: crosshair;
  }
</style>
