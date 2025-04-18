import { Ref } from 'vue';
import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { useNavigationMode } from './useNavigationMode';
import { useAnnotations } from './useAnnotations';
import { useImageCanvas } from './useImageCanvas';
import { useImageStore } from 'src/stores/image/storeImages';

/**
 * Composable for managing Konva event handlers for the annotator
 */
export function useKonvaEventHandlers(
  konvaStage: Ref<Stage | null>,
  konvaLayer: Ref<Layer | null>,
  navigationMode: ReturnType<typeof useNavigationMode>,
  annotations: ReturnType<typeof useAnnotations>,
  imageCanvas: ReturnType<typeof useImageCanvas>,
) {
  // Get the image store for updating selected detection
  const imageStore = useImageStore();

  // Handle annotations being created
  function handleMouseDown(event: KonvaPointerEvent) {
    if (navigationMode.mode.value !== 'add' || !konvaLayer.value) return;

    console.log(
      '[useKonvaEventHandlers] Mouse down on target:',
      event.target.name(),
      'className:',
      event.target.getClassName(),
    );

    const targetClass = event.target.getClassName();
    const targetName = event.target.name?.();

    // Ignore clicks on existing annotations or transformer parts
    if (
      (targetName && targetName.startsWith('annotation_')) ||
      targetClass === 'Transformer' ||
      targetClass === 'Circle'
    ) {
      console.log(
        '[useKonvaEventHandlers] Clicked on annotation or transformer, ignoring for deselect/create',
      );
      return;
    }

    // Check if clicking on background (Stage or Layer)
    if (targetClass === 'Stage' || targetClass === 'Layer') {
      if (annotations.pendingMetaAnnotationId.value) {
        console.log(
          '[useKonvaEventHandlers] Background click ignored, annotation meta pending.',
        );
        return;
      }

      console.log(
        '[useKonvaEventHandlers] Clicked on background, deselecting all annotations',
      );

      // Deselect all annotations in the local state
      annotations.deselectAll();

      // Also deselect in the store
      imageStore.selectDetection(null);
      console.log('[useKonvaEventHandlers] Deselected annotation in store');

      // Use layer.getRelativePointerPosition for accurate coords
      const layerPos = konvaLayer.value.getRelativePointerPosition();
      if (!layerPos) {
        console.error(
          '[useKonvaEventHandlers] Could not get relative pointer position from layer',
        );
        return;
      }
      const currentImageIdFromCanvas = imageCanvas.imageUrl.value
        .split('/')
        .pop()
        ?.split('?')[0];
      if (currentImageIdFromCanvas) {
        annotations.startCreate(layerPos, currentImageIdFromCanvas);
      } else {
        console.error(
          '[useKonvaEventHandlers] Could not determine image ID for annotation creation',
        );
      }
    }
  }

  // Update annotation being created
  function handleMouseMove() {
    if (!annotations.isCreating.value || !konvaLayer.value) return;

    const layerPos = konvaLayer.value.getRelativePointerPosition();
    if (!layerPos) return;

    annotations.updateCreating(layerPos);
  }

  // Finish creating annotation
  function handleMouseUp() {
    if (annotations.isCreating.value) {
      annotations.finishCreate();
    }
  }

  // Update drag handlers for STAGE dragging
  function handleDragStart(event: KonvaPointerEvent) {
    // Check if dragging the stage itself in drag mode
    if (
      navigationMode.mode.value === 'drag' &&
      event.target === konvaStage.value
    ) {
      document.body.style.cursor = 'grabbing';
    }
  }

  function handleDragMove(event: KonvaPointerEvent) {
    // Only act if dragging the STAGE in drag mode
    if (
      navigationMode.mode.value === 'drag' &&
      event.target === konvaStage.value
    ) {
      if (konvaStage.value) {
        // Sync reactive state with the Konva stage position
        imageCanvas.position.x = konvaStage.value.x();
        imageCanvas.position.y = konvaStage.value.y();
      }
    }
  }

  function handleDragEnd(event: KonvaPointerEvent) {
    // Reset cursor if dragging the stage ended
    if (
      navigationMode.mode.value === 'drag' &&
      event.target === konvaStage.value
    ) {
      document.body.style.cursor = 'grab';
    } else {
      // Reset to default if drag ended on something else or mode changed
      document.body.style.cursor = navigationMode.getCursorStyle.value;
    }
    // Final position sync is handled by handleDragMove
  }

  // Handle mouse wheel for zooming
  function handleWheel(event: KonvaPointerEvent) {
    // Only allow zooming with Alt key
    const wheelEvent = event.evt as unknown as WheelEvent;
    if (!navigationMode.altKeyPressed.value && !wheelEvent.altKey) return;

    wheelEvent.preventDefault();

    const pointer = konvaStage.value?.getPointerPosition();
    if (!pointer || !konvaStage.value || !konvaLayer.value) return;

    // Calculate zoom relative to pointer position using useImageCanvas
    imageCanvas.zoomImage(wheelEvent.deltaY, pointer);

    // Redraw the layer after zoom changes scale/position
    konvaLayer.value.batchDraw();
  }

  // Select annotation on click
  function handleRectClick(event: KonvaPointerEvent) {
    if (navigationMode.mode.value !== 'add') return;

    const id = event.target.id();
    console.log('[useKonvaEventHandlers] Clicked on annotation with ID:', id);

    if (!id) return;

    // Check if we're holding shift for multi-select
    const shiftKey = (event.evt as MouseEvent).shiftKey;

    // Select the annotation in our local state
    annotations.selectAnnotation(id, shiftKey);

    // Update the store's selected detection ID for the AnnotationList synchronization
    // Only update for single selection (not shift multi-select)
    if (!shiftKey) {
      imageStore.selectDetection(id);
      console.log(
        '[useKonvaEventHandlers] Updated store selectedDetectionId to:',
        id,
      );
    }

    // Transformer update is handled by the watcher in useTransformerManagement

    // Stop propagation to prevent canvas click
    event.cancelBubble = true;
  }

  // End rect transform
  function handleTransformEnd(event: KonvaPointerEvent) {
    const node = event.target;
    const id = node.id();
    console.log(
      '[useKonvaEventHandlers] Transform ended for node with ID:',
      id,
    );

    if (!id) return;

    // Get new dimensions and update annotation
    const newAttrs = {
      x: node.x(),
      y: node.y(),
      width: node.width() * node.scaleX(),
      height: node.height() * node.scaleY(),
    };

    console.log(
      '[useKonvaEventHandlers] New transformed dimensions (layer coords):',
      newAttrs,
    );

    // Update annotation with new dimensions
    annotations.updateAnnotationDimensions(id, newAttrs);

    // Reset scale on the node itself after transform
    node.scaleX(1);
    node.scaleY(1);

    // Transformer update is handled by the watcher
  }

  // New handler for rectangle drag end
  function handleRectDragEnd(event: KonvaPointerEvent) {
    // Only handle if in add mode (when rects are draggable)
    if (navigationMode.mode.value !== 'add') return;

    const node = event.target;
    const id = node.id();
    console.log(
      '[useKonvaEventHandlers] Rect Drag ended for node with ID:',
      id,
    );

    if (!id) return;

    // Get final position (already in layer coordinates)
    const finalAttrs = {
      x: node.x(),
      y: node.y(),
      width: node.width(),
      height: node.height(),
    };

    console.log(
      '[useKonvaEventHandlers] Final position after drag (layer coords):',
      finalAttrs,
    );

    // Update annotation state and trigger saveState
    annotations.updateAnnotationDimensions(id, finalAttrs);

    // Transformer update is handled by the watcher
  }

  // Prevent default drag behavior on rects to avoid conflicts
  function handleRectDragStart(e: KonvaPointerEvent) {
    e.cancelBubble = true; // Prevent stage drag
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleWheel,
    handleRectClick,
    handleTransformEnd,
    handleRectDragEnd,
    handleRectDragStart,
  };
}
