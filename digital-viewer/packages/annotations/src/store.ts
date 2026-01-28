/**
 * Annotation System - Svelte Stores
 *
 * Reactive state management for annotations
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import type {
  Annotation,
  AnnotationConfig,
  AnnotationLayer,
  AnnotationStyle,
  AnnotationType,
  AnnotationVisibility,
  Classification,
  DrawingState,
  SelectionState,
  DEFAULT_ANNOTATION_CONFIG,
  PATHOLOGY_CLASSIFICATIONS,
} from './types';

/** Current user ID for ownership checks (SYS-ANN-007) */
export const currentUserId: Writable<string | null> = writable(null);

/** Current user's visible slide/scan context */
export const currentSlideContext: Writable<{
  slideId: string;
  scanId: string;
} | null> = writable(null);

/** Annotation configuration store */
export const annotationConfig: Writable<AnnotationConfig> = writable({
  coordinateSystem: 'image',
  snapToPixel: false,
  minPointDistance: 3,
  simplifyTolerance: 1,
  allowOverlap: true,
  autoSave: true,
  autoSaveDebounce: 1000,
});

/** Annotation layers store */
export const annotationLayers: Writable<AnnotationLayer[]> = writable([]);

/** Active layer ID */
export const activeLayerId: Writable<string | null> = writable(null);

/** Drawing state store */
export const drawingState: Writable<DrawingState> = writable({
  active: false,
  type: null,
  points: [],
  style: {
    strokeColor: '#3b82f6',
    strokeWidth: 2,
    strokeOpacity: 1,
    fillColor: '#3b82f6',
    fillOpacity: 0.2,
  },
});

/** Selection state store */
export const selectionState: Writable<SelectionState> = writable({
  selectedIds: new Set(),
  hoveredId: null,
});

/** Available classifications */
export const classifications: Writable<Classification[]> = writable([
  { id: 'tumor', name: 'Tumor', color: '#ef4444', hotkey: 't' },
  { id: 'necrosis', name: 'Necrosis', color: '#6b7280', hotkey: 'n' },
  { id: 'stroma', name: 'Stroma', color: '#10b981', hotkey: 's' },
  { id: 'inflammation', name: 'Inflammation', color: '#f59e0b', hotkey: 'i' },
  { id: 'normal', name: 'Normal', color: '#3b82f6', hotkey: 'o' },
  { id: 'artifact', name: 'Artifact', color: '#8b5cf6', hotkey: 'a' },
  { id: 'other', name: 'Other', color: '#94a3b8' },
]);

/** Active classification for new annotations */
export const activeClassification: Writable<string | null> = writable(null);

/** Current drawing tool */
export const currentTool: Writable<AnnotationType | 'select' | 'pan' | null> =
  writable('pan');

/** Derived: Active layer */
export const activeLayer: Readable<AnnotationLayer | null> = derived(
  [annotationLayers, activeLayerId],
  ([$layers, $activeId]) => {
    if (!$activeId) return $layers[0] || null;
    return $layers.find((l) => l.id === $activeId) || null;
  }
);

/** Derived: All annotations from all visible layers (excluding deleted) */
export const allVisibleAnnotations: Readable<Annotation[]> = derived(
  annotationLayers,
  ($layers) => {
    const annotations: Annotation[] = [];
    for (const layer of $layers) {
      if (layer.visible) {
        // SYS-ANN-008: Filter out soft-deleted annotations
        const activeAnnotations = layer.annotations.filter(
          (a) => !a.properties.isDeleted
        );
        annotations.push(...activeAnnotations);
      }
    }
    return annotations;
  }
);

/** Derived: All annotations including deleted (for audit/recovery) */
export const allAnnotationsWithDeleted: Readable<Annotation[]> = derived(
  annotationLayers,
  ($layers) => {
    const annotations: Annotation[] = [];
    for (const layer of $layers) {
      annotations.push(...layer.annotations);
    }
    return annotations;
  }
);

/** Derived: Selected annotations */
export const selectedAnnotations: Readable<Annotation[]> = derived(
  [allVisibleAnnotations, selectionState],
  ([$annotations, $selection]) => {
    return $annotations.filter((a) =>
      $selection.selectedIds.has(a.properties.id)
    );
  }
);

/** Derived: Is drawing active */
export const isDrawing: Readable<boolean> = derived(
  drawingState,
  ($state) => $state.active
);

/** Derived: Has selection */
export const hasSelection: Readable<boolean> = derived(
  selectionState,
  ($state) => $state.selectedIds.size > 0
);

/** Derived: Annotation count */
export const annotationCount: Readable<number> = derived(
  annotationLayers,
  ($layers) => {
    let count = 0;
    for (const layer of $layers) {
      count += layer.annotations.length;
    }
    return count;
  }
);

