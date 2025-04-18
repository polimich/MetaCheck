import { ref, computed, reactive, provide, inject } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Vector2d } from 'konva/lib/types';
import { DetectionState, newDetectionState } from 'src/types';
import { useImageCanvas } from './useImageCanvas';
import { useSelectionManagement } from './useSelectionManagement';
import { useImageStore } from 'src/stores'; // Import image store

// Separate history management concerns
function useHistoryManagement(
  annotations: ReturnType<typeof ref<DetectionState[]>>,
  selectedIds: ReturnType<typeof ref<Set<string>>>,
) {
  // History state
  const undoStack = ref<
    { annotations: DetectionState[]; selectedIds: Set<string> }[]
  >([]);
  const redoStack = ref<
    { annotations: DetectionState[]; selectedIds: Set<string> }[]
  >([]);

  // Save current state for undo/redo
  function saveState() {
    const cloneAnnotations = annotations.value?.map((a) => ({ ...a })) || [];
    undoStack.value.push({
      annotations: cloneAnnotations,
      selectedIds: new Set(selectedIds.value || new Set<string>()),
    });
    redoStack.value = []; // Clear redo stack when making a new change
    console.log(
      'Saved state to undo stack, stack size:',
      undoStack.value.length,
      'Selected IDs:',
      Array.from(selectedIds.value || new Set<string>()),
    );
  }

  // Undo last action
  function undo() {
    if (undoStack.value.length === 0) return;

    // Get last state from stack
    const prevState = undoStack.value.pop();
    if (!prevState) return;

    // Save current state to redo stack
    redoStack.value.push({
      annotations: annotations.value?.map((a) => ({ ...a })) || [],
      selectedIds: new Set(selectedIds.value || new Set<string>()),
    });

    // Restore previous state
    annotations.value = prevState.annotations;
    selectedIds.value = prevState.selectedIds;
    console.log(
      'Undo: restored state, undo stack size:',
      undoStack.value.length,
      'redo stack size:',
      redoStack.value.length,
    );
  }

  // Redo previously undone action
  function redo() {
    if (redoStack.value.length === 0) return;

    // Get last state from redo stack
    const nextState = redoStack.value.pop();
    if (!nextState) return;

    // Save current state to undo stack
    undoStack.value.push({
      annotations: annotations.value?.map((a) => ({ ...a })) || [],
      selectedIds: new Set(selectedIds.value || new Set<string>()),
    });

    // Restore next state
    annotations.value = nextState.annotations;
    selectedIds.value = nextState.selectedIds;
    console.log(
      'Redo: restored state, undo stack size:',
      undoStack.value.length,
      'redo stack size:',
      redoStack.value.length,
    );
  }

  return {
    undoStack,
    redoStack,
    saveState,
    undo,
    redo,
  };
}

// Separate annotation normalization concerns
function useAnnotationNormalization(
  imageCanvas: ReturnType<typeof useImageCanvas>,
) {
  // Normalize annotation dimensions (handle negative w/h)
  function normalizeAnnotation(annotation: DetectionState): DetectionState {
    let { x, y, width, height } = annotation;

    // Handle negative width/height (drag from bottom-right to top-left)
    if (width < 0) {
      x += width;
      width = Math.abs(width);
    }

    if (height < 0) {
      y += height;
      height = Math.abs(height);
    }

    // Enforce minimum size (prevent zero-size annotations)
    width = Math.max(width, 5);
    height = Math.max(height, 5);

    // Constrain to image bounds if we have image dimensions
    if (imageCanvas.dimensions.value) {
      const imgWidth = imageCanvas.dimensions.value.originalWidth;
      const imgHeight = imageCanvas.dimensions.value.originalHeight;

      x = Math.max(0, Math.min(x, imgWidth - width));
      y = Math.max(0, Math.min(y, imgHeight - height));
    }

    return {
      ...annotation,
      x,
      y,
      width,
      height,
    };
  }

  return { normalizeAnnotation };
}

/**
 * Composable for managing annotation state and operations
 */
