import { ref, computed, reactive, provide, inject, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Vector2d } from 'konva/lib/types';
import { DetectionState, newDetectionState } from 'src/types';
import { useImageCanvas } from './useImageCanvas';
import { useImage } from 'src/stores/data/useImage';

// Helper function to convert coordinates to bbox string
function objectToBbox(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return `${x},${y},${width},${height}`;
}

// --- History Management (Helper Composable) --- //
/**
 * Manages the undo/redo state for annotations and selections.
 */
function useHistoryManagement(
  annotations: ReturnType<typeof ref<DetectionState[]>>,
  selectedIds: ReturnType<typeof ref<Set<string>>>,
) {
  const undoStack = ref<
    { annotations: DetectionState[]; selectedIds: Set<string> }[]
  >([]);
  const redoStack = ref<
    { annotations: DetectionState[]; selectedIds: Set<string> }[]
  >([]);

  /** Saves the current annotation and selection state to the undo stack. */
  function saveState() {
    // Deep clone to prevent mutations affecting history
    const currentAnnotations = annotations.value || []; // Handle potential undefined
    const cloneAnnotations = currentAnnotations.map((a) => ({ ...a }));
    undoStack.value.push({
      annotations: cloneAnnotations,
      selectedIds: new Set(selectedIds.value),
    });
    redoStack.value = []; // Clear redo stack on new action
    console.log(
      '[History] State saved. Undo:',
      undoStack.value.length,
      'Redo:',
      redoStack.value.length,
    );
  }

  /** Restores the previous state from the undo stack. */
  function undo() {
    if (undoStack.value.length === 0) return;
    const prevState = undoStack.value.pop();
    if (!prevState) return;

    // Save current state to redo stack before reverting
    const currentAnnotations = annotations.value || []; // Handle potential undefined
    redoStack.value.push({
      annotations: currentAnnotations.map((a) => ({ ...a })), // Clone current state
      selectedIds: new Set(selectedIds.value),
    });

    // Check for newly created annotations that are being removed by this undo
    // and remove them from the imageStore
    const imageStore = useImage();
    const currentIds = new Set(currentAnnotations.map((a) => a.id));
    const prevIds = new Set(prevState.annotations.map((a) => a.id));

    // Find IDs that exist in current but not in previous state (being removed by undo)
    const removedIds = [...currentIds].filter((id) => !prevIds.has(id));

    if (removedIds.length > 0) {
      console.log(
        '[History] Removing annotations from store on undo:',
        removedIds,
      );

      // Remove from detectionsToAdd array (backend persistence queue)
      imageStore.detectionsToAdd = imageStore.detectionsToAdd.filter(
        (detection: DetectionState) => !removedIds.includes(detection.id),
      );

      // ALSO remove from the main detections array (UI state)
      imageStore.detections = imageStore.detections.filter(
        (detection: DetectionState) => !removedIds.includes(detection.id),
      );

      console.log(
        '[History] Removed undone annotations from both store arrays',
      );
    }

    // Restore previous state
    annotations.value = prevState.annotations;
    selectedIds.value = prevState.selectedIds;
    console.log(
      '[History] Undo performed. Undo:',
      undoStack.value.length,
      'Redo:',
      redoStack.value.length,
    );
  }

  /** Restores the next state from the redo stack. */
  function redo() {
    if (redoStack.value.length === 0) return;
    const nextState = redoStack.value.pop();
    if (!nextState) return;

    // Save current state to undo stack before restoring
    const currentAnnotations = annotations.value || []; // Handle potential undefined
    undoStack.value.push({
      annotations: currentAnnotations.map((a) => ({ ...a })), // Clone current state
      selectedIds: new Set(selectedIds.value),
    });

    // Check for annotations that will be added by this redo operation
    const imageStore = useImage();
    const currentIds = new Set(currentAnnotations.map((a) => a.id));
    const nextIds = new Set(nextState.annotations.map((a) => a.id));

    // Find IDs that exist in next state but not in current (being added by redo)
    const addedIds = [...nextIds].filter((id) => !currentIds.has(id));

    if (addedIds.length > 0) {
      console.log(
        '[History] Potentially adding annotations back on redo:',
        addedIds,
      );
      // Find the annotations in the next state that need to be re-added to the store
      const annotationsToAdd = nextState.annotations.filter((a) =>
        addedIds.includes(a.id),
      );

      // Add these back to both store arrays if they're not already there
      annotationsToAdd.forEach((annotation) => {
        // Add to detectionsToAdd for backend persistence
        if (!imageStore.detectionsToAdd.some((d) => d.id === annotation.id)) {
          console.log(
            '[History] Re-adding annotation to detectionsToAdd on redo:',
            annotation.id,
          );
          imageStore.detectionsToAdd.push({
            ...annotation,
            image_id: annotation.image_id,
            bbox: objectToBbox(
              annotation.x,
              annotation.y,
              annotation.width,
              annotation.height,
            ),
            created_date: annotation.created_date || new Date().toISOString(),
            last_change: new Date().toISOString(),
            last_access: new Date().toISOString(),
            deleted: false,
            loadingMetaRoles: false,
          });
        }

        // Also add to main detections array for UI state
        if (!imageStore.detections.some((d) => d.id === annotation.id)) {
          console.log(
            '[History] Re-adding annotation to detections on redo:',
            annotation.id,
          );
          imageStore.detections.push({
            ...annotation,
            image_id: annotation.image_id,
            bbox: objectToBbox(
              annotation.x,
              annotation.y,
              annotation.width,
              annotation.height,
            ),
            created_date: annotation.created_date || new Date().toISOString(),
            last_change: new Date().toISOString(),
            last_access: new Date().toISOString(),
            deleted: false,
            loadingMetaRoles: false,
          });
        }
      });

      console.log('[History] Re-added annotations to both store arrays');
    }

    // Restore next state
    annotations.value = nextState.annotations;
    selectedIds.value = nextState.selectedIds;
    console.log(
      '[History] Redo performed. Undo:',
      undoStack.value.length,
      'Redo:',
      redoStack.value.length,
    );
  }

  return { undoStack, redoStack, saveState, undo, redo };
}

