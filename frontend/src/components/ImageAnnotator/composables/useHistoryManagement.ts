// @author Michael Polívka (xpoliv07)
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
    const currentAnnotations = annotations.value || [];
    const cloneAnnotations = currentAnnotations.map((a) => ({ ...a }));
    undoStack.value.push({
      annotations: cloneAnnotations,
      selectedIds: new Set(selectedIds.value),
    });
    redoStack.value = [];
  }

  /**
   * Restores the previous state from the undo stack.
   */
  function undo() {
    if (undoStack.value.length === 0) return;
    const prevState = undoStack.value.pop();
    if (!prevState) return;

    const currentAnnotations = annotations.value || [];
    redoStack.value.push({
      annotations: currentAnnotations.map((a) => ({ ...a })),
      selectedIds: new Set(selectedIds.value),
    });

    const imageStore = useImage();

    const currentIds = new Set(currentAnnotations.map((a) => a.id));
    const prevIds = new Set(prevState.annotations.map((a) => a.id));

    // Handle completely removed annotations (present in current, absent in previous)
    const removedIds = [...currentIds].filter((id) => !prevIds.has(id));
    removedIds.forEach((id) => {
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        imageStore.detectionsToAdd.splice(indexInToAdd, 1);
      } else {
        if (!imageStore.detectionsToDelete.includes(id)) {
          imageStore.detectionsToDelete.push(id);
        }
      }
    });

    // Handle newly added annotations (absent in current, present in previous)
    const addedIds = [...prevIds].filter((id) => !currentIds.has(id));
    addedIds.forEach((id) => {
      const indexInToDelete = imageStore.detectionsToDelete.indexOf(id);
      if (indexInToDelete !== -1) {
        imageStore.detectionsToDelete.splice(indexInToDelete, 1);
      }

      const annotation = prevState.annotations.find((a) => a.id === id);
      if (!annotation) return;

      const storeIndex = imageStore.detections.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (storeIndex !== -1) {
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
      }
    });

    // Handle modified annotations (present in both, but with different properties)
    const commonIds = [...currentIds].filter((id) => prevIds.has(id));
    commonIds.forEach((id) => {
      const currentAnnotation = currentAnnotations.find((a) => a.id === id);
      const prevAnnotation = prevState.annotations.find((a) => a.id === id);

      if (!currentAnnotation || !prevAnnotation) return;

      const hasChanged =
        currentAnnotation.x !== prevAnnotation.x ||
        currentAnnotation.y !== prevAnnotation.y ||
        currentAnnotation.width !== prevAnnotation.width ||
        currentAnnotation.height !== prevAnnotation.height ||
        currentAnnotation.value !== prevAnnotation.value ||
        currentAnnotation.computed_type !== prevAnnotation.computed_type;

      if (hasChanged) {
        const storeIndex = imageStore.detections.findIndex(
          (d: DetectionType) => d.id === id,
        );

        if (storeIndex !== -1) {
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
        } else {
          const indexInToAdd = imageStore.detectionsToAdd.findIndex(
            (d: DetectionType) => d.id === id,
          );

          if (indexInToAdd !== -1) {
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
          }
        }
      }
    });

    annotations.value = prevState.annotations;
    selectedIds.value = prevState.selectedIds;
  }

  /**
   * Restores the next state from the redo stack.
   */
  function redo() {
    if (redoStack.value.length === 0) return;
    const nextState = redoStack.value.pop();
    if (!nextState) return;

    const currentAnnotations = annotations.value || [];
    undoStack.value.push({
      annotations: currentAnnotations.map((a) => ({ ...a })),
      selectedIds: new Set(selectedIds.value),
    });

    const imageStore = useImage();

    const currentIds = new Set(currentAnnotations.map((a) => a.id));
    const nextIds = new Set(nextState.annotations.map((a) => a.id));

    // Handle annotations restored by redo (absent in current, present in next)
    const addedIds = [...nextIds].filter((id) => !currentIds.has(id));
    addedIds.forEach((id) => {
      const annotation = nextState.annotations.find((a) => a.id === id);
      if (!annotation) return;

      const indexInToDelete = imageStore.detectionsToDelete.indexOf(id);
      if (indexInToDelete !== -1) {
        imageStore.detectionsToDelete.splice(indexInToDelete, 1);
      }

      const storeIndex = imageStore.detections.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (storeIndex !== -1) {
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
      } else {
        const existsInToAdd = imageStore.detectionsToAdd.some(
          (d: DetectionType) => d.id === id,
        );

        if (!existsInToAdd) {
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
            computed_color: annotation.computed_color || '',
            computed_type: annotation.computed_type || '',
            computed_display_type: annotation.computed_display_type || '',
            created_date: annotation.created_date || new Date().toISOString(),
            last_change: new Date().toISOString(),
            last_access: new Date().toISOString(),
            deleted: false,
            edited: true,
            loadingMetaRoles: false,
          });
        }
      }
    });

    // Handle annotations removed by redo (present in current, absent in next)
    const removedIds = [...currentIds].filter((id) => !nextIds.has(id));
    removedIds.forEach((id) => {
      const indexInToAdd = imageStore.detectionsToAdd.findIndex(
        (d: DetectionType) => d.id === id,
      );

      if (indexInToAdd !== -1) {
        imageStore.detectionsToAdd.splice(indexInToAdd, 1);
      } else {
        if (!imageStore.detectionsToDelete.includes(id)) {
          imageStore.detectionsToDelete.push(id);
        }
      }
    });

    // Handle modified annotations (present in both, but with different properties)
    const commonIds = [...currentIds].filter((id) => nextIds.has(id));
    commonIds.forEach((id) => {
      const currentAnnotation = currentAnnotations.find((a) => a.id === id);
      const nextAnnotation = nextState.annotations.find((a) => a.id === id);

      if (!currentAnnotation || !nextAnnotation) return;

      const hasChanged =
        currentAnnotation.x !== nextAnnotation.x ||
        currentAnnotation.y !== nextAnnotation.y ||
        currentAnnotation.width !== nextAnnotation.width ||
        currentAnnotation.height !== nextAnnotation.height ||
        currentAnnotation.value !== nextAnnotation.value ||
        currentAnnotation.computed_type !== nextAnnotation.computed_type;

      if (hasChanged) {
        const storeIndex = imageStore.detections.findIndex(
          (d: DetectionType) => d.id === id,
        );

        if (storeIndex !== -1) {
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
        } else {
          const indexInToAdd = imageStore.detectionsToAdd.findIndex(
            (d: DetectionType) => d.id === id,
          );

          if (indexInToAdd !== -1) {
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
          }
        }
      }
    });

    annotations.value = nextState.annotations;
    selectedIds.value = nextState.selectedIds;
  }

  return { undoStack, redoStack, saveState, undo, redo };
}
