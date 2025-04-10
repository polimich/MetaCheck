import { UnwrapNestedRefs } from 'vue';
import { Annotator } from 'src/service/annotator.ts';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { Container } from 'konva/lib/Container';
import type { Node } from 'konva/lib/Node';
import { useImageStore } from 'src/stores';
import { Vector2d } from 'konva/lib/types';
import { DetectionState, newDetectionState } from 'src/types';

// Create a new annotation when clicking in add mode
const createAnnotation = async (
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageId: string,
  annotations: DetectionState[],
) => {
  if (annotator.mode !== 'add') return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;

  const { width: stageWidth, height: stageHeight } = annotator.stageConfig;
  const maxX = stageWidth / annotator.imageScale;
  const maxY = stageHeight / annotator.imageScale;

  const x = Number(Math.max(0, Math.min(pointerPosition.x, maxX)).toFixed(3));
  const y = Number(Math.max(0, Math.min(pointerPosition.y, maxY)).toFixed(3));

  const newAnnotation = newDetectionState();
  newAnnotation.image_id = imageId;
  newAnnotation.x = x;
  newAnnotation.y = y;
  newAnnotation.computed_display_type = '';
  newAnnotation.computed_type = 'box';
  newAnnotation.computed_color = '#000000';

  annotations.push(newAnnotation);
  annotator.innerToolBox.updateAnnotation(newAnnotation);
  annotator.isAnnotating = true;

  annotator.saveState(annotations);
};

// Helper to get the most recently added annotation
function getLatestAnnotation(
  annotations: DetectionState[],
): DetectionState | undefined {
  return annotations.at(-1);
}

// Update annotation dimensions during mouse movement (resizing)
const startEditAnnotationVolume = (
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: DetectionState[],
): void => {
  if (annotator.mode !== 'add') return;
  if (!annotator.isAnnotating) return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;

  const { x: newX, y: newY } = pointerPosition;
  const currentAnnotation = getLatestAnnotation(annotations);
  if (!currentAnnotation) return;

  const { x: oldX, y: oldY } = currentAnnotation;

  // Allow drawing in any direction (including negative directions)
  const width = Number((newX - oldX).toFixed(3));
  const height = Number((newY - oldY).toFixed(3));

  if (
    width !== currentAnnotation.width ||
    height !== currentAnnotation.height
  ) {
    currentAnnotation.width = width;
    currentAnnotation.height = height;
    currentAnnotation.edited = true;
  }
};

// Finalize annotation on mouse up, handling normalization and boundaries
const stopEditAnnotationVolume = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageStore: ReturnType<typeof useImageStore>,
) => {
  if (annotator.mode !== 'add') return;

  annotator.isAnnotating = false;
  const currentAnnotation = getLatestAnnotation(imageStore.detections);
  if (!currentAnnotation) return;

  // Normalize negative dimensions
  if (currentAnnotation.width < 0) {
    currentAnnotation.x += currentAnnotation.width;
    currentAnnotation.width = Math.abs(currentAnnotation.width);
  }

  if (currentAnnotation.height < 0) {
    currentAnnotation.y += currentAnnotation.height;
    currentAnnotation.height = Math.abs(currentAnnotation.height);
  }

  // Handle case when the annotation is too small
  if (currentAnnotation.height < 5 || currentAnnotation.width < 5) {
    await removeAnnotation({
      id: currentAnnotation.id,
      annotator: annotator,
      imageStore: imageStore,
      isNoVolume: true,
    });
    return;
  }

  annotator.stage.draw();
  adjustAnnotation(annotator, currentAnnotation, imageStore);

  if (annotator.transformer.nodes().length == 0)
    annotator.innerToolBox.updateAnnotation(currentAnnotation);

  annotator.innerToolBox.show(event.evt);
  annotator.saveState(imageStore.detections);
};

// Remove an annotation and update the UI and data stores
async function removeAnnotation({
  id,
  annotator,
  imageStore,
  isNoVolume = false,
}: {
  id: string;
  annotator: UnwrapNestedRefs<Annotator> & object;
  imageStore: ReturnType<typeof useImageStore>;
  isNoVolume?: boolean;
}) {
  try {
    const rect = annotator.stage.findOne(`#${id}`);
    if (!rect) {
      console.warn(`Annotation with id ${id} not found in stage`);
      return;
    }

    const parent = rect.findAncestor('Group') as Container;
    if (!parent) {
      console.warn(`Parent group for annotation ${id} not found`);
      return;
    }

    parent.destroy();
    annotator.transformer.nodes([]);
    annotator.deselectAll();
    annotator.innerToolBox.hide();

    const targetIndex = imageStore.detections.findIndex(
      (item) => item.id === id,
    );
    if (targetIndex === -1) {
      console.warn(`Annotation with id ${id} not found in store`);
      return;
    }

    imageStore.detectionsToDelete.push(imageStore.detections[targetIndex]);
    imageStore.detections.splice(targetIndex, 1);

    if (imageStore.detections.length > 0) {
      annotator.innerToolBox.updateAnnotation(imageStore.detections.at(-1)!);
    }

    if (!isNoVolume) {
      annotator.saveState(imageStore.detections);
    }
  } catch (error) {
    console.error('Error removing annotation:', error);
  }
}