// --- Annotation Normalization (Helper Composable) --- //
/**
 * Provides utility to normalize annotation dimensions (e.g., handle negative width/height).
 */
function useAnnotationNormalization(
  imageCanvas: ReturnType<typeof useImageCanvas>,
) {
  function normalizeAnnotation(annotation: DetectionState): DetectionState {
    let { x, y, width, height } = annotation;
    if (width < 0) {
      x += width;
      width = Math.abs(width);
    }
    if (height < 0) {
      y += height;
      height = Math.abs(height);
    }
    width = Math.max(width, 5); // Min width
    height = Math.max(height, 5); // Min height

    // Constrain to image bounds
    if (imageCanvas.dimensions.value) {
      const { originalWidth: imgW, originalHeight: imgH } =
        imageCanvas.dimensions.value;
      // Adjust position first if needed to keep it within bounds
      x = Math.max(0, Math.min(x, imgW));
      y = Math.max(0, Math.min(y, imgH));
      // Adjust dimensions based on clamped position
      width = Math.min(width, imgW - x);
      height = Math.min(height, imgH - y);
    }

    return { ...annotation, x, y, width, height };
  }
  return { normalizeAnnotation };
}

// --- Main Annotations Composable --- //

/**
 * @composable useAnnotations
 * Manages the state and operations related to annotations within the ImageAnnotator,
 * including creation, modification, deletion, selection, and undo/redo history.
 * It interacts with the global imageStore for persistence and external state synchronization.
 * @param {ReturnType<typeof useImageCanvas>} imageCanvas - Composable for canvas interactions.
 */
