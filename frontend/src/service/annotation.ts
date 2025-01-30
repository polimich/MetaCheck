import { v4 as uuidv4 } from 'uuid';
import { UnwrapNestedRefs } from 'vue';
import { Annotator } from 'src/service/annotator.ts';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { Container } from 'konva/lib/Container';
import type { Node } from 'konva/lib/Node';
import { useImageStore } from 'src/stores';
import { Vector2d } from 'konva/lib/types';

export class Annotation {
  id = uuidv4();
  image_id = '';
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  confidence = 0;
  annotated = false;
  type = '';
  created_date = Date.now().toString();
  last_change = Date.now().toString();
  last_access = Date.now().toString();
  deleted = false;
  color = '';
}

const createAnnotation = async (
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageId: string,
  annotations: Annotation[],
) => {
  if (annotator.mode !== 'add') return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;
  const { x, y } = pointerPosition;
  const newAnnotation = new Annotation();
  newAnnotation.image_id = imageId;
  newAnnotation.x = x > 0 ? x : 0;
  newAnnotation.y = y > 0 ? y : 0;
  annotations.push(newAnnotation);
  annotator.innerToolBox.updateAnnotation(newAnnotation);
  annotator.isAnnotating = true;
};

function getLatestAnnotation(
  annotations: Annotation[],
): Annotation | undefined {
  return annotations.at(-1);
}

const startEditAnnotationVolume = (
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: Annotation[],
): void => {
  if (annotator.mode !== 'add') return;
  if (!annotator.isAnnotating) return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;
  const { x: newX, y: newY } = pointerPosition;
  const currentAnnotation = getLatestAnnotation(annotations);
  if (!currentAnnotation) return;
  const { x: oldX, y: oldY } = currentAnnotation;
  currentAnnotation.width = newX - oldX;
  currentAnnotation.height = newY - oldY;
};

const stopEditAnnotationVolume = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageStore: ReturnType<typeof useImageStore>,
) => {
  if (annotator.mode !== 'add') return;

  annotator.isAnnotating = false;
  const currentAnnotation = getLatestAnnotation(imageStore.annotations);
  if (!currentAnnotation) return;

  if (currentAnnotation.height === 0 || currentAnnotation.width === 0) {
    await removeAnnotation({
      id: currentAnnotation.id,
      annotator: annotator,
      imageStore: imageStore,
      isNoVolume: true,
    });
    return;
  }

  adjustAnnotation(annotator, currentAnnotation, imageStore);

  if (annotator.transformer.nodes().length == 0)
    annotator.innerToolBox.updateAnnotation(currentAnnotation);

  annotator.innerToolBox.show(event.evt);
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
  const rect = annotator.stage.findOne(`#${id}`);
  if (!rect) return;

  const parent = rect.findAncestor('Group') as Container;
  parent.destroy();
  annotator.transformer.nodes([]);

  annotator.innerToolBox.hide();
  const targetIndex = imageStore.annotations.findIndex(
    (item) => item.id === id,
  );
  if (targetIndex === -1) return;
  imageStore.annotations.splice(targetIndex, 1);
  if (imageStore.annotations.length === 0) return;
  annotator.innerToolBox.updateAnnotation(imageStore.annotations.at(-1)!);
  if (isNoVolume) return;
  await imageStore.deleteDetection(id);
}

function adjustAnnotation(
  annotator: UnwrapNestedRefs<Annotator> & object,
  currentAnnotation: Annotation,
  imageStore: ReturnType<typeof useImageStore>,
) {
  const annotationNode = annotator.stage.findOne(
    (node: Node) =>
      node.attrs.id === currentAnnotation.id && node.getClassName() === 'Rect',
  );

  console.log('annotationNode', annotationNode);

  if (!annotationNode) return;
  const {
    x: nodeX,
    y: nodeY,
    width: shapeWidth,
    height: shapeHeight,
  } = annotationNode.attrs;

  if (shapeWidth < 0) {
    const newX = nodeX + shapeWidth;
    const newWidth = Math.abs(shapeWidth);
    console.log('newX', newX, 'newWidth', newWidth);
    annotationNode.setAttrs({ x: newX, width: newWidth });
    currentAnnotation.x = newX;
    currentAnnotation.width = newWidth;
  }

  if (shapeHeight < 0) {
    const newY = nodeY + shapeHeight;
    const newHeight = Math.abs(shapeHeight);
    annotationNode.setAttrs({ y: newY, height: newHeight });
    currentAnnotation.y = newY;
    currentAnnotation.height = newHeight;
  }

  // save into store
  imageStore.annotations.forEach((item) => {
    if (item.id === currentAnnotation.id) {
      item.x = currentAnnotation.x;
      item.y = currentAnnotation.y;
      item.width = currentAnnotation.width;
      item.height = currentAnnotation.height;
    }
  });

  console.log(
    imageStore.annotations.map((item) => {
      if (item.id === currentAnnotation.id) {
        return item;
      }
    }),
  );
}
// drag
const startDragAnnotation = (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: Annotation[],
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
  annotations: Annotation[],
): Annotation | undefined {
  return annotations.find((item) => item.id === id);
}

