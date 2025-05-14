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
  const collectionStore = useCollection();
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

    // Also add to collection store if we have the required info
    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    if (currentImageId && imageLocation) {
      // Create a detection object from our annotation
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

      // Add to collection structure
      const added = collectionStore.addDetectionToImage(
        currentImageId,
        newDetection,
        imageLocation,
      );

      if (added) {
        console.log(
          `[Annotations] Detection ${annotation.id} added to collection structure`,
        );
      }

      // Also add to detectionsToAdd for backend persistence
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

        console.log(
          `[Annotations] Added detection ${annotation.id} to detectionsToAdd`,
        );
      }
    }

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

    // Remove from imageStore arrays if it exists there
    const imageStore = useImage();

    // Remove from detectionsToAdd (backend persistence queue)
    const detectionInToAdd = imageStore.detectionsToAdd.find(
      (d: DetectionType) => d.id === id,
    );
    if (detectionInToAdd) {
      console.log(
        '[Annotations] Removing cancelled annotation from detectionsToAdd:',
        id,
      );
      imageStore.detectionsToAdd = imageStore.detectionsToAdd.filter(
        (detection: DetectionType) => detection.id !== id,
      );
    }

    // Check if detection exists in the main detections
    const detectionInMain = imageStore.detections.find(
      (d: DetectionType) => d.id === id,
    );
    if (detectionInMain) {
      console.log(
        '[Annotations] Adding to detectionsToDelete for cancelled annotation:',
        id,
      );
      // Add to delete list instead of modifying detections directly
      if (!imageStore.detectionsToDelete.includes(id)) {
        imageStore.detectionsToDelete.push(id);
      }
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

    // Update local annotation position
    annotation.x += delta.x;
    annotation.y += delta.y;

    // Get current image info
    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    // Update in collection if possible
    if (currentImageId && imageLocation) {
      // Create a proper detection update object with updated bbox
      const detectionUpdate: Partial<DetectionType> = {
        bbox: objectToBbox(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height,
        ),
        last_change: new Date().toISOString(),
      };

      // Update in collection structure
      const updated = collectionStore.modifyDetectionInImage(
        currentImageId,
        id,
        detectionUpdate,
        imageLocation,
      );

      if (updated) {
        console.log(
          `[Annotations] Updated moved detection ${id} in collection structure`,
        );
      }
    }

    // Update the corresponding detection in the store if it exists
    const storeIndex = imageStore.detections.findIndex(
      (d: DetectionType) => d.id === id,
    );

    if (storeIndex !== -1) {
      // Update position and bbox, and mark as edited
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
        edited: true, // Mark as edited to ensure it gets saved
      });

      console.log(`[Annotations] Updated detection ${id} in store after move`);
    } else {
      // Check if it's a new annotation that needs to be added to detectionsToAdd
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        // Update in detectionsToAdd
        Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
          x: annotation.x,
          y: annotation.y,
          bbox: objectToBbox(
            annotation.x,
            annotation.y,
            annotation.width,
            annotation.height,
          ),
          last_change: new Date().toISOString(),
        });

        console.log(
          `[Annotations] Updated moved detection ${id} in detectionsToAdd`,
        );
      }
    }

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
    const normalized = normalizeAnnotation(annotation);
    Object.assign(annotation, normalized);

    // Get current image info
    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    // Update in collection if possible
    if (currentImageId && imageLocation) {
      const { x, y, width, height } = normalized;
      // Create a proper detection update object
      const detectionUpdate: Partial<DetectionType> = {
        bbox: objectToBbox(x, y, width, height),
        last_change: new Date().toISOString(),
      };

      const updated = collectionStore.modifyDetectionInImage(
        currentImageId,
        id,
        detectionUpdate,
        imageLocation,
      );

      if (updated) {
        console.log(
          `[Annotations] Updated detection ${id} in collection structure`,
        );
      }
    }

    // Update the corresponding detection in the store if it exists
    const storeIndex = imageStore.detections.findIndex(
      (d: DetectionType) => d.id === id,
    );
    if (storeIndex !== -1) {
      // Update with normalized dimensions and ensure bbox is updated
      const { x, y, width, height } = normalized;
      Object.assign(imageStore.detections[storeIndex], {
        x,
        y,
        width,
        height,
        bbox: objectToBbox(x, y, width, height),
        last_change: new Date().toISOString(),
        edited: true, // Mark as edited to ensure it gets saved
      });

      console.log(
        `[Annotations] Updated detection ${id} in imageStore and marked as edited`,
      );
    } else {
      // If not in main detections array, check if it's a new detection in detectionsToAdd
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        // Update in detectionsToAdd
        const { x, y, width, height } = normalized;
        Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
          x,
          y,
          width,
          height,
          bbox: objectToBbox(x, y, width, height),
          last_change: new Date().toISOString(),
        });

        console.log(
          `[Annotations] Updated dimensions for detection ${id} in detectionsToAdd`,
        );
      }
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

    // Remove from local annotations first
    annotations.value = annotations.value.filter((a) => !idsToDelete.has(a.id));

    // Get current image and its location
    const currentImageId = imageStore.image?.id;
    const selectedImageData = collectionStore.selectedImage;
    const imageLocation = selectedImageData?.location;

    if (!currentImageId) {
      console.warn(
        '[Annotations] No current image ID, cannot delete detections in collection',
      );
    }

    // For each ID to delete, either:
    // 1. Remove from detectionsToAdd if it's a new annotation not yet saved
    // 2. Add to detectionsToDelete if it's an existing annotation
    // 3. Update the collection store directly if we have the image location
    idsToDelete.forEach((id) => {
      // Check if it's in detectionsToAdd first (not yet saved to backend)
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );
      if (indexInToAdd !== -1) {
        // Remove from detectionsToAdd if it's a new annotation
        console.log(
          `[Annotations] Removing unsaved annotation ${id} from detectionsToAdd`,
        );
        imageStore.detectionsToAdd.splice(indexInToAdd, 1);
      } else {
        // First, update the collection store if we have an image ID and location
        if (currentImageId && imageLocation) {
          // Try to delete directly in the collection structure
          const deleted = collectionStore.deleteDetectionFromImage(
            currentImageId,
            id,
            imageLocation,
          );

          if (deleted) {
            console.log(
              `[Annotations] Detection ${id} directly deleted in collection structure`,
            );
            // IMPORTANT: Add to imageStore.detectionsToDelete regardless of successful local deletion
            // This ensures the backend API call will be made to actually delete from database
            if (!imageStore.detectionsToDelete.includes(id)) {
              console.log(
                `[Annotations] Adding ${id} to detectionsToDelete for backend deletion`,
              );
              imageStore.detectionsToDelete.push(id);
            }
          } else {
            // Only call deleteDetection again if the first attempt failed
            console.log(
              `[Annotations] Direct deletion failed, adding to delete queue for ${id}`,
            );
            // Add to imageStore.detectionsToDelete for tracking and later deletion
            if (!imageStore.detectionsToDelete.includes(id)) {
              imageStore.detectionsToDelete.push(id);
            }
          }
        } else {
          // No image location available, add to delete queue
          console.log(
            `[Annotations] No image location, adding to delete queue for ${id}`,
          );
          if (!imageStore.detectionsToDelete.includes(id)) {
            imageStore.detectionsToDelete.push(id);
          }
        }
      }
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
      // Set computed_type/display_type if provided
      if (metaRole) {
        annotation.computed_type = metaRole;
        annotation.computed_display_type = metaRole;
      }

      // Get current image info
      const currentImageId = imageStore.image?.id;
      const selectedImageData = collectionStore.selectedImage;
      const imageLocation = selectedImageData?.location;

      // Update in image store
      // First check if it's in the main detections array
      const storeIndex = imageStore.detections.findIndex(
        (d: DetectionType) => d.id === annotation.id,
      );

      if (storeIndex !== -1) {
        // Update metadata and mark as edited
        Object.assign(imageStore.detections[storeIndex], {
          value: value,
          computed_type: annotation.computed_type || '',
          computed_display_type: annotation.computed_display_type || '',
          last_change: new Date().toISOString(),
          annotated: true,
          edited: true, // Mark as edited to ensure it gets saved
        });

        console.log(
          `[Annotations] Updated metadata for detection ${annotation.id} in store`,
        );

        // Also update in collection if possible
        if (currentImageId && imageLocation) {
          const updatePayload: Partial<DetectionType> = {
            value: value,
            computed_type: annotation.computed_type || '',
            computed_display_type: annotation.computed_display_type || '',
            annotated: true,
            last_change: new Date().toISOString(),
          };

          const updated = collectionStore.modifyDetectionInImage(
            currentImageId,
            annotation.id,
            updatePayload,
            imageLocation,
          );

          if (updated) {
            console.log(
              `[Annotations] Updated metadata in collection for detection ${annotation.id}`,
            );
          }
        }
      } else {
        // If not in main detections, check if it's in detectionsToAdd
        const indexInToAdd = imageStore.detectionsToAdd.findIndex(
          (d: DetectionType) => d.id === annotation.id,
        );

        if (indexInToAdd !== -1) {
          // Update in detectionsToAdd
          Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
            value: value,
            computed_type: annotation.computed_type || '',
            computed_display_type: annotation.computed_display_type || '',
            last_change: new Date().toISOString(),
            annotated: true,
          });

          console.log(
            `[Annotations] Updated metadata for detection ${annotation.id} in detectionsToAdd`,
          );

          // Also update in collection if possible
          if (currentImageId && imageLocation) {
            const addedToCollection = collectionStore.addDetectionToImage(
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

            if (addedToCollection) {
              console.log(
                `[Annotations] Added detection ${annotation.id} with metadata to collection`,
              );
            }
          }
        } else {
          // This is a completely new annotation that needs to be added to detectionsToAdd
          console.log(
            `[Annotations] Creating new detection entry for ${annotation.id} with metadata`,
          );

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

            // Add to detectionsToAdd
            imageStore.detectionsToAdd.push(newDetection);

            // Also add to collection if possible
            if (imageLocation) {
              const addedToCollection = collectionStore.addDetectionToImage(
                currentImageId,
                newDetection,
                imageLocation,
              );

              if (addedToCollection) {
                console.log(
                  `[Annotations] Added new detection ${annotation.id} with metadata to collection`,
                );
              }
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
    console.log('[Annotations] Cancelling meta input for ID:', idToRemove);

    // Remove from local annotations
    annotations.value = annotations.value.filter((a) => a.id !== idToRemove);

    // Handle imageStore operations properly

    // Remove from detectionsToAdd array (backend persistence queue)
    const detectionInToAdd = imageStore.detectionsToAdd.find(
      (d: DetectionType) => d.id === idToRemove,
    );
    if (detectionInToAdd) {
      console.log(
        '[Annotations] Removing cancelled annotation from detectionsToAdd:',
        idToRemove,
      );
      imageStore.detectionsToAdd = imageStore.detectionsToAdd.filter(
        (detection: DetectionType) => detection.id !== idToRemove,
      );
    }

    // For main detections array (which is now a computed property),
    // add the ID to detectionsToDelete so it will be properly handled on save
    if (imageStore.detections.some((d: DetectionType) => d.id === idToRemove)) {
      console.log(
        '[Annotations] Adding cancelled annotation to detectionsToDelete:',
        idToRemove,
      );
      if (!imageStore.detectionsToDelete.includes(idToRemove)) {
        imageStore.detectionsToDelete.push(idToRemove);
      }
    }

    // Revert the startCreate history entry
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

    // Create sets and maps for efficient lookups
    const localAnnotationMap = new Map(
      annotations.value.map((annotation) => [annotation.id, annotation]),
    );
    const storeDetectionMap = new Map(
      imageStore.detections.map((detection) => [detection.id, detection]),
    );

    const localIds = new Set(localAnnotationMap.keys());
    const storeIds = new Set(storeDetectionMap.keys());

    // Identify annotations to add (present in local but not in store)
    const annotationsToAdd = Array.from(localIds)
      .filter((id) => !storeIds.has(id))
      .map((id) => localAnnotationMap.get(id))
      .filter((ann): ann is DetectionState => ann !== undefined);

    // Identify annotations to delete (present in store but not in local)
    const annotationsToDelete = Array.from(storeIds).filter(
      (id) => !localIds.has(id),
    );

    // Identify annotations to modify (present in both but with changes)
    const annotationsToModify = Array.from(localIds)
      .filter((id) => storeIds.has(id))
      .map((id) => {
        const localAnnotation = localAnnotationMap.get(id);
        const storeDetection = storeDetectionMap.get(id);

        // Skip if either doesn't exist (shouldn't happen but for safety)
        if (!localAnnotation || !storeDetection) return null;

        // Compare relevant properties to detect changes
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

        // If any property changed, include in modifications
        if (hasPositionChanged || hasMetadataChanged) {
          return localAnnotation;
        }

        return null;
      })
      .filter((ann): ann is DetectionState => ann !== null);

    console.log(
      `[Annotations] Prepared changes: ${annotationsToAdd.length} to add, ` +
        `${annotationsToModify.length} to modify, ${annotationsToDelete.length} to delete`,
    );

    return {
      annotationsToAdd,
      annotationsToModify,
      annotationsToDelete,
    };
  }

  /**
   * Processes the changes identified by prepareChangesForSave.
   * This function will be implemented by external code.
   * @param changes The changes object from prepareChangesForSave
   */
  function processChanges(changes: {
    annotationsToAdd: DetectionState[];
    annotationsToModify: DetectionState[];
    annotationsToDelete: string[];
  }) {
    // These functions will be implemented by the caller
    processAdditions(changes.annotationsToAdd);
    processModifications(changes.annotationsToModify);
    processDeletions(changes.annotationsToDelete);

    console.log('[Annotations] Changes processed successfully');
    return { success: true };
  }

  /**
   * Placeholder for processing annotations to add
   */
  function processAdditions(annotationsToAdd: DetectionState[]) {
    console.log(
      `[Annotations] Processing ${annotationsToAdd.length} additions`,
    );
    // External implementation will handle this
  }

  /**
   * Placeholder for processing annotations to modify
   */
  function processModifications(annotationsToModify: DetectionState[]) {
    console.log(
      `[Annotations] Processing ${annotationsToModify.length} modifications`,
    );
    // External implementation will handle this
  }

  /**
   * Placeholder for processing annotations to delete
   */
  function processDeletions(annotationsToDelete: string[]) {
    console.log(
      `[Annotations] Processing ${annotationsToDelete.length} deletions`,
    );
    // External implementation will handle this
  }

  /**
   * Main function to save changes to annotations.
   * Compares local state with store and prepares changes for processing.
   */
  function saveChanges() {
    console.log('[Annotations] Preparing changes for save...');
    const changes = prepareChangesForSave();

    const totalChanges =
      changes.annotationsToAdd.length +
      changes.annotationsToModify.length +
      changes.annotationsToDelete.length;

    if (totalChanges === 0) {
      console.log('[Annotations] No changes to save');
      return { success: true, message: 'No changes to save' };
    }

    // Process the changes (using the placeholder for now)
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
    saveState, // Expose for Konva event handlers to save before move/transform
    undo,
    redo,
    loadAnnotations,
    confirmAnnotationMeta,
    cancelAnnotationMeta,
    saveChanges, // Expose the new save changes function
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