export function useAnnotations(imageCanvas: ReturnType<typeof useImageCanvas>) {
  // --- Dependencies --- //
  const imageStore = useImage();
  const { normalizeAnnotation } = useAnnotationNormalization(imageCanvas);

  // --- State --- //
  const annotations = ref<DetectionState[]>([]); // Local list of annotations being edited
  const isCreating = ref(false); // Flag for active annotation creation
  const creatingAnnotation = ref<DetectionState | null>(null); // Temp annotation during creation
  const startPoint = reactive({ x: 0, y: 0 }); // Start point for drag-creation
  const pendingMetaAnnotationId = ref<string | null>(null); // ID of annotation awaiting metadata
  const selectedIds = ref<Set<string>>(new Set()); // IDs of selected annotations (Integrated)

  // History State (Undo/Redo)
  const { undoStack, redoStack, saveState, undo, redo } = useHistoryManagement(
    annotations,
    selectedIds,
  );

  // --- Computed Properties --- //
  const hasSelection = computed(() => selectedIds.value.size > 0);
  const selectedAnnotations = computed(() =>
    annotations.value.filter((a) => selectedIds.value.has(a.id)),
  );
  const annotationsForSave = computed(() => {
    // Store handles deletions, just return current local annotations
    return { annotations: annotations.value };
  });

  // --- Selection Logic (Integrated) --- //

  function clearPendingMeta() {
    if (pendingMetaAnnotationId.value) {
      console.log(
        '[Annotations] Clearing pending meta for ID:',
        pendingMetaAnnotationId.value,
      );
      pendingMetaAnnotationId.value = null;
    }
  }

  function selectAnnotation(id: string, addToSelection = false) {
    clearPendingMeta();
    if (!id) return;
    const alreadySelected = selectedIds.value.has(id);

    if (addToSelection) {
      alreadySelected
        ? selectedIds.value.delete(id)
        : selectedIds.value.add(id);
    } else {
      if (selectedIds.value.size === 1 && alreadySelected) return; // No change needed
      selectedIds.value.clear();
      selectedIds.value.add(id);
    }

    const storeId = selectedIds.value.size === 1 ? id : null;
    if (imageStore.selectedDetectionId !== storeId) {
      imageStore.selectDetection(storeId);
    }
    console.log(
      '[Annotations] Selection updated:',
      Array.from(selectedIds.value),
    );
  }

  function deselectAll() {
    clearPendingMeta();
    if (selectedIds.value.size > 0) {
      selectedIds.value.clear();
      if (imageStore.selectedDetectionId !== null) {
        imageStore.selectDetection(null);
      }
      console.log('[Annotations] All annotations deselected');
    }
  }

  function isSelected(id: string): boolean {
    return selectedIds.value.has(id);
  }

  function syncSelectionWithStore(storeSelectedId: string | null) {
    const localSelectionArray = Array.from(selectedIds.value);
    if (!storeSelectedId) {
      if (localSelectionArray.length === 1) {
        selectedIds.value.clear();
        console.log(
          '[Annotations] Local selection cleared due to store (null).',
        );
      }
    } else {
      if (
        localSelectionArray.length !== 1 ||
        localSelectionArray[0] !== storeSelectedId
      ) {
        selectedIds.value.clear();
        selectedIds.value.add(storeSelectedId);
        console.log(
          `[Annotations] Local selection synced to store: ${storeSelectedId}`,
        );
      }
    }
  }

  watch(() => imageStore.selectedDetectionId, syncSelectionWithStore);

  // --- Annotation CRUD & Actions --- //

  function startCreate(startPos: Vector2d, imageId: string) {
    if (isCreating.value) return;
    console.log('[Annotations] Start creating annotation at:', startPos);
    deselectAll(); // Deselect others when starting to draw a new one
    startPoint.x = startPos.x;
    startPoint.y = startPos.y;

    const newAnnotation = newDetectionState();
    newAnnotation.id = uuidv4();
    newAnnotation.image_id = imageId;
    newAnnotation.x = startPos.x;
    newAnnotation.y = startPos.y;
    newAnnotation.width = 0;
    newAnnotation.height = 0;
    newAnnotation.created_date = new Date().toISOString();
    newAnnotation.confidence = 1.0;
    newAnnotation.edited = true;
    newAnnotation.annotated = true;
    newAnnotation.computed_type = '';
    newAnnotation.computed_color = '#ff0000';
    newAnnotation.computed_display_type = '';

    saveState(); // Save state *before* adding

    creatingAnnotation.value = newAnnotation;
    isCreating.value = true;
    annotations.value.push(newAnnotation); // Add to local list immediately
  }

  function updateCreating(currentPos: Vector2d) {
    if (!isCreating.value || !creatingAnnotation.value) return;
    const annotation = creatingAnnotation.value;
    annotation.width = currentPos.x - startPoint.x;
    annotation.height = currentPos.y - startPoint.y;
  }

  function finishCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;
    console.log('[Annotations] Finish creating annotation');
    const annotation = creatingAnnotation.value;
    const normalized = normalizeAnnotation(annotation);
    Object.assign(annotation, normalized);

    isCreating.value = false;
    creatingAnnotation.value = null;

    selectAnnotation(annotation.id, false); // Select the new annotation

    console.log('[Annotations] Created annotation:', annotation);
    pendingMetaAnnotationId.value = annotation.id;
    console.log('[Annotations] Awaiting metadata for:', annotation.id);
  }

  function cancelCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;
    console.log('[Annotations] Cancelling annotation creation');
    const id = creatingAnnotation.value.id;

    // Remove from local annotations
    annotations.value = annotations.value.filter((a) => a.id !== id);

    // Remove from both imageStore arrays if it exists there
    const imageStore = useImage();

    // Remove from detectionsToAdd (backend persistence queue)
    const detectionInToAdd = imageStore.detectionsToAdd.find(
      (d) => d.id === id,
    );
    if (detectionInToAdd) {
      console.log(
        '[Annotations] Removing cancelled annotation from detectionsToAdd:',
        id,
      );
      imageStore.detectionsToAdd = imageStore.detectionsToAdd.filter(
        (detection) => detection.id !== id,
      );
    }

    // Also remove from main detections array (UI state)
    const detectionInMain = imageStore.detections.find((d) => d.id === id);
    if (detectionInMain) {
      console.log(
        '[Annotations] Removing cancelled annotation from detections array:',
        id,
      );
      imageStore.detections = imageStore.detections.filter(
        (detection) => detection.id !== id,
      );
    }

    isCreating.value = false;
    creatingAnnotation.value = null;
    // Revert the history state saved in startCreate
    if (undoStack.value.length > 0) undo();
  }

  function moveAnnotation(id: string, delta: Vector2d) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;
    saveState(); // Save state before move for undo
    annotation.x += delta.x;
    annotation.y += delta.y;
    annotation.edited = true;
    console.log(`[Annotations] Moved annotation ${id}`);
  }

  function updateAnnotationDimensions(
    id: string,
    newDimensions: { x: number; y: number; width: number; height: number },
  ) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;
    saveState(); // Save state before resize for undo
    Object.assign(annotation, newDimensions);
    annotation.edited = true;
    const normalized = normalizeAnnotation(annotation);
    Object.assign(annotation, normalized);

    // Update the corresponding detection in the store if it exists
    const imageStore = useImage();
    const storeIndex = imageStore.detections.findIndex((d) => d.id === id);
    if (storeIndex !== -1) {
      // Update with normalized dimensions and ensure bbox is updated
      const { x, y, width, height } = normalized;
      Object.assign(imageStore.detections[storeIndex], {
        x,
        y,
        width,
        height,
        edited: true,
        bbox: objectToBbox(x, y, width, height),
        last_change: new Date().toISOString(),
      });
    }

    console.log(`[Annotations] Updated dimensions for annotation ${id}`);
  }

  function deleteSelected() {
    if (selectedIds.value.size === 0) return;
    console.log(
      '[Annotations] Deleting selected:',
      Array.from(selectedIds.value),
    );
    if (
      pendingMetaAnnotationId.value &&
      selectedIds.value.has(pendingMetaAnnotationId.value)
    ) {
      cancelAnnotationMeta();
      if (selectedIds.value.size === 0) return;
    }
    saveState(); // Save state before deletion for undo
    const idsToDelete = new Set(selectedIds.value);
    annotations.value = annotations.value.filter((a) => !idsToDelete.has(a.id));
    idsToDelete.forEach((id) => {
      imageStore.deleteDetection(id);
    });
    selectedIds.value.clear();
    console.log('[Annotations] Deleted locally and queued in store.');
  }

  function loadAnnotations(loadedAnnotations: DetectionState[]) {
    console.log(
      `[Annotations] Loading ${loadedAnnotations.length} annotations...`,
    );
    if (
      annotations.value.length > 0 ||
      undoStack.value.length > 0 ||
      redoStack.value.length > 0
    ) {
      // Only save state if there's something to save or history exists
      saveState();
    }
    // Ensure deep clone to prevent reactivity issues across states/history
    annotations.value = loadedAnnotations.map((a) => reactive({ ...a }));
    selectedIds.value.clear(); // Clear local selection
    isCreating.value = false;
    creatingAnnotation.value = null;
    pendingMetaAnnotationId.value = null;
    // History might need reset depending on desired behavior when loading new image
    // undoStack.value = [];
    // redoStack.value = [];
    console.log(
      `[Annotations] Loaded ${annotations.value.length} annotations.`,
    );
  }

  // --- Metadata Input Handling --- //

  function confirmAnnotationMeta(metaRole: string | null, value: string) {
    if (!pendingMetaAnnotationId.value) return;
    const annotation = annotations.value.find(
      (a) => a.id === pendingMetaAnnotationId.value,
    );
    if (annotation) {
      console.log(
        `[Annotations] Confirming meta for ${annotation.id}: Role=${metaRole}, Value=${value}`,
      );
      saveState(); // Save state before applying meta for undo
      annotation.value = value;
      annotation.edited = true;
      // computed_type/display_type are set in ImageAnnotator
    } else {
      console.error(
        '[Annotations] Could not find annotation to confirm meta for ID:',
        pendingMetaAnnotationId.value,
      );
    }
    pendingMetaAnnotationId.value = null;
  }

  function cancelAnnotationMeta() {
    if (!pendingMetaAnnotationId.value) return;
    const idToRemove = pendingMetaAnnotationId.value;
    console.log('[Annotations] Cancelling meta input for ID:', idToRemove);

    // Remove from local annotations
    annotations.value = annotations.value.filter((a) => a.id !== idToRemove);

    // Remove from both imageStore arrays

    // Remove from detectionsToAdd array (backend persistence queue)
    const detectionInToAdd = imageStore.detectionsToAdd.find(
      (d) => d.id === idToRemove,
    );
    if (detectionInToAdd) {
      console.log(
        '[Annotations] Removing cancelled annotation from detectionsToAdd:',
        idToRemove,
      );
      imageStore.detectionsToAdd = imageStore.detectionsToAdd.filter(
        (detection) => detection.id !== idToRemove,
      );
    }

    // Also remove from main detections array (UI state)
    const detectionInMain = imageStore.detections.find(
      (d) => d.id === idToRemove,
    );
    if (detectionInMain) {
      console.log(
        '[Annotations] Removing cancelled annotation from detections array:',
        idToRemove,
      );
      imageStore.detections = imageStore.detections.filter(
        (detection) => detection.id !== idToRemove,
      );
    }

    // Revert the startCreate history entry
    if (undoStack.value.length > 0) undo();
    pendingMetaAnnotationId.value = null;
    if (selectedIds.value.has(idToRemove)) {
      selectedIds.value.delete(idToRemove);
    }
  }

  // --- Provide / Inject --- //
  provide('annotations', annotations);
  provide('selectedIds', selectedIds);

  // --- Returned State and Methods --- //
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
    annotationsForSave,
    // Methods
    startCreate,
    updateCreating,
    finishCreate,
    cancelCreate,
    selectAnnotation,
    deselectAll,
    isSelected,
    syncSelectionWithStore,
    moveAnnotation,
    updateAnnotationDimensions,
    deleteSelected,
    saveState, // Expose for Konva event handlers to save before move/transform
    undo,
    redo,
    loadAnnotations,
    confirmAnnotationMeta,
    cancelAnnotationMeta,
  };
}

// --- Context Injection Hook --- //

/** Provides access to the annotation context (local annotations and selected IDs). */
export function useAnnotationContext() {
  const annotations =
    inject<ReturnType<typeof ref<DetectionState[]>>>('annotations');
  const selectedIds =
    inject<ReturnType<typeof ref<Set<string>>>>('selectedIds');
  if (!annotations || !selectedIds) {
    throw new Error(
      'useAnnotationContext must be used within an AnnotationProvider component context',
    );
  }
  return { annotations, selectedIds };
}
