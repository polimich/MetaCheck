import { ref, computed, reactive, provide, inject } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Vector2d } from 'konva/lib/types';
import { DetectionState, newDetectionState } from 'src/types';
import { useImageCanvas } from './useImageCanvas';

// Separate selection management concerns
function useSelectionManagement() {
  const selectedIds = ref<Set<string>>(new Set());

  function selectAnnotation(id: string, addToSelection = false) {
    console.log(
      'Selecting annotation:',
      id,
      'Add to selection:',
      addToSelection,
    );

    // If not adding to selection, clear current selection
    if (!addToSelection) {
      selectedIds.value.clear();
    }

    // Add the annotation to selection
    selectedIds.value.add(id);
  }

  function deselectAll() {
    console.log('Deselecting all annotations');
    selectedIds.value.clear();
  }

  return {
    selectedIds,
    selectAnnotation,
    deselectAll,
  };
}

// Separate history management concerns
function useHistoryManagement(
  annotations: ReturnType<typeof ref<DetectionState[]>>,
  selectedIds: ReturnType<typeof ref<Set<string>>>,
) {
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);

  function saveState() {
    // Limit undo stack size (optional)
    const MAX_HISTORY = 50;
    if (undoStack.value.length >= MAX_HISTORY) {
      undoStack.value.shift(); // Remove oldest entry
    }
    undoStack.value.push(JSON.stringify(annotations.value));
    redoStack.value = []; // Clear redo stack on new action
    console.log('Saved state, undo stack size:', undoStack.value.length);
  }

  function undo() {
    if (undoStack.value.length === 0) return;

    // Save current state in redo stack
    redoStack.value.push(JSON.stringify(annotations.value));

    // Restore previous state
    const prevState = undoStack.value.pop();
    if (prevState) {
      annotations.value = JSON.parse(prevState);
    }

    // Clear selection as it may no longer be valid
    if (selectedIds.value) {
      selectedIds.value.clear();
    }
    console.log('Undo complete, undo stack size:', undoStack.value.length);
  }

  function redo() {
    if (redoStack.value.length === 0) return;

    // Save current state in undo stack
    undoStack.value.push(JSON.stringify(annotations.value));

    // Restore next state
    const nextState = redoStack.value.pop();
    if (nextState) {
      annotations.value = JSON.parse(nextState);
    }

    // Clear selection as it may have changed
    if (selectedIds.value) {
      selectedIds.value.clear();
    }
    console.log('Redo complete, redo stack size:', redoStack.value.length);
  }

  return {
    undoStack,
    redoStack,
    saveState,
    undo,
    redo,
  };
}

// Separate annotation normalization concern
function useAnnotationNormalization(
  imageCanvas: ReturnType<typeof useImageCanvas>,
) {
  function normalizeAnnotation(annotation: DetectionState) {
    // Handle negative width
    if (annotation.width < 0) {
      annotation.x += annotation.width;
      annotation.width = Math.abs(annotation.width);
    }

    // Handle negative height
    if (annotation.height < 0) {
      annotation.y += annotation.height;
      annotation.height = Math.abs(annotation.height);
    }

    // Ensure annotation stays within ORIGINAL image boundaries
    const imageWidth = imageCanvas.dimensions.value?.originalWidth || 0;
    const imageHeight = imageCanvas.dimensions.value?.originalHeight || 0;

    // Clip left edge
    if (annotation.x < 0) {
      annotation.width += annotation.x; // Reduce width by the amount it's off-screen
      annotation.x = 0;
    }

    // Clip top edge
    if (annotation.y < 0) {
      annotation.height += annotation.y; // Reduce height by the amount it's off-screen
      annotation.y = 0;
    }

    // Clip right edge
    if (annotation.x + annotation.width > imageWidth) {
      annotation.width = imageWidth - annotation.x;
    }

    // Clip bottom edge
    if (annotation.y + annotation.height > imageHeight) {
      annotation.height = imageHeight - annotation.y;
    }

    // Prevent zero or negative dimensions after clipping
    annotation.width = Math.max(0, annotation.width);
    annotation.height = Math.max(0, annotation.height);

    // Round to precision of 3 decimal places
    annotation.x = Number(annotation.x.toFixed(3));
    annotation.y = Number(annotation.y.toFixed(3));
    annotation.width = Number(annotation.width.toFixed(3));
    annotation.height = Number(annotation.height.toFixed(3));
  }

  return {
    normalizeAnnotation,
  };
}

