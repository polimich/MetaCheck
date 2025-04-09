import { UnwrapNestedRefs } from 'vue';
import { Annotator } from 'src/service/annotator.ts';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { Container } from 'konva/lib/Container';
import type { Node } from 'konva/lib/Node';
import { useImageStore } from 'src/stores';
import { Vector2d } from 'konva/lib/types';
import { DetectionState, newDetectionState } from 'src/types';

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

  // Use precise positioning with fixed decimal places
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

  // Save the current state for undo/redo
  annotator.saveState(annotations);
};

function getLatestAnnotation(
  annotations: DetectionState[],
): DetectionState | undefined {
  return annotations.at(-1);
}

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
  // Instead of clamping, we'll update the position and dimensions later
  const width = Number((newX - oldX).toFixed(3));
  const height = Number((newY - oldY).toFixed(3));

  // Only update if there's an actual change to avoid unnecessary state changes
  if (
    width !== currentAnnotation.width ||
    height !== currentAnnotation.height
  ) {
    currentAnnotation.width = width;
    currentAnnotation.height = height;
    currentAnnotation.edited = true;
  }
};

const stopEditAnnotationVolume = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageStore: ReturnType<typeof useImageStore>,
) => {
  if (annotator.mode !== 'add') return;

  annotator.isAnnotating = false;
  const currentAnnotation = getLatestAnnotation(imageStore.detections);
  if (!currentAnnotation) return;

  // Before checking size, normalize negative dimensions
  // This ensures we have proper width/height for size check
  if (currentAnnotation.width < 0) {
    currentAnnotation.x += currentAnnotation.width;
    currentAnnotation.width = Math.abs(currentAnnotation.width);
  }

  if (currentAnnotation.height < 0) {
    currentAnnotation.y += currentAnnotation.height;
    currentAnnotation.height = Math.abs(currentAnnotation.height);
  }

  // Now handle case when the annotation is too small
  if (currentAnnotation.height < 5 || currentAnnotation.width < 5) {
    await removeAnnotation({
      id: currentAnnotation.id,
      annotator: annotator,
      imageStore: imageStore,
      isNoVolume: true,
    });
    return;
  }

  // Use direct draw for more consistent rendering
  annotator.stage.draw();

  // Adjust annotations to ensure they're within the boundaries
  adjustAnnotation(annotator, currentAnnotation, imageStore);

  if (annotator.transformer.nodes().length == 0)
    annotator.innerToolBox.updateAnnotation(currentAnnotation);

  annotator.innerToolBox.show(event.evt);

  // Save state for undo/redo
  annotator.saveState(imageStore.detections);
};

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

    // Destroy the visual representation
    parent.destroy();

    // Clear transformer and selection
    annotator.transformer.nodes([]);
    annotator.deselectAll();
    annotator.innerToolBox.hide();

    // Find and remove the annotation from the store
    const targetIndex = imageStore.detections.findIndex(
      (item) => item.id === id,
    );
    if (targetIndex === -1) {
      console.warn(`Annotation with id ${id} not found in store`);
      return;
    }

    // Add to delete list for backend sync
    imageStore.detectionsToDelete.push(imageStore.detections[targetIndex]);

    // Remove from current detections
    imageStore.detections.splice(targetIndex, 1);

    // Update the toolbox if we have any detections left
    if (imageStore.detections.length > 0) {
      annotator.innerToolBox.updateAnnotation(imageStore.detections.at(-1)!);
    }

    // Save state for undo/redo, but only if it's a deliberate deletion (not a zero-volume case)
    if (!isNoVolume) {
      annotator.saveState(imageStore.detections);
    }
  } catch (error) {
    console.error('Error removing annotation:', error);
  }
}

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

    // Prepare all changes to apply in one batch
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

    // Only adjust if outside boundaries to maintain precision
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

    // Apply all changes at once to minimize redraws
    if (Object.keys(nodeAttrs).length > 0) {
      annotationNode.setAttrs(nodeAttrs);
      // Use direct draw instead of batch draw
      annotator.stage.draw();
    }

    // Update store with the adjusted annotation
    const targetIndex = imageStore.detections.findIndex(
      (item) => item.id === currentAnnotation.id,
    );

    if (targetIndex === -1) {
      console.warn(
        `Annotation with id ${currentAnnotation.id} not found in store`,
      );
      return;
    }

    // Update all properties on the store version
    imageStore.detections[targetIndex].x = currentAnnotation.x;
    imageStore.detections[targetIndex].y = currentAnnotation.y;
    imageStore.detections[targetIndex].width = currentAnnotation.width;
    imageStore.detections[targetIndex].height = currentAnnotation.height;
    imageStore.detections[targetIndex].edited = true;
  } catch (error) {
    console.error('Error adjusting annotation:', error);
  }
}

// drag
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

function getAnnotationById(
  id: string,
  annotations: DetectionState[],
): DetectionState | undefined {
  return annotations.find((item) => item.id === id);
}