// Adjust annotation to ensure it's within bounds and handle negative dimensions
function adjustAnnotation(
  annotator: UnwrapNestedRefs<Annotator> & object,
  currentAnnotation: DetectionState,
  imageStore: ReturnType<typeof useImageStore>,
) {
  try {
    const annotationNode = annotator.stage.findOne(
      (node: Node) =>
        node.attrs.id === currentAnnotation.id &&
        node.getClassName() === 'Rect',
    );

    if (!annotationNode) {
      console.warn(`Annotation node with id ${currentAnnotation.id} not found`);
      return;
    }

    const {
      x: nodeX,
      y: nodeY,
      width: shapeWidth,
      height: shapeHeight,
    } = annotationNode.attrs;

    const nodeAttrs: Record<string, number> = {};

    // Handle negative width
    if (shapeWidth < 0) {
      const newX = Number((nodeX + shapeWidth).toFixed(3));
      const newWidth = Number(Math.abs(shapeWidth).toFixed(3));
      nodeAttrs.x = newX;
      nodeAttrs.width = newWidth;
      currentAnnotation.x = newX;
      currentAnnotation.width = newWidth;
    }

    // Handle negative height
    if (shapeHeight < 0) {
      const newY = Number((nodeY + shapeHeight).toFixed(3));
      const newHeight = Number(Math.abs(shapeHeight).toFixed(3));
      nodeAttrs.y = newY;
      nodeAttrs.height = newHeight;
      currentAnnotation.y = newY;
      currentAnnotation.height = newHeight;
    }

    // Apply boundary constraints
    const { width: stageWidth, height: stageHeight } = annotator.stageConfig;
    const maxX = stageWidth / annotator.imageScale - currentAnnotation.width;
    const maxY = stageHeight / annotator.imageScale - currentAnnotation.height;

    if (currentAnnotation.x < 0) {
      currentAnnotation.x = 0;
      nodeAttrs.x = 0;
    } else if (currentAnnotation.x > maxX) {
      currentAnnotation.x = Number(maxX.toFixed(3));
      nodeAttrs.x = currentAnnotation.x;
    }

    if (currentAnnotation.y < 0) {
      currentAnnotation.y = 0;
      nodeAttrs.y = 0;
    } else if (currentAnnotation.y > maxY) {
      currentAnnotation.y = Number(maxY.toFixed(3));
      nodeAttrs.y = currentAnnotation.y;
    }

    if (Object.keys(nodeAttrs).length > 0) {
      annotationNode.setAttrs(nodeAttrs);
      annotator.stage.draw();
    }

    const targetIndex = imageStore.detections.findIndex(
      (item) => item.id === currentAnnotation.id,
    );

    if (targetIndex === -1) {
      console.warn(
        `Annotation with id ${currentAnnotation.id} not found in store`,
      );
      return;
    }

    imageStore.detections[targetIndex].x = currentAnnotation.x;
    imageStore.detections[targetIndex].y = currentAnnotation.y;
    imageStore.detections[targetIndex].width = currentAnnotation.width;
    imageStore.detections[targetIndex].height = currentAnnotation.height;
    imageStore.detections[targetIndex].edited = true;
  } catch (error) {
    console.error('Error adjusting annotation:', error);
  }
}

// Update annotation position during dragging
const startDragAnnotation = (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: DetectionState[],
) => {
  annotator.innerToolBox.hide();

  const { x, y, id } = event.target.attrs;
  const currentAnnotation = getAnnotationById(id, annotations);
  if (!currentAnnotation) return;
  currentAnnotation.x = x;
  currentAnnotation.y = y;
};

// Helper to find annotation by ID
function getAnnotationById(
  id: string,
  annotations: DetectionState[],
): DetectionState | undefined {
  return annotations.find((item) => item.id === id);
}

// Utility for grid snapping (if enabled)
function snapToGrid(
  value: number,
  gridSize: number,
  enableSnapping = false,
): number {
  if (!enableSnapping) return value;
  return Math.round(value / gridSize) * gridSize;
}

// Process end of drag action and ensure annotation is within bounds
const stopDragAnnotation = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: DetectionState[],
) => {
  const { id, x, y, height, width } = event.target.attrs;
  const { height: stageHeight, width: stageWidth } = annotator.stageConfig;
  const currentAnnotation = getAnnotationById(id, annotations);

  if (!currentAnnotation) return;

  // Calculate boundaries
  const maxY = stageHeight / annotator.imageScale - height;
  const maxX = stageWidth / annotator.imageScale - width;

  const enableGridSnapping = false;
  const gridSize = 10;

  const originalX = x;
  const originalY = y;

  let newX = originalX;
  let newY = originalY;

  // Apply boundary constraints
  if (newX < 0) {
    newX = 0;
  } else if (newX > maxX) {
    newX = maxX;
  }

  if (newY < 0) {
    newY = 0;
  } else if (newY > maxY) {
    newY = maxY;
  }

  // Apply grid snapping if enabled
  if (enableGridSnapping) {
    newX = snapToGrid(newX, gridSize, enableGridSnapping);
    newY = snapToGrid(newY, gridSize, enableGridSnapping);
  }

  currentAnnotation.x = newX;
  currentAnnotation.y = newY;
  currentAnnotation.edited = true;

  if (newX !== originalX || newY !== originalY) {
    event.target.setAttrs({
      x: newX,
      y: newY,
    });
  }

  annotator.stage.draw();
  annotator.innerToolBox.show(event.evt);
  annotator.saveState(annotations);
};