/**
 * Composable for managing annotation state and operations
 */
export function useAnnotations(imageCanvas: ReturnType<typeof useImageCanvas>) {
  // Core state
  const annotations = ref<DetectionState[]>([]);
  const isCreating = ref(false);
  const creatingAnnotation = ref<DetectionState | null>(null);
  const startPoint = reactive({ x: 0, y: 0 });
  const pendingMetaAnnotationId = ref<string | null>(null);

  // Use separated composables
  const {
    selectedIds,
    selectAnnotation,
    deselectAll: deselectAllInternal,
  } = useSelectionManagement();
  const { undoStack, redoStack, saveState, undo, redo } = useHistoryManagement(
    annotations,
    selectedIds,
  );
  const { normalizeAnnotation } = useAnnotationNormalization(imageCanvas);

  // Track deleted annotations for backend syncing
  const deletedAnnotations = ref<DetectionState[]>([]);

  // Computed
  const hasSelection = computed(() => selectedIds.value.size > 0);
  const selectedAnnotations = computed(() =>
    annotations.value.filter((a) => selectedIds.value.has(a.id)),
  );

  // Get annotations for saving
  const annotationsForSave = computed(() => {
    return {
      annotations: annotations.value,
      deletedAnnotations: deletedAnnotations.value,
    };
  });

  // Create new annotation
  function startCreate(point: Vector2d, imageId: string) {
    // Clear pending meta if starting a new one
    cancelAnnotationMeta();
    deselectAll();

    saveState();

    isCreating.value = true;
    const newAnnotation = newDetectionState();
    newAnnotation.id = uuidv4();
    newAnnotation.image_id = imageId;
    newAnnotation.x = point.x;
    newAnnotation.y = point.y;
    newAnnotation.width = 0;
    newAnnotation.height = 0;
    newAnnotation.computed_display_type = 'box'; // Assuming box for now
    newAnnotation.computed_type = 'box';
    newAnnotation.computed_color = '#FF0000'; // Default color

    creatingAnnotation.value = newAnnotation;
    startPoint.x = point.x;
    startPoint.y = point.y;
    annotations.value.push(newAnnotation);
  }

  // Update during drag
  function updateCreating(point: Vector2d) {
    if (!isCreating.value || !creatingAnnotation.value) return;

    creatingAnnotation.value.width = point.x - startPoint.x;
    creatingAnnotation.value.height = point.y - startPoint.y;

    // No normalization here, only on finish
  }

  // Finish creating annotation - Now sets pending ID
  function finishCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;

    const finishedAnnotation = creatingAnnotation.value;
    normalizeAnnotation(finishedAnnotation);

    if (finishedAnnotation.width < 5 || finishedAnnotation.height < 5) {
      annotations.value = annotations.value.filter(
        (a) => a.id !== finishedAnnotation.id,
      );
      undoStack.value.pop();
      console.log('Invalid annotation removed, popped state from undo stack.');
      isCreating.value = false;
      creatingAnnotation.value = null;
    } else {
      // Annotation is valid, set it as pending meta input
      pendingMetaAnnotationId.value = finishedAnnotation.id;
      // Don't mark as edited yet, wait for confirmation
      console.log(
        'Valid annotation finished, pending meta input for ID:',
        finishedAnnotation.id,
      );
      isCreating.value = false;
      creatingAnnotation.value = null;
      // Select the new annotation visually while pending meta
      selectAnnotation(finishedAnnotation.id);
    }
  }

  // Cancel creation process
  function cancelCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;

    // Remove the annotation being created
    annotations.value = annotations.value.filter(
      (a) => a.id !== creatingAnnotation.value?.id,
    );

    // Pop the state saved when starting creation
    undoStack.value.pop();

    // Reset creation state
    isCreating.value = false;
    creatingAnnotation.value = null;
  }

  // Move selected annotations (boundary check uses ORIGINAL dimensions)
  function moveAnnotation(id: string, delta: Vector2d) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;

    // Save state before moving
    // Note: Dragging generates many events, might need debouncing or save on drag end
    // saveState();

    // Apply movement
    annotation.x += delta.x;
    annotation.y += delta.y;

    // Mark as edited
    annotation.edited = true;

    // Ensure within ORIGINAL image bounds
    const imageWidth = imageCanvas.dimensions.value?.originalWidth || 0;
    const imageHeight = imageCanvas.dimensions.value?.originalHeight || 0;

    // Prevent moving past left edge
    if (annotation.x < 0) {
      annotation.x = 0;
    }

    // Prevent moving past top edge
    if (annotation.y < 0) {
      annotation.y = 0;
    }

    // Prevent moving past right edge
    if (annotation.x + annotation.width > imageWidth) {
      annotation.x = imageWidth - annotation.width;
    }

    // Prevent moving past bottom edge
    if (annotation.y + annotation.height > imageHeight) {
      annotation.y = imageHeight - annotation.height;
    }
  }

  // Update annotation dimensions directly (for Konva transformer)
  function updateAnnotationDimensions(
    id: string,
    newDimensions: { x: number; y: number; width: number; height: number },
  ) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;

    // Save current state for undo before applying transform changes
    saveState();

    // Update dimensions
    annotation.x = newDimensions.x;
    annotation.y = newDimensions.y;
    annotation.width = newDimensions.width;
    annotation.height = newDimensions.height;

    // Mark as edited
    annotation.edited = true;

    // Ensure annotation stays within image boundaries after transform
    normalizeAnnotation(annotation);
  }

  // Delete selected annotations
  function deleteSelected() {
    if (selectedIds.value.size === 0) return;

    // Check if the pending annotation is among those selected
    if (
      pendingMetaAnnotationId.value &&
      selectedIds.value.has(pendingMetaAnnotationId.value)
    ) {
      // If deleting the annotation pending meta, treat it as a cancel
      cancelAnnotationMeta();
      // If only the pending annotation was selected, we are done
      if (selectedIds.value.size === 0) return;
    }

    saveState();

    const toDelete = annotations.value.filter((a) =>
      selectedIds.value.has(a.id),
    );
    toDelete.forEach((a) => (a.deleted = true));
    deletedAnnotations.value = [...deletedAnnotations.value, ...toDelete];

    annotations.value = annotations.value.filter(
      (a) => !selectedIds.value.has(a.id),
    );

    selectedIds.value.clear();
  }

  // Load annotations from external source
  function loadAnnotations(loadedAnnotations: DetectionState[]) {
    // Save current state if we have annotations to enable undo
    if (annotations.value.length > 0) {
      saveState();
    }

    // Clone annotations to avoid reference issues
    annotations.value = loadedAnnotations;

    // Clear selection
    selectedIds.value.clear();

    // Check for isSelected property in the loaded annotations and update selection
    for (const ann of loadedAnnotations) {
      if ('isSelected' in ann && ann.isSelected) {
        selectedIds.value.add(ann.id);
      }
    }

    // Reset creation state
    isCreating.value = false;
    creatingAnnotation.value = null;
    pendingMetaAnnotationId.value = null;

    console.log(`Loaded ${annotations.value.length} annotations`);
  }

  // Sync selections with the store
  function syncSelectionWithStore(storeSelectedId: string | null) {
    if (!storeSelectedId) {
      selectedIds.value.clear();
      return;
    }

    // Select only the annotation with this ID
    if (annotations.value.some((ann) => ann.id === storeSelectedId)) {
      selectedIds.value.clear();
      selectedIds.value.add(storeSelectedId);
    }
  }

  // Provide reactive state and methods
  provide('annotations', annotations);
  provide('selectedIds', selectedIds);
  provide('deletedAnnotations', deletedAnnotations);

  function clearPendingMeta() {
    if (pendingMetaAnnotationId.value) {
      console.log(
        '[useAnnotations] Clearing pending meta for ID:',
        pendingMetaAnnotationId.value,
      );
      pendingMetaAnnotationId.value = null;
    }
  }

  function deselectAll() {
    clearPendingMeta();
    deselectAllInternal();
  }

  function selectAnnotationAndClearPending(id: string, addToSelection = false) {
    clearPendingMeta();
    selectAnnotation(id, addToSelection);
  }

  // Confirm Metadata for the pending annotation
  function confirmAnnotationMeta(metaRole: string | null, value: string) {
    if (!pendingMetaAnnotationId.value) return;

    const annotation = annotations.value.find(
      (a) => a.id === pendingMetaAnnotationId.value,
    );

    if (annotation) {
      console.log(
        '[useAnnotations] Confirming meta for ID:',
        annotation.id,
        'Role:',
        metaRole,
        'Value:',
        value,
      );
      annotation.value = value;
      annotation.edited = true; // Now mark as edited
      // Optionally save state again after meta confirmation? Depends on desired undo granularity
      // saveState();
    } else {
      console.error(
        '[useAnnotations] Could not find annotation to confirm meta for ID:',
        pendingMetaAnnotationId.value,
      );
    }

    pendingMetaAnnotationId.value = null; // Clear pending state
  }

  // Cancel Metadata input and remove the annotation
  function cancelAnnotationMeta() {
    if (!pendingMetaAnnotationId.value) return;

    const idToRemove = pendingMetaAnnotationId.value;
    console.log('[useAnnotations] Cancelling meta input for ID:', idToRemove);

    // Remove the annotation
    annotations.value = annotations.value.filter((a) => a.id !== idToRemove);

    // Pop the state saved when starting creation
    // We assume the state *before* this annotation was started is what we want
    undoStack.value.pop();
    console.log(
      'Annotation removed due to meta cancel, popped state from undo stack.',
    );

    pendingMetaAnnotationId.value = null; // Clear pending state
    // Also clear selection if the cancelled annotation was selected
    if (selectedIds.value.has(idToRemove)) {
      selectedIds.value.delete(idToRemove);
    }
  }

  return {
    // State
    annotations,
    selectedIds,
    isCreating,
    creatingAnnotation,
    pendingMetaAnnotationId,
    hasSelection,
    selectedAnnotations,
    undoStack,
    redoStack,
    deletedAnnotations,
    annotationsForSave,

    // Methods
    startCreate,
    updateCreating,
    finishCreate,
    cancelCreate,
    selectAnnotation: selectAnnotationAndClearPending,
    deselectAll,
    moveAnnotation,
    updateAnnotationDimensions,
    deleteSelected,
    saveState,
    undo,
    redo,
    loadAnnotations,
    confirmAnnotationMeta,
    cancelAnnotationMeta,
    syncSelectionWithStore,
  };
}

// Injection functions for consuming components
export function useAnnotationContext() {
  const annotations = inject<typeof ref<DetectionState[]>>('annotations');
  const selectedIds = inject<typeof ref<Set<string>>>('selectedIds');
  const deletedAnnotations =
    inject<typeof ref<DetectionState[]>>('deletedAnnotations');

  if (!annotations || !selectedIds || !deletedAnnotations) {
    throw new Error(
      'useAnnotationContext must be used within an AnnotationProvider',
    );
  }

  return {
    annotations,
    selectedIds,
    deletedAnnotations,
  };
}