// Add a utility function for grid snapping
function snapToGrid(
  value: number,
  gridSize: number,
  enableSnapping = false,
): number {
  if (!enableSnapping) return value;
  return Math.round(value / gridSize) * gridSize;
}

const stopDragAnnotation = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: DetectionState[],
) => {
  const { id, x, y, height, width } = event.target.attrs;
  const { height: stageHeight, width: stageWidth } = annotator.stageConfig;
  const currentAnnotation = getAnnotationById(id, annotations);

  // check if the annotation is out of the stage
  if (!currentAnnotation) return;

  // Calculate boundaries
  const maxY = stageHeight / annotator.imageScale - height;
  const maxX = stageWidth / annotator.imageScale - width;

  // Define whether to use grid snapping - we'll set to false to maintain precision
  const enableGridSnapping = false; // Set to true if you want grid snapping
  const gridSize = 10; // Grid size in pixels, only used if enableGridSnapping is true

  // Store original position
  const originalX = x;
  const originalY = y;

  // Apply constraints but maintain precise position unless outside boundaries
  let newX = originalX;
  let newY = originalY;

  // Apply boundary constraints only
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

  // Apply grid snapping only if explicitly enabled
  if (enableGridSnapping) {
    newX = snapToGrid(newX, gridSize, enableGridSnapping);
    newY = snapToGrid(newY, gridSize, enableGridSnapping);
  }

  // Update the model with exact values
  currentAnnotation.x = newX;
  currentAnnotation.y = newY;
  currentAnnotation.edited = true;

  // Only update the Konva node if position actually changed
  if (newX !== originalX || newY !== originalY) {
    event.target.setAttrs({
      x: newX,
      y: newY,
    });
  }

  // Use direct draw instead of batch draw
  annotator.stage.draw();

  annotator.innerToolBox.show(event.evt);

  // Save state for undo/redo
  annotator.saveState(annotations);
};

// resize
const startResizeAnnotation = (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: DetectionState[],
) => {
  const target = event.target;
  const isShiftPressed = event.evt.shiftKey;

  if (target.getClassName() !== 'Rect') {
    // If not clicking on a rectangle and not holding shift, deselect all
    if (!isShiftPressed) {
      annotator.deselectAll();
    }
    return;
  }

  const currentAnnotation = getAnnotationById(target.attrs.id, annotations);
  if (!currentAnnotation) return;

  // Update the inner toolbox with the current annotation details
  annotator.innerToolBox.updateAnnotation(currentAnnotation);

  // Handle multi-selection with shift key
  if (isShiftPressed) {
    // Add to existing selection if shift is pressed
    annotator.selectAnnotation(currentAnnotation.id, true);
  } else {
    // Otherwise select only this one
    annotator.selectAnnotation(currentAnnotation.id, false);
  }

  // Show the toolbox at the event position
  annotator.innerToolBox.show(event.evt);
};

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

  // Calculate final dimensions with exact precision
  const newWidth = Number((eventWidth * scaleX).toFixed(3));
  const newHeight = Number((eventHeight * scaleY).toFixed(3));

  // Apply boundary constraints with precise values
  const { width: stageWidth, height: stageHeight } = annotator.stageConfig;
  const maxX = stageWidth / annotator.imageScale - newWidth;
  const maxY = stageHeight / annotator.imageScale - newHeight;

  // Get original values to check if we need to update
  const originalX = eventX;
  const originalY = eventY;

  // Calculate new positions with constraints
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

  // Update model with precise values
  currentAnnotation.x = Number(newX.toFixed(3));
  currentAnnotation.y = Number(newY.toFixed(3));
  currentAnnotation.width = newWidth;
  currentAnnotation.height = newHeight;
  currentAnnotation.edited = true;

  // Reset scale to avoid compound scaling and apply precise positioning
  target.setAttrs({
    x: currentAnnotation.x,
    y: currentAnnotation.y,
    width: currentAnnotation.width,
    height: currentAnnotation.height,
    scaleX: 1,
    scaleY: 1,
  });

  // Use direct draw instead of batch draw
  annotator.stage.draw();

  annotator.innerToolBox.show(event.evt);

  // Save state for undo/redo
  annotator.saveState(annotations);
};

const leaveAnnotateRange = (
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageStore: ReturnType<typeof useImageStore>,
) => {
  if (annotator.mode !== 'add') return;
  if (!annotator.isAnnotating) return;
  annotator.isAnnotating = false;

  const latestAnnotation = getLatestAnnotation(imageStore.detections);
  if (!latestAnnotation) return;

  // First normalize any negative dimensions
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

  // If mouse position is outside the stage, constrain the annotation dimensions
  if (mousePos.x >= stageConfig.width)
    latestAnnotation.width =
      stageConfig.width / annotator.imageScale - latestAnnotation.x;
  if (mousePos.y >= stageConfig.height)
    latestAnnotation.height =
      stageConfig.height / annotator.imageScale - latestAnnotation.y;

  // If the annotation has no meaningful size, remove it
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

  // Save state for undo/redo
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
