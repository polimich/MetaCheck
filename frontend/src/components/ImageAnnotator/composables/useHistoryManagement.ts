import { ref, Ref } from 'vue';
import { DetectionState } from 'src/types';
import { useImage } from 'src/stores/data/useImage';
import { DetectionType } from 'src/stores/data/types';

/**
 * Helper function to convert coordinates to bbox string
 */
function objectToBbox(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return `${x},${y},${width},${height}`;
}

/**
 * Enhanced history management with improved store synchronization
 * Manages the undo/redo state for annotations and selections.
 */
export function useHistoryManagement(
  annotations: Ref<DetectionState[]>,
  selectedIds: Ref<Set<string>>,
) {
  const undoStack = ref<
    { annotations: DetectionState[]; selectedIds: Set<string> }[]
  >([]);
  const redoStack = ref<
    { annotations: DetectionState[]; selectedIds: Set<string> }[]
  >([]);

  /**
   * Saves the current annotation and selection state to the undo stack.
   */
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

  /**
   * Restores the previous state from the undo stack.
   */
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

    // Track changes for store synchronization
    const imageStore = useImage();

    // Create sets of IDs for comparison
    const currentIds = new Set(currentAnnotations.map((a) => a.id));
    const prevIds = new Set(prevState.annotations.map((a) => a.id));

    // 1. Handle completely removed annotations (present in current, absent in previous)
    const removedIds = [...currentIds].filter((id) => !prevIds.has(id));
    removedIds.forEach((id) => {
      // Find if this detection is in the detectionsToAdd array
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        // Simply remove from detectionsToAdd
        console.log('[History] Removing from detectionsToAdd on undo:', id);
        imageStore.detectionsToAdd.splice(indexInToAdd, 1);
      } else {
        // Add to detectionsToDelete if it's not already there
        if (!imageStore.detectionsToDelete.includes(id)) {
          console.log('[History] Adding to detectionsToDelete on undo:', id);
          imageStore.detectionsToDelete.push(id);
        }
      }
    });

    // 2. Handle newly added annotations (absent in current, present in previous)
    const addedIds = [...prevIds].filter((id) => !currentIds.has(id));
    addedIds.forEach((id) => {
      // If it's in detectionsToDelete, remove it
      const indexInToDelete = imageStore.detectionsToDelete.indexOf(id);
      if (indexInToDelete !== -1) {
        console.log('[History] Removing from detectionsToDelete on undo:', id);
        imageStore.detectionsToDelete.splice(indexInToDelete, 1);
      }

      // Find the annotation in the previous state
      const annotation = prevState.annotations.find((a) => a.id === id);
      if (!annotation) return;

      // Update the main detections array if it exists there
      const storeIndex = imageStore.detections.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (storeIndex !== -1) {
        // Mark it as edited to ensure it gets updated
        Object.assign(imageStore.detections[storeIndex], {
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
          value: annotation.value,
          edited: true,
          last_change: new Date().toISOString(),
        });

        console.log(`[History] Updated existing detection ${id} after undo`);
      }
    });

    // 3. Handle modified annotations (present in both, but with different properties)
    const commonIds = [...currentIds].filter((id) => prevIds.has(id));
    commonIds.forEach((id) => {
      const currentAnnotation = currentAnnotations.find((a) => a.id === id);
      const prevAnnotation = prevState.annotations.find((a) => a.id === id);

      if (!currentAnnotation || !prevAnnotation) return;

      // Check if position, size, or value has changed
      const hasChanged =
        currentAnnotation.x !== prevAnnotation.x ||
        currentAnnotation.y !== prevAnnotation.y ||
        currentAnnotation.width !== prevAnnotation.width ||
        currentAnnotation.height !== prevAnnotation.height ||
        currentAnnotation.value !== prevAnnotation.value ||
        currentAnnotation.computed_type !== prevAnnotation.computed_type;

      if (hasChanged) {
        // Update in the store if it exists there
        const storeIndex = imageStore.detections.findIndex(
          (d: DetectionType) => d.id === id,
        );

        if (storeIndex !== -1) {
          // Mark it as edited to ensure it gets updated
          Object.assign(imageStore.detections[storeIndex], {
            x: prevAnnotation.x,
            y: prevAnnotation.y,
            width: prevAnnotation.width,
            height: prevAnnotation.height,
            bbox: objectToBbox(
              prevAnnotation.x,
              prevAnnotation.y,
              prevAnnotation.width,
              prevAnnotation.height,
            ),
            value: prevAnnotation.value,
            computed_type: prevAnnotation.computed_type || '',
            computed_display_type: prevAnnotation.computed_display_type || '',
            edited: true,
            last_change: new Date().toISOString(),
          });

          console.log(`[History] Updated modified detection ${id} after undo`);
        } else {
          // Check if it's in detectionsToAdd
          const indexInToAdd = imageStore.detectionsToAdd.findIndex(
            (d: DetectionType) => d.id === id,
          );

          if (indexInToAdd !== -1) {
            // Update in detectionsToAdd
            Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
              x: prevAnnotation.x,
              y: prevAnnotation.y,
              width: prevAnnotation.width,
              height: prevAnnotation.height,
              bbox: objectToBbox(
                prevAnnotation.x,
                prevAnnotation.y,
                prevAnnotation.width,
                prevAnnotation.height,
              ),
              value: prevAnnotation.value,
              computed_type: prevAnnotation.computed_type || '',
              computed_display_type: prevAnnotation.computed_display_type || '',
              last_change: new Date().toISOString(),
            });

            console.log(
              `[History] Updated detection in detectionsToAdd after undo: ${id}`,
            );
          }
        }
      }
    });

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

  /**
   * Restores the next state from the redo stack.
   */
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

    // Track changes for store synchronization
    const imageStore = useImage();

    // Create sets of IDs for comparison
    const currentIds = new Set(currentAnnotations.map((a) => a.id));
    const nextIds = new Set(nextState.annotations.map((a) => a.id));

    // 1. Handle annotations restored by redo (absent in current, present in next)
    const addedIds = [...nextIds].filter((id) => !currentIds.has(id));
    addedIds.forEach((id) => {
      // Find the annotation in the next state
      const annotation = nextState.annotations.find((a) => a.id === id);
      if (!annotation) return;

      // If it's in detectionsToDelete, remove it
      const indexInToDelete = imageStore.detectionsToDelete.indexOf(id);
      if (indexInToDelete !== -1) {
        console.log('[History] Removing from detectionsToDelete on redo:', id);
        imageStore.detectionsToDelete.splice(indexInToDelete, 1);
      }

      // Check if it already exists in the main detections
      const storeIndex = imageStore.detections.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (storeIndex !== -1) {
        // Update existing detection
        Object.assign(imageStore.detections[storeIndex], {
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
          value: annotation.value,
          computed_type: annotation.computed_type || '',
          computed_display_type: annotation.computed_display_type || '',
          edited: true,
          last_change: new Date().toISOString(),
        });

        console.log(`[History] Updated detection ${id} after redo`);
      } else {
        // Check if it's already in detectionsToAdd
        const existsInToAdd = imageStore.detectionsToAdd.some(
          (d: DetectionType) => d.id === id,
        );

        if (!existsInToAdd) {
          // Add to detectionsToAdd
          imageStore.detectionsToAdd.push({
            id: annotation.id,
            image_id: annotation.image_id || imageStore.image?.id || '',
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
            edited: true,
            loadingMetaRoles: false,
          });

          console.log(
            `[History] Added detection ${id} to detectionsToAdd after redo`,
          );
        }
      }
    });

    // 2. Handle annotations removed by redo (present in current, absent in next)
    const removedIds = [...currentIds].filter((id) => !nextIds.has(id));
    removedIds.forEach((id) => {
      // Check if it's in detectionsToAdd
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        // Remove from detectionsToAdd
        console.log('[History] Removing from detectionsToAdd on redo:', id);
        imageStore.detectionsToAdd.splice(indexInToAdd, 1);
      } else {
        // Add to detectionsToDelete if not already there
        if (!imageStore.detectionsToDelete.includes(id)) {
          console.log('[History] Adding to detectionsToDelete on redo:', id);
          imageStore.detectionsToDelete.push(id);
        }
      }
    });

    // 3. Handle modified annotations (present in both, but with different properties)
    const commonIds = [...currentIds].filter((id) => nextIds.has(id));
    commonIds.forEach((id) => {
      const currentAnnotation = currentAnnotations.find((a) => a.id === id);
      const nextAnnotation = nextState.annotations.find((a) => a.id === id);

      if (!currentAnnotation || !nextAnnotation) return;

      // Check if position, size, or value has changed
      const hasChanged =
        currentAnnotation.x !== nextAnnotation.x ||
        currentAnnotation.y !== nextAnnotation.y ||
        currentAnnotation.width !== nextAnnotation.width ||
        currentAnnotation.height !== nextAnnotation.height ||
        currentAnnotation.value !== nextAnnotation.value ||
        currentAnnotation.computed_type !== nextAnnotation.computed_type;

      if (hasChanged) {
        // Update in the store if it exists there
        const storeIndex = imageStore.detections.findIndex(
          (d: DetectionType) => d.id === id,
        );

        if (storeIndex !== -1) {
          // Mark it as edited to ensure it gets updated
          Object.assign(imageStore.detections[storeIndex], {
            x: nextAnnotation.x,
            y: nextAnnotation.y,
            width: nextAnnotation.width,
            height: nextAnnotation.height,
            bbox: objectToBbox(
              nextAnnotation.x,
              nextAnnotation.y,
              nextAnnotation.width,
              nextAnnotation.height,
            ),
            value: nextAnnotation.value,
            computed_type: nextAnnotation.computed_type || '',
            computed_display_type: nextAnnotation.computed_display_type || '',
            edited: true,
            last_change: new Date().toISOString(),
          });

          console.log(`[History] Updated modified detection ${id} after redo`);
        } else {
          // Check if it's in detectionsToAdd
          const indexInToAdd = imageStore.detectionsToAdd.findIndex(
            (d: DetectionType) => d.id === id,
          );

          if (indexInToAdd !== -1) {
            // Update in detectionsToAdd
            Object.assign(imageStore.detectionsToAdd[indexInToAdd], {
              x: nextAnnotation.x,
              y: nextAnnotation.y,
              width: nextAnnotation.width,
              height: nextAnnotation.height,
              bbox: objectToBbox(
                nextAnnotation.x,
                nextAnnotation.y,
                nextAnnotation.width,
                nextAnnotation.height,
              ),
              value: nextAnnotation.value,
              computed_type: nextAnnotation.computed_type || '',
              computed_display_type: nextAnnotation.computed_display_type || '',
              last_change: new Date().toISOString(),
            });

            console.log(
              `[History] Updated detection in detectionsToAdd after redo: ${id}`,
            );
          }
        }
      }
    });

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