/** Actions: Add annotation to active layer */
export function addAnnotation(annotation: Annotation): void {
  annotationLayers.update((layers) => {
    let targetLayer = layers.find((l) => l.id === activeLayerId);
    if (!targetLayer && layers.length > 0) {
      targetLayer = layers[0];
    }

    if (!targetLayer) {
      // Create default layer
      const newLayer: AnnotationLayer = {
        id: 'default',
        name: 'Default Layer',
        color: '#3b82f6',
        visible: true,
        locked: false,
        annotations: [annotation],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return [newLayer];
    }

    return layers.map((layer) =>
      layer.id === targetLayer!.id
        ? {
            ...layer,
            annotations: [...layer.annotations, annotation],
            updatedAt: new Date().toISOString(),
          }
        : layer
    );
  });
}

/** Actions: Update annotation */
export function updateAnnotation(
  annotationId: string,
  updates: Partial<Annotation>
): void {
  annotationLayers.update((layers) =>
    layers.map((layer) => ({
      ...layer,
      annotations: layer.annotations.map((a) =>
        a.properties.id === annotationId
          ? {
              ...a,
              ...updates,
              properties: {
                ...a.properties,
                ...updates.properties,
                updatedAt: new Date().toISOString(),
              },
            }
          : a
      ),
    }))
  );
}

/**
 * Check if current user can delete an annotation (SYS-ANN-007)
 * Only the annotation owner can delete their own annotations
 */
export function canDeleteAnnotation(annotation: Annotation): boolean {
  const userId = get(currentUserId);
  if (!userId) return false;
  return annotation.properties.createdBy === userId;
}

/**
 * Actions: Soft-delete annotation (SYS-ANN-008)
 * Implements tombstone pattern - annotation is marked as deleted, not removed
 * Returns false if user doesn't have permission
 */
export function deleteAnnotation(annotationId: string): boolean {
  const userId = get(currentUserId);
  let canDelete = false;

  annotationLayers.update((layers) => {
    // Find the annotation to check ownership
    for (const layer of layers) {
      const annotation = layer.annotations.find((a) => a.properties.id === annotationId);
      if (annotation) {
        // SYS-ANN-007: Owner-only deletion
        if (annotation.properties.createdBy === userId || !annotation.properties.createdBy) {
          canDelete = true;
        }
        break;
      }
    }

    if (!canDelete) {
      return layers; // No change if not authorized
    }

    // SYS-ANN-008: Soft-delete (tombstone) - mark as deleted, don't remove
    return layers.map((layer) => ({
      ...layer,
      annotations: layer.annotations.map((a) =>
        a.properties.id === annotationId
          ? {
              ...a,
              properties: {
                ...a.properties,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: userId || undefined,
                updatedAt: new Date().toISOString(),
              },
            }
          : a
      ),
      updatedAt: new Date().toISOString(),
    }));
  });

  if (canDelete) {
    // Clear from selection
    selectionState.update((state) => {
      const newSelected = new Set(state.selectedIds);
      newSelected.delete(annotationId);
      return { ...state, selectedIds: newSelected };
    });
  }

  return canDelete;
}

/**
 * Actions: Restore soft-deleted annotation
 */
export function restoreAnnotation(annotationId: string): void {
  annotationLayers.update((layers) =>
    layers.map((layer) => ({
      ...layer,
      annotations: layer.annotations.map((a) =>
        a.properties.id === annotationId
          ? {
              ...a,
              properties: {
                ...a.properties,
                isDeleted: false,
                deletedAt: undefined,
                deletedBy: undefined,
                updatedAt: new Date().toISOString(),
              },
            }
          : a
      ),
      updatedAt: new Date().toISOString(),
    }))
  );
}

/**
 * Actions: Hard delete annotation (admin only, for compliance purge)
 * This actually removes the record - use only for GDPR/compliance
 */
export function hardDeleteAnnotation(annotationId: string): void {
  annotationLayers.update((layers) =>
    layers.map((layer) => ({
      ...layer,
      annotations: layer.annotations.filter((a) => a.properties.id !== annotationId),
      updatedAt: new Date().toISOString(),
    }))
  );

  selectionState.update((state) => {
    const newSelected = new Set(state.selectedIds);
    newSelected.delete(annotationId);
    return { ...state, selectedIds: newSelected };
  });
}

/** Actions: Delete selected annotations */
export function deleteSelectedAnnotations(): void {
  selectionState.update((state) => {
    for (const id of state.selectedIds) {
      deleteAnnotation(id);
    }
    return { selectedIds: new Set(), hoveredId: null };
  });
}

/**
 * Actions: Change annotation visibility (SYS-ANN-004)
 * Only the annotation owner can change visibility
 */
export function changeAnnotationVisibility(
  annotationId: string,
  visibility: AnnotationVisibility
): boolean {
  const userId = get(currentUserId);
  let canChange = false;

  annotationLayers.update((layers) => {
    // Find the annotation to check ownership
    for (const layer of layers) {
      const annotation = layer.annotations.find((a) => a.properties.id === annotationId);
      if (annotation) {
        // Only owner can change visibility
        if (annotation.properties.createdBy === userId || !annotation.properties.createdBy) {
          canChange = true;
        }
        break;
      }
    }

    if (!canChange) {
      return layers;
    }

    return layers.map((layer) => ({
      ...layer,
      annotations: layer.annotations.map((a) =>
        a.properties.id === annotationId
          ? {
              ...a,
              properties: {
                ...a.properties,
                visibility,
                updatedAt: new Date().toISOString(),
                modifiedBy: userId || undefined,
              },
            }
          : a
      ),
      updatedAt: new Date().toISOString(),
    }));
  });

  return canChange;
}

/** Actions: Select annotation */
export function selectAnnotation(annotationId: string, addToSelection = false): void {
  selectionState.update((state) => {
    if (addToSelection) {
      const newSelected = new Set(state.selectedIds);
      newSelected.add(annotationId);
      return { ...state, selectedIds: newSelected };
    }
    return { ...state, selectedIds: new Set([annotationId]) };
  });
}

/** Actions: Deselect annotation */
export function deselectAnnotation(annotationId: string): void {
  selectionState.update((state) => {
    const newSelected = new Set(state.selectedIds);
    newSelected.delete(annotationId);
    return { ...state, selectedIds: newSelected };
  });
}

/** Actions: Clear selection */
export function clearSelection(): void {
  selectionState.set({ selectedIds: new Set(), hoveredId: null });
}

/** Actions: Set hovered annotation */
export function setHoveredAnnotation(annotationId: string | null): void {
  selectionState.update((state) => ({ ...state, hoveredId: annotationId }));
}

/** Actions: Add layer */
export function addLayer(layer: Omit<AnnotationLayer, 'annotations'>): void {
  annotationLayers.update((layers) => [
    ...layers,
    { ...layer, annotations: [] },
  ]);
}

/** Actions: Remove layer */
export function removeLayer(layerId: string): void {
  annotationLayers.update((layers) =>
    layers.filter((l) => l.id !== layerId)
  );

  activeLayerId.update((id) => (id === layerId ? null : id));
}

/** Actions: Toggle layer visibility */
export function toggleLayerVisibility(layerId: string): void {
  annotationLayers.update((layers) =>
    layers.map((layer) =>
      layer.id === layerId
        ? { ...layer, visible: !layer.visible }
        : layer
    )
  );
}

/** Actions: Start drawing */
export function startDrawing(
  type: AnnotationType,
  style?: Partial<AnnotationStyle>
): void {
  drawingState.set({
    active: true,
    type,
    points: [],
    style: {
      strokeColor: style?.strokeColor || '#3b82f6',
      strokeWidth: style?.strokeWidth || 2,
      strokeOpacity: style?.strokeOpacity || 1,
      fillColor: style?.fillColor || '#3b82f6',
      fillOpacity: style?.fillOpacity || 0.2,
    },
  });
  currentTool.set(type);
}

/** Actions: Add point to drawing */
export function addDrawingPoint(x: number, y: number): void {
  drawingState.update((state) => ({
    ...state,
    points: [...state.points, { x, y }],
  }));
}

/** Actions: Finish drawing */
export function finishDrawing(): DrawingState {
  let finalState: DrawingState;
  drawingState.update((state) => {
    finalState = { ...state };
    return {
      active: false,
      type: null,
      points: [],
      style: state.style,
    };
  });
  return finalState!;
}

/** Actions: Cancel drawing */
export function cancelDrawing(): void {
  drawingState.set({
    active: false,
    type: null,
    points: [],
    style: {
      strokeColor: '#3b82f6',
      strokeWidth: 2,
      strokeOpacity: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
    },
  });
}

/** Actions: Reset all annotation state */
export function resetAnnotationState(): void {
  annotationLayers.set([]);
  activeLayerId.set(null);
  drawingState.set({
    active: false,
    type: null,
    points: [],
    style: {
      strokeColor: '#3b82f6',
      strokeWidth: 2,
      strokeOpacity: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
    },
  });
  selectionState.set({ selectedIds: new Set(), hoveredId: null });
  currentTool.set('pan');
}
