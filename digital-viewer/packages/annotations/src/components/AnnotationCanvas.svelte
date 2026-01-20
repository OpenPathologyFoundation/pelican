<script lang="ts">
  /**
   * AnnotationCanvas Component - Annotation Rendering Layer
   *
   * Renders GeoJSON annotations on a canvas overlay
   */

  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    allVisibleAnnotations,
    selectionState,
    drawingState,
    currentTool,
    addAnnotation,
    selectAnnotation,
    clearSelection,
    setHoveredAnnotation,
    addDrawingPoint,
    finishDrawing,
    cancelDrawing,
  } from '../store';
  import {
    createPoint,
    createRectangle,
    createPolygon,
    createPolyline,
    createEllipse,
    createFreehand,
    pointInAnnotation,
  } from '../geometry';
  import type { Annotation, AnnotationType } from '../types';

  /** Props */
  export let width: number;
  export let height: number;
  export let viewportTransform: { x: number; y: number; scale: number } = {
    x: 0,
    y: 0,
    scale: 1,
  };

  /** Internal state */
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let isDrawingActive = false;
  let drawStartPoint: { x: number; y: number } | null = null;

  const dispatch = createEventDispatcher<{
    'annotation-created': { annotation: Annotation };
    'annotation-selected': { annotation: Annotation };
    'annotation-hover': { annotation: Annotation | null };
  }>();

  /** Convert screen coordinates to image coordinates */
  function screenToImage(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - viewportTransform.x) / viewportTransform.scale,
      y: (screenY - viewportTransform.y) / viewportTransform.scale,
    };
  }

  /** Convert image coordinates to screen coordinates */
  function imageToScreen(imageX: number, imageY: number): { x: number; y: number } {
    return {
      x: imageX * viewportTransform.scale + viewportTransform.x,
      y: imageY * viewportTransform.scale + viewportTransform.y,
    };
  }

  /** Render all annotations */
  function render(): void {
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Render annotations
    for (const annotation of $allVisibleAnnotations) {
      renderAnnotation(annotation);
    }

    // Render current drawing
    if ($drawingState.active && $drawingState.points.length > 0) {
      renderDrawingPreview();
    }
  }

  /** Render a single annotation */
  function renderAnnotation(annotation: Annotation): void {
    if (!ctx) return;

    const { geometry, properties } = annotation;
    const style = properties.style;
    const isSelected = $selectionState.selectedIds.has(properties.id);
    const isHovered = $selectionState.hoveredId === properties.id;

    ctx.save();

    // Set styles
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth * (isSelected ? 1.5 : 1);
    ctx.globalAlpha = style.strokeOpacity;
    ctx.fillStyle = style.fillColor;

    if (style.lineDash) {
      ctx.setLineDash(style.lineDash);
    }

    // Draw highlight for selection/hover
    if (isSelected || isHovered) {
      ctx.shadowColor = isSelected ? '#3b82f6' : '#6b7280';
      ctx.shadowBlur = 4;
    }

    ctx.beginPath();

    if (geometry.type === 'Point') {
      const screen = imageToScreen(geometry.coordinates[0], geometry.coordinates[1]);
      ctx.arc(screen.x, screen.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (geometry.type === 'LineString') {
      const coords = geometry.coordinates;
      for (let i = 0; i < coords.length; i++) {
        const screen = imageToScreen(coords[i][0], coords[i][1]);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      }
      ctx.stroke();

      // Draw arrow head if it's an arrow
      if (properties.type === 'arrow' && coords.length >= 2) {
        drawArrowHead(
          coords[coords.length - 2],
          coords[coords.length - 1]
        );
      }
    } else if (geometry.type === 'Polygon') {
      const ring = geometry.coordinates[0];
      for (let i = 0; i < ring.length; i++) {
        const screen = imageToScreen(ring[i][0], ring[i][1]);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      }
      ctx.closePath();
      ctx.globalAlpha = style.fillOpacity;
      ctx.fill();
      ctx.globalAlpha = style.strokeOpacity;
      ctx.stroke();
    }

    ctx.restore();

    // Draw label if present
    if (properties.label) {
      drawLabel(annotation);
    }
  }

  /** Draw arrow head */
  function drawArrowHead(from: number[], to: number[]): void {
    if (!ctx) return;

    const fromScreen = imageToScreen(from[0], from[1]);
    const toScreen = imageToScreen(to[0], to[1]);

    const angle = Math.atan2(toScreen.y - fromScreen.y, toScreen.x - fromScreen.x);
    const headLength = 15;

    ctx.beginPath();
    ctx.moveTo(toScreen.x, toScreen.y);
    ctx.lineTo(
      toScreen.x - headLength * Math.cos(angle - Math.PI / 6),
      toScreen.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(toScreen.x, toScreen.y);
    ctx.lineTo(
      toScreen.x - headLength * Math.cos(angle + Math.PI / 6),
      toScreen.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  /** Draw annotation label */
  function drawLabel(annotation: Annotation): void {
    if (!ctx || !annotation.properties.label) return;

    const centroid = getCentroid(annotation);
    if (!centroid) return;

    const screen = imageToScreen(centroid.x, centroid.y);

    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(annotation.properties.label, screen.x, screen.y);
    ctx.fillText(annotation.properties.label, screen.x, screen.y);
    ctx.restore();
  }

  /** Get centroid of annotation */
  function getCentroid(annotation: Annotation): { x: number; y: number } | null {
    const geometry = annotation.geometry;

    if (geometry.type === 'Point') {
      return { x: geometry.coordinates[0], y: geometry.coordinates[1] };
    } else if (geometry.type === 'LineString') {
      const mid = Math.floor(geometry.coordinates.length / 2);
      return { x: geometry.coordinates[mid][0], y: geometry.coordinates[mid][1] };
    } else if (geometry.type === 'Polygon') {
      const ring = geometry.coordinates[0];
      let sumX = 0, sumY = 0;
      for (const coord of ring) {
        sumX += coord[0];
        sumY += coord[1];
      }
      return { x: sumX / ring.length, y: sumY / ring.length };
    }

    return null;
  }

  /** Render drawing preview */
  function renderDrawingPreview(): void {
    if (!ctx || !$drawingState.type) return;

    const { points, style, type } = $drawingState;
    if (points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.setLineDash([5, 5]);
    ctx.globalAlpha = 0.7;

    ctx.beginPath();

    if (type === 'rectangle' && points.length >= 1) {
      const start = imageToScreen(points[0].x, points[0].y);
      const end = points.length > 1
        ? imageToScreen(points[points.length - 1].x, points[points.length - 1].y)
        : start;

      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (type === 'ellipse' && points.length >= 1) {
      if (points.length > 1) {
        const center = imageToScreen(points[0].x, points[0].y);
        const edge = imageToScreen(points[points.length - 1].x, points[points.length - 1].y);
        const rx = Math.abs(edge.x - center.x);
        const ry = Math.abs(edge.y - center.y);
        ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
      }
    } else {
      for (let i = 0; i < points.length; i++) {
        const screen = imageToScreen(points[i].x, points[i].y);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /** Handle mouse down */
  function handleMouseDown(event: MouseEvent): void {
    if ($currentTool === 'pan') return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const imagePoint = screenToImage(screenX, screenY);

    if ($currentTool === 'select') {
      // Check if clicking on an annotation
      const hit = findAnnotationAtPoint(imagePoint.x, imagePoint.y);
      if (hit) {
        selectAnnotation(hit.properties.id, event.shiftKey);
        dispatch('annotation-selected', { annotation: hit });
      } else {
        clearSelection();
      }
      return;
    }

    // Start drawing
    isDrawingActive = true;
    drawStartPoint = imagePoint;
    addDrawingPoint(imagePoint.x, imagePoint.y);
  }

  /** Handle mouse move */
  function handleMouseMove(event: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const imagePoint = screenToImage(screenX, screenY);

    // Hover detection
    if ($currentTool === 'select' || $currentTool === 'pan') {
      const hit = findAnnotationAtPoint(imagePoint.x, imagePoint.y);
      setHoveredAnnotation(hit?.properties.id || null);
      if (hit) {
        dispatch('annotation-hover', { annotation: hit });
      }
    }

    // Drawing update
    if (isDrawingActive && $drawingState.active) {
      const type = $drawingState.type;

      if (type === 'freehand') {
        addDrawingPoint(imagePoint.x, imagePoint.y);
      } else if (type === 'rectangle' || type === 'ellipse') {
        // Update the last point for rectangle/ellipse preview
        if ($drawingState.points.length > 1) {
          $drawingState.points[$drawingState.points.length - 1] = imagePoint;
        } else {
          addDrawingPoint(imagePoint.x, imagePoint.y);
        }
      }

      render();
    }
  }

  /** Handle mouse up */
  function handleMouseUp(event: MouseEvent): void {
    if (!isDrawingActive || !$drawingState.active) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const imagePoint = screenToImage(screenX, screenY);

    const type = $drawingState.type;
    const points = $drawingState.points;

    let annotation: Annotation | null = null;

    if (type === 'point') {
      annotation = createPoint(imagePoint.x, imagePoint.y);
    } else if (type === 'rectangle' && points.length >= 2) {
      annotation = createRectangle(
        points[0].x,
        points[0].y,
        imagePoint.x,
        imagePoint.y
      );
    } else if (type === 'ellipse' && points.length >= 2) {
      const centerX = points[0].x;
      const centerY = points[0].y;
      const rx = Math.abs(imagePoint.x - centerX);
      const ry = Math.abs(imagePoint.y - centerY);
      annotation = createEllipse(centerX, centerY, rx, ry);
    } else if (type === 'freehand' && points.length >= 3) {
      annotation = createFreehand(points, true);
    }

    if (annotation) {
      addAnnotation(annotation);
      dispatch('annotation-created', { annotation });
    }

    isDrawingActive = false;
    drawStartPoint = null;
    finishDrawing();
  }

  /** Handle double click for polygon completion */
  function handleDoubleClick(event: MouseEvent): void {
    if (!$drawingState.active) return;

    const type = $drawingState.type;
    const points = $drawingState.points;

    if ((type === 'polygon' || type === 'polyline') && points.length >= 3) {
      const annotation =
        type === 'polygon'
          ? createPolygon(points)
          : createPolyline(points);

      addAnnotation(annotation);
      dispatch('annotation-created', { annotation });

      isDrawingActive = false;
      drawStartPoint = null;
      finishDrawing();
    }
  }

  /** Handle click for polygon/polyline point addition */
  function handleClick(event: MouseEvent): void {
    if (!$drawingState.active) return;

    const type = $drawingState.type;
    if (type !== 'polygon' && type !== 'polyline') return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const imagePoint = screenToImage(screenX, screenY);

    addDrawingPoint(imagePoint.x, imagePoint.y);
    render();
  }

  /** Handle keyboard shortcuts */
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && $drawingState.active) {
      cancelDrawing();
      isDrawingActive = false;
      drawStartPoint = null;
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      // Delete selected annotations (handled by store)
    }
  }

  /** Find annotation at point */
  function findAnnotationAtPoint(x: number, y: number): Annotation | null {
    // Search in reverse order (top to bottom)
    for (let i = $allVisibleAnnotations.length - 1; i >= 0; i--) {
      const annotation = $allVisibleAnnotations[i];
      if (pointInAnnotation(x, y, annotation, 10 / viewportTransform.scale)) {
        return annotation;
      }
    }
    return null;
  }

  /** Lifecycle */
  onMount(() => {
    ctx = canvas.getContext('2d');
    render();
  });

  /** Reactive render */
  $: if (ctx) {
    render();
  }

  $: if (viewportTransform && ctx) {
    render();
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<canvas
  bind:this={canvas}
  {width}
  {height}
  class="annotation-canvas"
  class:drawing={$drawingState.active}
  class:select={$currentTool === 'select'}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:click={handleClick}
  on:dblclick={handleDoubleClick}
/>

<style>
  .annotation-canvas {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: auto;
    cursor: default;
  }

  .annotation-canvas.drawing {
    cursor: crosshair;
  }

  .annotation-canvas.select {
    cursor: pointer;
  }
</style>