export function useAnnotations(imageCanvas: ReturnType<typeof useImageCanvas>) {
  // Get the image store
  const imageStore = useImageStore();

  // Core state
  const annotations = ref<DetectionState[]>([]);
  const isCreating = ref(false);
  const creatingAnnotation = ref<DetectionState | null>(null);
  const startPoint = reactive({ x: 0, y: 0 });
  const pendingMetaAnnotationId = ref<string | null>(null);

  // Use the shared selection management composable
  const {
    selectedIds,
    selectDetection,
    deselectAll: deselectAllInternal,
  } = useSelectionManagement();

  const { undoStack, redoStack, saveState, undo, redo } = useHistoryManagement(
    annotations,
    selectedIds,
  );
  const { normalizeAnnotation } = useAnnotationNormalization(imageCanvas);

  // Computed
  const hasSelection = computed(() => selectedIds.value.size > 0);
  const selectedAnnotations = computed(() =>
    annotations.value.filter((a) => selectedIds.value.has(a.id)),
  );

  // Get annotations for saving - No longer needs deletedAnnotations
  const annotationsForSave = computed(() => {
    return {
      annotations: annotations.value,
      // deletedAnnotations: deletedAnnotations.value,
    };
  });

  // Start creating a new annotation
  function startCreate(startPos: Vector2d, imageId: string) {
    if (isCreating.value) return;

    console.log('Start creating annotation at:', startPos);
    startPoint.x = startPos.x;
    startPoint.y = startPos.y;

    // Create a new annotation
    const newAnnotation = newDetectionState();
    newAnnotation.id = uuidv4(); // Temporary ID until saved
    newAnnotation.image_id = imageId;
    newAnnotation.x = startPos.x;
    newAnnotation.y = startPos.y;
    newAnnotation.width = 0;
    newAnnotation.height = 0;
    newAnnotation.created_date = new Date().toISOString();
    newAnnotation.confidence = 1.0; // New annotations are fully confident
    newAnnotation.edited = true; // Mark as edited since it's new
    newAnnotation.annotated = true;

    // Default meta values (will be overridden after creation)
    // Use consistent, more descriptive default values
    newAnnotation.computed_type = ''; // Will be set by selected role
    newAnnotation.computed_color = '#ff0000'; // Red as default color
    newAnnotation.computed_display_type = ''; // Will be set by selected role label

    // Save state before adding the new annotation
    saveState();

    // Start tracking the new annotation
    creatingAnnotation.value = newAnnotation;
    isCreating.value = true;

    annotations.value.push(newAnnotation);
  }

  // Update annotation being created
  function updateCreating(currentPos: Vector2d) {
    if (!isCreating.value || !creatingAnnotation.value) return;

    // Update with current mouse position
    const annotation = creatingAnnotation.value;
    annotation.width = currentPos.x - startPoint.x;
    annotation.height = currentPos.y - startPoint.y;
  }

  // Finish creating annotation
  function finishCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;

    console.log('Finish creating annotation');

    const annotation = creatingAnnotation.value;

    // Normalize dimensions (handle negative width/height)
    const normalized = normalizeAnnotation(annotation);
    Object.assign(annotation, normalized);

    // Set a real ID that will be used for server storage
    annotation.id = uuidv4();

    // Clear creation state
    isCreating.value = false;
    creatingAnnotation.value = null;

    // Clear any current selection and select this new annotation
    selectedIds.value.clear();
    selectedIds.value.add(annotation.id);

    console.log('Created annotation:', annotation);

    // Set pending meta ID so user can input metadata
    pendingMetaAnnotationId.value = annotation.id;
    console.log('Awaiting metadata input for annotation:', annotation.id);
  }

  // Cancel annotation creation
  function cancelCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;

    console.log('Cancelling annotation creation');

    // Remove the annotation being created
    const id = creatingAnnotation.value.id;
    annotations.value = annotations.value.filter((a) => a.id !== id);

    // Clear creation state
    isCreating.value = false;
    creatingAnnotation.value = null;
  }

  // Move an annotation
  function moveAnnotation(id: string, delta: Vector2d) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;

    annotation.x += delta.x;
    annotation.y += delta.y;
    annotation.edited = true;
  }

  // Update annotation dimensions (after transform or drag)
  function updateAnnotationDimensions(
    id: string,
    newDimensions: { x: number; y: number; width: number; height: number },
  ) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;

    saveState();

    Object.assign(annotation, newDimensions);
    annotation.edited = true;

    // Normalize to handle any negative dimensions
    const normalized = normalizeAnnotation(annotation);
    Object.assign(annotation, normalized);

    console.log('Updated annotation dimensions:', annotation);
  }

  // Delete selected annotations
  function deleteSelected() {
    if (selectedIds.value.size === 0) return;
    console.log(
      '[useAnnotations] Deleting selected annotations:',
      Array.from(selectedIds.value),
    );

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

    // Create a copy of the selected IDs before clearing
    const idsToDelete = new Set(selectedIds.value);

    // Remove from local annotations state
    annotations.value = annotations.value.filter((a) => !idsToDelete.has(a.id));

    // Remove from the store and queue for backend deletion
    idsToDelete.forEach((id) => {
      imageStore.deleteDetectionLocally(id);
    });

    // Clear selection in the local state
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

  // Provide reactive state and methods - REMOVE deletedAnnotations
  provide('annotations', annotations);
  provide('selectedIds', selectedIds);
  // provide('deletedAnnotations', deletedAnnotations);

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

  function selectAnnotation(id: string, addToSelection = false) {
    clearPendingMeta();
    selectDetection(id, addToSelection);
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
      // Set the value from user input
      annotation.value = value;
      // Note: computed_type and computed_display_type are set in ImageAnnotator.vue
      // when metaRole object is looked up
      annotation.edited = true; // Mark as edited
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
    // REMOVE: deletedAnnotations,
    annotationsForSave,

    // Methods
    startCreate,
    updateCreating,
    finishCreate,
    cancelCreate,
    selectAnnotation,
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

// Injection functions for consuming components - REMOVE deletedAnnotations
export function useAnnotationContext() {
  const annotations = inject<typeof ref<DetectionState[]>>('annotations');
  const selectedIds = inject<typeof ref<Set<string>>>('selectedIds');
  // const deletedAnnotations =
  //   inject<typeof ref<DetectionState[]>>('deletedAnnotations');

  if (!annotations || !selectedIds /*|| !deletedAnnotations*/) {
    throw new Error(
      'useAnnotationContext must be used within an AnnotationProvider',
    );
  }

  return {
    annotations,
    selectedIds,
    // deletedAnnotations,
  };
}