const stopDragAnnotation = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: Annotation[],
) => {
  const { id, x, y, height, width } = event.target.attrs;
  const { height: stageHeight, width: stageWidth } = annotator.stageConfig;
  const currentAnnotation = getAnnotationById(id, annotations);
  console.log(currentAnnotation);
  // check if the annotation is out of the stage
  if (!currentAnnotation) return;
  if (currentAnnotation.y < 0) {
    currentAnnotation.y = 0;
  } else if (
    currentAnnotation.y + height >
    stageHeight / annotator.imageScale
  ) {
    currentAnnotation.y = stageHeight / annotator.imageScale - height;
  } else {
    currentAnnotation.y = y;
  }

  if (currentAnnotation.x < 0) {
    currentAnnotation.x = 0;
  } else if (currentAnnotation.x + width > stageWidth / annotator.imageScale) {
    currentAnnotation.x = stageWidth / annotator.imageScale - width;
  } else {
    currentAnnotation.x = x;
  }

  annotator.innerToolBox.show(event.evt);
};

// resize
const startResizeAnnotation = (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: Annotation[],
) => {
  const target = event.target;

  if (target.getClassName() !== 'Rect') {
    annotator.transformer.nodes([]);
    annotator.innerToolBox.hide();
    return;
  }

  const currentAnnotation = getAnnotationById(target.attrs.id, annotations);
  if (!currentAnnotation) return;

  annotator.innerToolBox.updateAnnotation(currentAnnotation);
  updateTransformerContent(currentAnnotation.id, event.evt, annotator);
};

const stopResizeAnnotation = async (
  event: KonvaPointerEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
  annotations: Annotation[],
) => {
  const {
    id: eventId,
    x: eventX,
    y: eventY,
    scaleX,
    scaleY,
  } = event.target.attrs;

  const currentAnnotation = getAnnotationById(eventId, annotations);
  if (!currentAnnotation) return;

  if (scaleX.toFixed(5) !== '1') currentAnnotation.width *= scaleX;
  if (scaleY.toFixed(5) !== '1') currentAnnotation.height *= scaleY;

  currentAnnotation.x = eventX;
  currentAnnotation.y = eventY;

  event.target.setAttrs({
    x: eventX,
    y: eventY,
    scaleX: 1,
    scaleY: 1,
  });
  annotator.innerToolBox.show(event.evt);
};

function updateTransformerContent(
  id: string,
  evt: MouseEvent,
  annotator: UnwrapNestedRefs<Annotator> & object,
): void {
  const node = annotator.stage.findOne(`#${id}`);
  if (!node) return;
  annotator.transformer.nodes([node]);
  annotator.innerToolBox.show(evt);
}

const leaveAnnotateRange = (
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageStore: ReturnType<typeof useImageStore>,
) => {
  if (annotator.mode !== 'add') return;
  if (!annotator.isAnnotating) return;
  annotator.isAnnotating = false;

  const latestAnnotation = getLatestAnnotation(imageStore.annotations);
  if (!latestAnnotation) return;

  const mousePos = annotator.stage.getPointerPosition() as Vector2d;
  const stageConfig = annotator.stageConfig;
  if (mousePos.x >= stageConfig.width)
    latestAnnotation.width = stageConfig.width - latestAnnotation.x;
  if (mousePos.y >= stageConfig.height)
    latestAnnotation.height = stageConfig.height - latestAnnotation.y;

  adjustAnnotation(annotator, latestAnnotation, imageStore);
  annotator.innerToolBox.hide();
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
