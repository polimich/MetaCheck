// @author Michael Polívka (xpoliv07)
import { Ref } from 'vue';
import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { useNavigationMode } from './useNavigationMode';
import { useAnnotations } from './useAnnotations';
import { useImageCanvas } from './useImageCanvas';
import { useImage } from 'src/stores';

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
  const imageStore = useImage();

  const isDragging = { value: false };
  const mouseIsDown = { value: false };
  const dragStartPos = { x: 0, y: 0 };
  const dragThreshold = 5;

  function handleMouseDown(event: KonvaPointerEvent) {
    if (navigationMode.mode.value !== 'add' || !konvaLayer.value) return;

    const targetClass = event.target.getClassName();
    const targetName = event.target.name?.();

    if (
      (targetName && targetName.startsWith('annotation_')) ||
      targetClass === 'Transformer' ||
      targetClass === 'Circle'
    ) {
      return;
    }

    if (targetClass === 'Stage' || targetClass === 'Layer') {
      if (annotations.pendingMetaAnnotationId.value) {
        return;
      }

      annotations.deselectAll();
      imageStore.selectDetection(null);

      const layerPos = konvaLayer.value.getRelativePointerPosition();
      if (!layerPos) {
        console.error(
          '[useKonvaEventHandlers] Could not get relative pointer position from layer',
        );
        return;
      }

      dragStartPos.x = layerPos.x;
      dragStartPos.y = layerPos.y;
      isDragging.value = false;
      mouseIsDown.value = true;
    }
  }

  function handleMouseMove() {
    if (
      !konvaLayer.value ||
      navigationMode.mode.value !== 'add' ||
      !mouseIsDown.value
    )
      return;

    const layerPos = konvaLayer.value.getRelativePointerPosition();
    if (!layerPos) return;

    if (annotations.isCreating.value) {
      annotations.updateCreating(layerPos);
      return;
    }

    if (!isDragging.value) {
      const dx = layerPos.x - dragStartPos.x;
      const dy = layerPos.y - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > dragThreshold) {
        isDragging.value = true;

        const currentImageIdFromCanvas = imageCanvas.imageUrl.value
          .split('/')
          .pop()
          ?.split('?')[0];

        if (currentImageIdFromCanvas) {
          annotations.startCreate(dragStartPos, currentImageIdFromCanvas);
          annotations.updateCreating(layerPos);
        } else {
          console.error(
            '[useKonvaEventHandlers] Could not determine image ID for annotation creation',
          );
        }
      }
    }
  }

  function handleMouseUp() {
    if (annotations.isCreating.value && isDragging.value) {
      annotations.finishCreate();
    }

    isDragging.value = false;
    mouseIsDown.value = false;
  }

  function handleDragStart(event: KonvaPointerEvent) {
    if (
      navigationMode.mode.value === 'drag' &&
      event.target === konvaStage.value
    ) {
      document.body.style.cursor = 'grabbing';
    }
  }

  function handleDragMove(event: KonvaPointerEvent) {
    if (
      navigationMode.mode.value === 'drag' &&
      event.target === konvaStage.value
    ) {
      if (konvaStage.value) {
        imageCanvas.position.x = konvaStage.value.x();
        imageCanvas.position.y = konvaStage.value.y();
      }
    }
  }

  function handleDragEnd(event: KonvaPointerEvent) {
    if (
      navigationMode.mode.value === 'drag' &&
      event.target === konvaStage.value
    ) {
      document.body.style.cursor = 'grab';
    } else {
      document.body.style.cursor = navigationMode.getCursorStyle.value;
    }
  }

  function handleWheel(event: KonvaPointerEvent) {
    const wheelEvent = event.evt as unknown as WheelEvent;
    if (!navigationMode.altKeyPressed.value && !wheelEvent.altKey) return;

    wheelEvent.preventDefault();

    const pointer = konvaStage.value?.getPointerPosition();
    if (!pointer || !konvaStage.value || !konvaLayer.value) return;

    imageCanvas.zoomImage(wheelEvent.deltaY, pointer);
    konvaLayer.value.batchDraw();
  }

  function handleRectClick(event: KonvaPointerEvent) {
    if (navigationMode.mode.value !== 'add') return;

    const id = event.target.id();
    if (!id) return;

    const shiftKey = (event.evt as MouseEvent).shiftKey;

    annotations.selectAnnotation(id, shiftKey);

    if (!shiftKey) {
      imageStore.selectDetection(id);
    }

    event.cancelBubble = true;
  }

  function handleTransformEnd(event: KonvaPointerEvent) {
    const node = event.target;
    const id = node.id();
    if (!id) return;

    const newAttrs = {
      x: node.x(),
      y: node.y(),
      width: node.width() * node.scaleX(),
      height: node.height() * node.scaleY(),
    };

    annotations.updateAnnotationDimensions(id, newAttrs);

    node.scaleX(1);
    node.scaleY(1);
  }

  function handleRectDragEnd(event: KonvaPointerEvent) {
    if (navigationMode.mode.value !== 'add') return;

    const node = event.target;
    const id = node.id();
    if (!id) return;

    const finalAttrs = {
      x: node.x(),
      y: node.y(),
      width: node.width(),
      height: node.height(),
    };

    annotations.updateAnnotationDimensions(id, finalAttrs);
  }

  function handleRectDragStart(e: KonvaPointerEvent) {
    e.cancelBubble = true;
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
