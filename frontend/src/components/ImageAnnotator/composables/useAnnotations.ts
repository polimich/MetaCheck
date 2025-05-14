/* eslint-disable @typescript-eslint/no-unused-vars */
// @author Michael Polívka (xpoliv07)
import { ref, computed, reactive, provide, inject, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Vector2d } from 'konva/lib/types';
import { DetectionState, newDetectionState } from 'src/types';
import { useImageCanvas } from './useImageCanvas';
import { useImage } from 'src/stores/data/useImage';
import { useCollection } from 'src/stores/data/useCollection';
import { DetectionType } from 'src/stores/data/types';
import { useHistoryManagement } from './useHistoryManagement';

// Helper function to convert coordinates to bbox string
function objectToBbox(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return `${x},${y},${width},${height}`;
}

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
      x = Math.max(0, Math.min(x, imgW));
      y = Math.max(0, Math.min(y, imgH));
      width = Math.min(width, imgW - x);
      height = Math.min(height, imgH - y);
    }

    return { ...annotation, x, y, width, height };
  }
  return { normalizeAnnotation };
}

/**
 * Manages the state and operations related to annotations within the ImageAnnotator,
 * including creation, modification, deletion, selection, and undo/redo history.
 * It interacts with the global imageStore for persistence and external state synchronization.
 * @param {ReturnType<typeof useImageCanvas>} imageCanvas - Composable for canvas interactions.
 */
