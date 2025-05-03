import { Ref } from 'vue';
import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { useNavigationMode } from './useNavigationMode';
import { useAnnotations } from './useAnnotations';
import { useImageCanvas } from './useImageCanvas';
import { useImageStore } from 'src/stores/data/useImage';

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

  // Track mouse state for drag detection
  const isDragging = { value: false };
  const mouseIsDown = { value: false };
  const dragStartPos = { x: 0, y: 0 };
  const dragThreshold = 5; // Minimum pixels to move before considering it a drag

  // Handle mouse down event
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

      // Store the starting position for potential drag creation
      const layerPos = konvaLayer.value.getRelativePointerPosition();
      if (!layerPos) {
        console.error(
          '[useKonvaEventHandlers] Could not get relative pointer position from layer',
        );
        return;
      }

      // Save start position for later drag detection
      dragStartPos.x = layerPos.x;
      dragStartPos.y = layerPos.y;
      isDragging.value = false;
      mouseIsDown.value = true; // Track that mouse is now down
    }
  }

  // Update annotation being created
  function handleMouseMove() {
    if (
      !konvaLayer.value ||
      navigationMode.mode.value !== 'add' ||
      !mouseIsDown.value
    )
      return;

    // Get current mouse position
    const layerPos = konvaLayer.value.getRelativePointerPosition();
    if (!layerPos) return;

    // If already creating an annotation, update it
    if (annotations.isCreating.value) {
      annotations.updateCreating(layerPos);
      return;
    }

    // Check if we should start a drag operation
    if (!isDragging.value) {
      // Calculate distance moved
      const dx = layerPos.x - dragStartPos.x;
      const dy = layerPos.y - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved past threshold, start creating
      if (distance > dragThreshold) {
        isDragging.value = true;

        // Start creation process
        const currentImageIdFromCanvas = imageCanvas.imageUrl.value
          .split('/')
          .pop()
          ?.split('?')[0];

        if (currentImageIdFromCanvas) {
          annotations.startCreate(dragStartPos, currentImageIdFromCanvas);
          // Immediately update to current position
          annotations.updateCreating(layerPos);
        } else {
          console.error(
            '[useKonvaEventHandlers] Could not determine image ID for annotation creation',
          );
        }
      }
    }
  }

  // Finish creating annotation
  function handleMouseUp() {
    if (annotations.isCreating.value && isDragging.value) {
      annotations.finishCreate();
    }

    // Reset state
    isDragging.value = false;
    mouseIsDown.value = false;
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

  // Update the handleTransformEnd function
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
    // This now also updates the store through the useAnnotations composable
    annotations.updateAnnotationDimensions(id, newAttrs);

    // Reset scale on the node itself after transform
    node.scaleX(1);
    node.scaleY(1);

    // The store update is now handled inside updateAnnotationDimensions
    // so we don't need to update it here
  }

  // Update the handleRectDragEnd function
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
    // This now also updates the store through the useAnnotations composable
    annotations.updateAnnotationDimensions(id, finalAttrs);

    // The store update is now handled inside updateAnnotationDimensions
    // so we don't need to update it here
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