// Handle selection of annotations and multi-select with shift key
const startResizeAnnotation = (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: DetectionState[],
) => {
  const target = event.target;
  const isShiftPressed = event.evt.shiftKey;

  if (target.getClassName() !== 'Rect') {
    if (!isShiftPressed) {
      annotator.deselectAll();
    }
    return;
  }

  const currentAnnotation = getAnnotationById(target.attrs.id, annotations);
  if (!currentAnnotation) return;

  annotator.innerToolBox.updateAnnotation(currentAnnotation);

  // Handle multi-selection with shift key
  if (isShiftPressed) {
    annotator.selectAnnotation(currentAnnotation.id, true);
  } else {
    annotator.selectAnnotation(currentAnnotation.id, false);
  }

  annotator.innerToolBox.show(event.evt);
};

// Process the end of a resize operation, updating dimensions and position
const stopResizeAnnotation = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: DetectionState[],
) => {
  const target = event.target;
  const {
    id: eventId,
    x: eventX,
    y: eventY,
    width: eventWidth,
    height: eventHeight,
    scaleX,
    scaleY,
  } = target.attrs;

  const currentAnnotation = getAnnotationById(eventId, annotations);
  if (!currentAnnotation) return;

  const newWidth = Number((eventWidth * scaleX).toFixed(3));
  const newHeight = Number((eventHeight * scaleY).toFixed(3));

  const { width: stageWidth, height: stageHeight } = annotator.stageConfig;
  const maxX = stageWidth / annotator.imageScale - newWidth;
  const maxY = stageHeight / annotator.imageScale - newHeight;

  const originalX = eventX;
  const originalY = eventY;

  let newX = originalX;
  let newY = originalY;

  if (newX < 0) {
    newX = 0;
  } else if (newX > maxX) {
    newX = maxX;
  }

  if (newY < 0) {
    newY = 0;
  } else if (newY > maxY) {
    newY = maxY;
  }

  currentAnnotation.x = Number(newX.toFixed(3));
  currentAnnotation.y = Number(newY.toFixed(3));
  currentAnnotation.width = newWidth;
  currentAnnotation.height = newHeight;
  currentAnnotation.edited = true;

  // Reset scale to avoid compound scaling
  target.setAttrs({
    x: currentAnnotation.x,
    y: currentAnnotation.y,
    width: currentAnnotation.width,
    height: currentAnnotation.height,
    scaleX: 1,
    scaleY: 1,
  });

  annotator.stage.draw();
  annotator.innerToolBox.show(event.evt);
  annotator.saveState(annotations);
};

// Handle case when mouse leaves the canvas during annotation
const leaveAnnotateRange = (
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageStore: ReturnType<typeof useImageStore>,
) => {
  if (annotator.mode !== 'add') return;
  if (!annotator.isAnnotating) return;
  annotator.isAnnotating = false;

  const latestAnnotation = getLatestAnnotation(imageStore.detections);
  if (!latestAnnotation) return;

  // Normalize negative dimensions
  if (latestAnnotation.width < 0) {
    latestAnnotation.x += latestAnnotation.width;
    latestAnnotation.width = Math.abs(latestAnnotation.width);
  }

  if (latestAnnotation.height < 0) {
    latestAnnotation.y += latestAnnotation.height;
    latestAnnotation.height = Math.abs(latestAnnotation.height);
  }

  // Calculate boundary constraints
  const mousePos = annotator.stage.getPointerPosition() as Vector2d;
  const stageConfig = annotator.stageConfig;

  // Constrain dimensions if mouse is outside stage
  if (mousePos.x >= stageConfig.width)
    latestAnnotation.width =
      stageConfig.width / annotator.imageScale - latestAnnotation.x;
  if (mousePos.y >= stageConfig.height)
    latestAnnotation.height =
      stageConfig.height / annotator.imageScale - latestAnnotation.y;

  // Remove annotation if too small
  if (latestAnnotation.width < 5 || latestAnnotation.height < 5) {
    removeAnnotation({
      id: latestAnnotation.id,
      annotator: annotator,
      imageStore: imageStore,
      isNoVolume: true,
    });
    return;
  }

  adjustAnnotation(annotator, latestAnnotation, imageStore);
  annotator.innerToolBox.hide();
  annotator.saveState(imageStore.detections);
};

export {
  createAnnotation,
  leaveAnnotateRange,
  startEditAnnotationVolume,
  stopEditAnnotationVolume,
  removeAnnotation,
  startDragAnnotation,
  stopDragAnnotation,
  getAnnotationById,
  startResizeAnnotation,
  stopResizeAnnotation,
};