export function useAnnotations(imageCanvas: ReturnType<typeof useImageCanvas>) {
  // --- Dependencies --- //
  const imageStore = useImage();
  const collectionStore = useCollection();
  const { normalizeAnnotation } = useAnnotationNormalization(imageCanvas);

  // --- State --- //
  const annotations = ref<DetectionState[]>([]);
  const isCreating = ref(false);
  const creatingAnnotation = ref<DetectionState | null>(null);
  const startPoint = reactive({ x: 0, y: 0 });
  const pendingMetaAnnotationId = ref<string | null>(null);
  const selectedIds = ref<Set<string>>(new Set());

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
    return { annotations: annotations.value };
  });

  // --- Selection Logic --- //

  function clearPendingMeta() {
    if (pendingMetaAnnotationId.value) {
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
      if (selectedIds.value.size === 1 && alreadySelected) return;
      selectedIds.value.clear();
      selectedIds.value.add(id);
    }

    const storeId = selectedIds.value.size === 1 ? id : null;
    if (imageStore.selectedDetectionId !== storeId) {
      imageStore.selectDetection(storeId);
    }
  }

  function deselectAll() {
    clearPendingMeta();
    if (selectedIds.value.size > 0) {
      selectedIds.value.clear();
      if (imageStore.selectedDetectionId !== null) {
        imageStore.selectDetection(null);
      }
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
      }
    } else {
      if (
        localSelectionArray.length !== 1 ||
        localSelectionArray[0] !== storeSelectedId
      ) {
        selectedIds.value.clear();
        selectedIds.value.add(storeSelectedId);
      }
    }
  }

  watch(() => imageStore.selectedDetectionId, syncSelectionWithStore);

  // --- Annotation CRUD & Actions --- //

  function startCreate(startPos: Vector2d, imageId: string) {
    if (isCreating.value) return;
    deselectAll();
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
    newAnnotation.annotated = true;
    newAnnotation.computed_type = '';
    newAnnotation.computed_color = '#ff0000';
    newAnnotation.computed_display_type = '';

    saveState(); // Save state *before* adding

    creatingAnnotation.value = newAnnotation;
    isCreating.value = true;
    annotations.value.push(newAnnotation);
  }

  function updateCreating(currentPos: Vector2d) {
    if (!isCreating.value || !creatingAnnotation.value) return;
    const annotation = creatingAnnotation.value;
    annotation.width = currentPos.x - startPoint.x;
    annotation.height = currentPos.y - startPoint.y;
  }

  function finishCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;
    const annotation = creatingAnnotation.value;
    const normalized = normalizeAnnotation(annotation);
    Object.assign(annotation, normalized);

    isCreating.value = false;
    creatingAnnotation.value = null;

    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    if (currentImageId && imageLocation) {
      const newDetection: DetectionType = {
        id: annotation.id,
        image_id: currentImageId,
        bbox: objectToBbox(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height,
        ),
        value: annotation.value || '',
        confidence: annotation.confidence || 1.0,
        annotated: annotation.annotated || false,
        computed_color: annotation.computed_color || '#ff0000',
        computed_type: annotation.computed_type || '',
        computed_display_type: annotation.computed_display_type || '',
        created_date: annotation.created_date || new Date().toISOString(),
        last_change: new Date().toISOString(),
        last_access: new Date().toISOString(),
        deleted: false,
      };

      collectionStore.addDetectionToImage(
        currentImageId,
        newDetection,
        imageLocation,
      );

      if (
        !imageStore.detectionsToAdd.some(
          (d: DetectionType) => d.id === annotation.id,
        )
      ) {
        imageStore.detectionsToAdd.push({
          ...newDetection,
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          edited: true,
          loadingMetaRoles: false,
        });
      }
    }

    selectAnnotation(annotation.id, false);
    pendingMetaAnnotationId.value = annotation.id;
  }

  function cancelCreate() {
    if (!isCreating.value || !creatingAnnotation.value) return;
    const id = creatingAnnotation.value.id;

    annotations.value = annotations.value.filter((a) => a.id !== id);

    const imageStore = useImage();

    const detectionInToAdd = imageStore.detectionsToAdd.find(
      (d: DetectionType) => d.id === id,
    );
    if (detectionInToAdd) {
      imageStore.detectionsToAdd = imageStore.detectionsToAdd.filter(
        (detection: DetectionType) => detection.id !== id,
      );
    }

    const detectionInMain = imageStore.detections.find(
      (d: DetectionType) => d.id === id,
    );
    if (detectionInMain) {
      if (!imageStore.detectionsToDelete.includes(id)) {
        imageStore.detectionsToDelete.push(id);
      }
    }

    isCreating.value = false;
    creatingAnnotation.value = null;
    if (undoStack.value.length > 0) undo();
  }

  function moveAnnotation(id: string, delta: Vector2d) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;
    saveState();

    annotation.x += delta.x;
    annotation.y += delta.y;

    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    if (currentImageId && imageLocation) {
      const detectionUpdate: Partial<DetectionType> = {
        bbox: objectToBbox(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height,
        ),
        last_change: new Date().toISOString(),
      };

      collectionStore.modifyDetectionInImage(
        currentImageId,
        id,
        detectionUpdate,
        imageLocation,
      );
    }

    const storeIndex = imageStore.detections.findIndex(
      (d: DetectionType) => d.id === id,
    );

    if (storeIndex !== -1) {
      Object.assign(imageStore.detections[storeIndex], {
        x: annotation.x,
        y: annotation.y,
        bbox: objectToBbox(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height,
        ),
        last_change: new Date().toISOString(),
        edited: true,
      });
    } else {
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          bbox: objectToBbox(
            annotation.x,
            annotation.y,
            annotation.width,
            annotation.height,
          ),
          last_change: new Date().toISOString(),
        });
      }
    }
  }

  function updateAnnotationDimensions(
    id: string,
    newDimensions: { x: number; y: number; width: number; height: number },
  ) {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return;
    saveState();
    Object.assign(annotation, newDimensions);
    const normalized = normalizeAnnotation(annotation);
    Object.assign(annotation, normalized);

    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    if (currentImageId && imageLocation) {
      const { x, y, width, height } = normalized;
      const detectionUpdate: Partial<DetectionType> = {
        bbox: objectToBbox(x, y, width, height),
        last_change: new Date().toISOString(),
      };

      collectionStore.modifyDetectionInImage(
        currentImageId,
        id,
        detectionUpdate,
        imageLocation,
      );
    }

    const storeIndex = imageStore.detections.findIndex(
      (d: DetectionType) => d.id === id,
    );
    if (storeIndex !== -1) {
      const { x, y, width, height } = normalized;
      Object.assign(imageStore.detections[storeIndex], {
        x,
        y,
        width,
        height,
        bbox: objectToBbox(x, y, width, height),
        last_change: new Date().toISOString(),
        edited: true,
      });
    } else {
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        const { x, y, width, height } = normalized;
        Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
          x,
          y,
          width,
          height,
          bbox: objectToBbox(x, y, width, height),
          last_change: new Date().toISOString(),
        });
      }
    }
  }

  function deleteSelected() {
    if (selectedIds.value.size === 0) return;
    if (
      pendingMetaAnnotationId.value &&
      selectedIds.value.has(pendingMetaAnnotationId.value)
    ) {
      cancelAnnotationMeta();
      if (selectedIds.value.size === 0) return;
    }
    saveState();
    const idsToDelete = new Set(selectedIds.value);

    annotations.value = annotations.value.filter((a) => !idsToDelete.has(a.id));

    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    if (!currentImageId) {
      console.warn(
        '[Annotations] No current image ID, cannot delete detections in collection',
      );
    }

    idsToDelete.forEach((id) => {
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );
      if (indexInToAdd !== -1) {
        imageStore.detectionsToAdd.splice(indexInToAdd, 1);
      } else {
        if (currentImageId && imageLocation) {
          collectionStore.deleteDetectionFromImage(
            currentImageId,
            id,
            imageLocation,
          );
          if (!imageStore.detectionsToDelete.includes(id)) {
            imageStore.detectionsToDelete.push(id);
          }
        } else {
          if (!imageStore.detectionsToDelete.includes(id)) {
            imageStore.detectionsToDelete.push(id);
          }
        }
      }
    });

    selectedIds.value.clear();
  }

  function loadAnnotations(loadedAnnotations: DetectionState[]) {
    if (
      annotations.value.length > 0 ||
      undoStack.value.length > 0 ||
      redoStack.value.length > 0
    ) {
      saveState();
    }
    annotations.value = loadedAnnotations.map((a) => reactive({ ...a }));
    selectedIds.value.clear();
    isCreating.value = false;
    creatingAnnotation.value = null;
    pendingMetaAnnotationId.value = null;
  }

  // --- Metadata Input Handling --- //

  function confirmAnnotationMeta(metaRole: string | null, value: string) {
    if (!pendingMetaAnnotationId.value) return;
    const annotation = annotations.value.find(
      (a) => a.id === pendingMetaAnnotationId.value,
    );
    if (annotation) {
      saveState();
      annotation.value = value;
      if (metaRole) {
        annotation.computed_type = metaRole;
        annotation.computed_display_type = metaRole;
      }

      const currentImageId = imageStore.image?.id;
      const selectedImageData = collectionStore.selectedImage;
      const imageLocation = selectedImageData?.location;

      const storeIndex = imageStore.detections.findIndex(
        (d: DetectionType) => d.id === annotation.id,
      );

      if (storeIndex !== -1) {
        Object.assign(imageStore.detections[storeIndex], {
          value: value,
          computed_type: annotation.computed_type || '',
          computed_display_type: annotation.computed_display_type || '',
          last_change: new Date().toISOString(),
          annotated: true,
          edited: true,
        });

        if (currentImageId && imageLocation) {
          const updatePayload: Partial<DetectionType> = {
            value: value,
            computed_type: annotation.computed_type || '',
            computed_display_type: annotation.computed_display_type || '',
            annotated: true,
            last_change: new Date().toISOString(),
          };

          collectionStore.modifyDetectionInImage(
            currentImageId,
            annotation.id,
            updatePayload,
            imageLocation,
          );
        }
      } else {
        const indexInToAdd = imageStore.detectionsToAdd.findIndex(
          (d: DetectionType) => d.id === annotation.id,
        );

        if (indexInToAdd !== -1) {
          Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
            value: value,
            computed_type: annotation.computed_type || '',
            computed_display_type: annotation.computed_display_type || '',
            last_change: new Date().toISOString(),
            annotated: true,
          });

          if (currentImageId && imageLocation) {
            collectionStore.addDetectionToImage(
              currentImageId,
              {
                ...imageStore.detectionsToAdd[indexInToAdd],
                bbox: objectToBbox(
                  annotation.x,
                  annotation.y,
                  annotation.width,
                  annotation.height,
                ),
              },
              imageLocation,
            );
          }
        } else {
          if (currentImageId) {
            const newDetection = {
              id: annotation.id,
              image_id: currentImageId,
              bbox: objectToBbox(
                annotation.x,
                annotation.y,
                annotation.width,
                annotation.height,
              ),
              value: value,
              confidence: annotation.confidence || 1.0,
              annotated: true,
              computed_color: annotation.computed_color || '#ff0000',
              computed_type: annotation.computed_type || '',
              computed_display_type: annotation.computed_display_type || '',
              created_date: annotation.created_date || new Date().toISOString(),
              last_change: new Date().toISOString(),
              last_access: new Date().toISOString(),
              deleted: false,
              x: annotation.x,
              y: annotation.y,
              width: annotation.width,
              height: annotation.height,
              edited: true,
              loadingMetaRoles: false,
            };

            imageStore.detectionsToAdd.push(newDetection);

            if (imageLocation) {
              collectionStore.addDetectionToImage(
                currentImageId,
                newDetection,
                imageLocation,
              );
            }
          }
        }
      }
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

    annotations.value = annotations.value.filter((a) => a.id !== idToRemove);

    const imageStore = useImage();

    const detectionInToAdd = imageStore.detectionsToAdd.find(
      (d: DetectionType) => d.id === idToRemove,
    );
    if (detectionInToAdd) {
      imageStore.detectionsToAdd = imageStore.detectionsToAdd.filter(
        (detection: DetectionType) => detection.id !== idToRemove,
      );
    }

    if (imageStore.detections.some((d: DetectionType) => d.id === idToRemove)) {
      if (!imageStore.detectionsToDelete.includes(idToRemove)) {
        imageStore.detectionsToDelete.push(idToRemove);
      }
    }

    if (undoStack.value.length > 0) undo();
    pendingMetaAnnotationId.value = null;
    if (selectedIds.value.has(idToRemove)) {
      selectedIds.value.delete(idToRemove);
    }
  }

  // --- Saving Implementation --- //

  /**
   * Prepares changes for saving by comparing local annotations to store detections
   * and organizing them into add, modify, and delete categories.
   */
  function prepareChangesForSave() {
    const imageStore = useImage();

    const localAnnotationMap = new Map(
      annotations.value.map((annotation) => [annotation.id, annotation]),
    );
    const storeDetectionMap = new Map(
      imageStore.detections.map((detection) => [detection.id, detection]),
    );

    const localIds = new Set(localAnnotationMap.keys());
    const storeIds = new Set(storeDetectionMap.keys());

    const annotationsToAdd = Array.from(localIds)
      .filter((id) => !storeIds.has(id))
      .map((id) => localAnnotationMap.get(id))
      .filter((ann): ann is DetectionState => ann !== undefined);

    const annotationsToDelete = Array.from(storeIds).filter(
      (id) => !localIds.has(id),
    );

    const annotationsToModify = Array.from(localIds)
      .filter((id) => storeIds.has(id))
      .map((id) => {
        const localAnnotation = localAnnotationMap.get(id);
        const storeDetection = storeDetectionMap.get(id);

        if (!localAnnotation || !storeDetection) return null;

        const hasPositionChanged =
          localAnnotation.x !== storeDetection.x ||
          localAnnotation.y !== storeDetection.y ||
          localAnnotation.width !== storeDetection.width ||
          localAnnotation.height !== storeDetection.height;

        const hasMetadataChanged =
          localAnnotation.value !== storeDetection.value ||
          localAnnotation.computed_type !== storeDetection.computed_type ||
          localAnnotation.computed_color !== storeDetection.computed_color ||
          localAnnotation.computed_display_type !==
            storeDetection.computed_display_type ||
          localAnnotation.annotated !== storeDetection.annotated ||
          localAnnotation.confidence !== storeDetection.confidence;

        if (hasPositionChanged || hasMetadataChanged) {
          return localAnnotation;
        }

        return null;
      })
      .filter((ann): ann is DetectionState => ann !== null);

    return {
      annotationsToAdd,
      annotationsToModify,
      annotationsToDelete,
    };
  }

  /**
   * Processes the changes identified by prepareChangesForSave.
   */
  function processChanges(changes: {
    annotationsToAdd: DetectionState[];
    annotationsToModify: DetectionState[];
    annotationsToDelete: string[];
  }) {
    processAdditions();
    processModifications();
    processDeletions();

    return { success: true };
  }

  /**
   * Placeholder for processing annotations to add
   */
  function processAdditions() {
    // External implementation will handle this
  }

  /**
   * Placeholder for processing annotations to modify
   */
  function processModifications() {
    // External implementation will handle this
  }

  /**
   * Placeholder for processing annotations to delete
   */
  function processDeletions() {
    // External implementation will handle this
  }

  /**
   * Main function to save changes to annotations.
   * Compares local state with store and prepares changes for processing.
   */
  function saveChanges() {
    const changes = prepareChangesForSave();

    const totalChanges =
      changes.annotationsToAdd.length +
      changes.annotationsToModify.length +
      changes.annotationsToDelete.length;

    if (totalChanges === 0) {
      return { success: true, message: 'No changes to save' };
    }

    return processChanges(changes);
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
    saveState,
    undo,
    redo,
    loadAnnotations,
    confirmAnnotationMeta,
    cancelAnnotationMeta,
    saveChanges,
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
