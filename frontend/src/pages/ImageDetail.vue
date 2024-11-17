<script setup lang="ts">
import { useRoute } from 'vue-router';
import { getRasterImage } from 'utils';
import { onBeforeMount, onMounted, reactive, Ref, ref, watch } from 'vue';
import { useImageStore } from 'src/stores';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { Stage } from 'konva/lib/Stage';
import type { Node } from 'konva/lib/Node';
import {
  Annotator,
  Annotation,
  enterAnnotatorBox,
  leaveAnnotatorBox,
} from 'src/service/annotator.ts';
import Konva from 'konva';
import Container = Konva.Container;
import { Vector2d } from 'konva/lib/types';
import { createAnnotation } from 'src/service/annotation.ts';

const route = useRoute();
const imageStore = useImageStore();
const imageId = route.params.imageId as string;
const imageUrl = getRasterImage(imageId);
const imageScale = ref<number>(1);
imageStore.loadImage(imageId);
imageStore.loadDetections(imageId);
console.log('setup');
// Reactive variables
const annotatorBox: Ref<HTMLDivElement | null> = ref(null);

const isMounted = ref(false);
const stage = ref<Stage | null>(null);
const loading = ref(false);
const dataLoaded = ref(false);
const annotator = reactive(new Annotator());

const annotations = ref<Annotation[]>([]);

// resize observer
let resizeObserver: ResizeObserver | null = null;
function setupResizeObserver() {
  if (!annotatorBox.value) return;

  resizeObserver = new ResizeObserver(async () => {
    await init();
  });

  resizeObserver.observe(annotatorBox.value);
}
// functions

const init = async (): Promise<void> => {
  if (!isMounted.value) return;
  if (!dataLoaded.value) return;
  if (!annotatorBox.value) return;
  annotations.value = imageStore.annotations;
  await initAnnotator(annotatorBox.value, imageUrl, annotations.value);
};

const initAnnotator = async (
  container: Element,
  url: string,
  annotations: Annotation[],
): Promise<void> => {
  loading.value = true;
  await annotator.initImageSetting(container, url);
  annotator.initCanvas(stage.value);
  if (annotations.length >= 1) {
    annotator.innerToolBox.updateAnnotation(annotations[0]);
  }
  loading.value = false;
};

// markboxes

// create annotation
// const createAnnotation = () => {
//   console.log('createAnnotation');
//   if (annotator.mode !== 'add') return;
//   const pointerPosition = annotator.layer.getRelativePointerPosition();
//   if (!pointerPosition) return;
//   const { x, y } = pointerPosition;
//   const newAnnotation = new Annotation();
//   newAnnotation.image_id = imageId;
//   newAnnotation.x = x > 0 ? x : 0;
//   newAnnotation.y = y > 0 ? y : 0;
//   annotations.value.push(newAnnotation);
//   annotator.innerToolBox.updateAnnotation(newAnnotation);
//   annotator.isAnnotating = true;
// };

const editAnnotationVolume = (): void => {
  console.log('editAnnotationVolume');
  if (annotator.mode !== 'add') return;
  if (!annotator.isAnnotating) return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;
  const { x: newX, y: newY } = pointerPosition;
  const currentAnnotation = getLatestAnnotation();
  if (!currentAnnotation) return;
  const { x: oldX, y: oldY } = currentAnnotation;
  currentAnnotation.width = newX - oldX;
  currentAnnotation.height = newY - oldY;
};

const stopEditAnnotationVolume = (event: KonvaPointerEvent) => {
  console.log('stopEditAnnotationVolume');
  if (annotator.mode !== 'add') return;

  annotator.isAnnotating = false;
  const currentAnnotation = getLatestAnnotation();
  if (!currentAnnotation) return;

  if (currentAnnotation.height === 0 || currentAnnotation.width === 0) {
    removeAnnotation(currentAnnotation.id);
    return;
  }

  adjustAnnotation(event.target, currentAnnotation);

  if (annotator.transformer.nodes().length == 0)
    annotator.innerToolBox.updateAnnotation(currentAnnotation);

  annotator.innerToolBox.show(event.evt);
};

const leaveAnnotateRange = () => {};

//drag Annotation
const startDragAnnotation = (event: KonvaPointerEvent) => {
  console.log('startDragAnnotation');
  annotator.innerToolBox.hide();

  const { x, y, id } = event.target.attrs;
  const currentAnnotation = getAnnotationById(id, annotations.value);
  if (!currentAnnotation) return;
  currentAnnotation.x = x / imageScale.value;
  currentAnnotation.y = y / imageScale.value;
};

const stopDragAnnotation = (event: KonvaPointerEvent) => {
  console.log('stopDragAnnotation');
  const { id, x, y, height, width } = event.target.attrs;
  const { height: stageHeight, width: stageWidth } = annotator.stageConfig;
  const currentAnnotation = getAnnotationById(id, annotations.value);

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
  // TODO save annotation to database
};

function updateTransformerContent(id: string, evt: MouseEvent): void {
  console.log('updateTransformerContent');
  const node = annotator.stage.findOne(`#${id}`);
  if (!node) return;
  annotator.transformer.nodes([node]);
  annotator.innerToolBox.show(evt);
}

const startResizeAnnotation = (event: KonvaPointerEvent) => {
  console.log('startResizeAnnotation');
  const target = event.target;

  if (target.getClassName() !== 'Rect') {
    annotator.transformer.nodes([]);
    annotator.innerToolBox.hide();
    return;
  }

  const currentAnnotation = getAnnotationById(
    target.attrs.id,
    annotations.value,
  );
  if (!currentAnnotation) return;

  annotator.innerToolBox.updateAnnotation(currentAnnotation);
  updateTransformerContent(currentAnnotation.id, event.evt);
};

const stopResizeAnnotation = (event: KonvaPointerEvent) => {
  console.log('stopResizeAnnotation');
  const {
    id: eventId,
    x: eventX,
    y: eventY,
    scaleX,
    scaleY,
  } = event.target.attrs;

  const currentAnnotation = getAnnotationById(eventId, annotations.value);
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
  console.log('stopResizeAnnotation', currentAnnotation);
  // TODO save annotation to database
};

// resize layer
const wheelResizeLayer = (event: KonvaPointerEvent) => {
  console.log('wheelResizeLayer');
  // wheel event
  const wheel = event.evt as MouseEvent as WheelEvent;
  wheel.preventDefault();

  const altKey = wheel.altKey;
  if (!altKey) return;
  const direction = wheel.deltaY;

  //layer resize
  const oldScale = annotator.layer.scaleX();
  const scaleBy = 1.05;
  const newScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;
  annotator.layer.scale({ x: newScale, y: newScale });

  // layer position
  const pointerPosition = annotator.stage.getPointerPosition() as Vector2d;

  const mousePointTo = {
    x: (pointerPosition.x - annotator.layer.x()) / oldScale,
    y: (pointerPosition.y - annotator.layer.y()) / oldScale,
  };
  const newPos = {
    x: pointerPosition.x - mousePointTo.x * newScale,
    y: pointerPosition.y - mousePointTo.y * newScale,
  };
  annotator.layer.position(newPos);
};

const dragLayer = () => {
  console.log('dragLayer');
  annotator.innerToolBox.hide();
};

const resetLayerPosition = () => {
  console.log('resetLayerPosition');
  annotator.layer.setAttrs({
    x: 0,
    y: 0,
    scaleX: annotator.imageScale,
    scaleY: annotator.imageScale,
  });
  annotator.innerToolBox.hide();
};

//

function getAnnotationById(
  id: string,
  annotations: Annotation[],
): Annotation | undefined {
  console.log('getAnnotationById');
  return annotations.find((item) => item.id === id);
}

function getLatestAnnotation(): Annotation | undefined {
  console.log('getLatestAnnotation');
  return annotations.value.at(-1);
}

function removeAnnotation(id: string) {
  console.log('remove annotation', id);
  const rect = annotator.stage.findOne(`#${id}`);
  // console.log('stage', annotator.stage);
  // console.log('id', id);
  // console.log('2', rect);

  if (!rect) return;
  const parent = rect.findAncestor('Group') as Container;
  parent.destroy();
  annotator.transformer.nodes([]);

  annotator.innerToolBox.hide();
  const targetIndex = annotations.value.findIndex((item) => item.id === id);
  if (targetIndex === -1) return;
  annotations.value.splice(targetIndex, 1);
  if (annotations.value.length === 0) return;
  annotator.innerToolBox.updateAnnotation(annotations.value.at(-1)!);
  //TODO save annotation to database
}

function adjustAnnotation(node: Node, currentAnnotation: Annotation) {
  console.log('adjustAnnotation');
  const {
    x: nodeX,
    y: nodeY,
    width: shapeWidth,
    height: shapeHeight,
  } = node.attrs;
  if (shapeWidth < 0) {
    const newX = nodeX + shapeWidth;
    const newWidth = Math.abs(shapeWidth);
    node.setAttrs({ x: newX, width: newWidth });
    currentAnnotation.x = newX;
    currentAnnotation.width = newWidth;
  }

  if (shapeHeight < 0) {
    const newY = nodeY + shapeHeight;
    const newHeight = Math.abs(shapeHeight);
    node.setAttrs({ y: newY, height: newHeight });
    currentAnnotation.y = newY;
    currentAnnotation.height = newHeight;
  }
  // TODO save annotation to database
}

function handleKeyDownEvent(event: KeyboardEvent) {
  console.log('handleKeyDownEvent');
  const key = event.key.toUpperCase();
  console.log(key);
  switch (key) {
    case 'W':
      // annotating
      annotator.changeAnnotateMode('add');
      break;
    case 'E':
      // dragging
      annotator.changeAnnotateMode('drag');
      break;
    case 'BACKSPACE':
    case 'DELETE':
    case 'DEL':
      if (annotations.value.length === 0) return;
      if (annotator.innerToolBox.getAnnotationId() === '') return;
      removeAnnotation(annotator.innerToolBox.getAnnotationId());
      break;
    case 'Z':
      resetLayerPosition();
      break;
    default:
      break;
  }
}

// lifecycle
onBeforeMount(async () => {
  dataLoaded.value = false;
  await imageStore.loadImage(imageId);
  await imageStore.loadDetections(imageId);
  dataLoaded.value = true;
});

onMounted(async () => {
  console.log('mounted');
  isMounted.value = true;
  setupResizeObserver();
  await init();
  console.log('mounted end');
});

watch(dataLoaded, async () => {
  await init();
});

const save = async () => {
  await imageStore.createOrUpdateDetections(imageId);
};
</script>

<template>
  <!--  <q-img :src="getRasterImage(imageId)" id="img" />-->

  <div class="full-width row wrap container">
    <div
      class="annotator"
      ref="annotatorBox"
      tabindex="0"
      @mouseover="enterAnnotatorBox(annotatorBox)"
      @mouseleave="leaveAnnotatorBox(annotator)"
      @keydown="handleKeyDownEvent"
    >
      <v-stage
        :config="annotator.stageConfig"
        ref="stage"
        @mousedown="startResizeAnnotation"
      >
        <v-layer
          :config="annotator.layerConfig"
          @mousemove="editAnnotationVolume"
          @mouseup="stopEditAnnotationVolume"
          @mouseleave="leaveAnnotateRange"
          @wheel="wheelResizeLayer"
          @dragmove="dragLayer"
        >
          <v-image
            :config="annotator.imageConfig"
            @mousedown="createAnnotation(annotator, imageId, annotations)"
          />
          <v-group
            v-for="item in annotations"
            :key="item.id"
            :config="{ name: item.id, visible: true }"
          >
            <v-rect
              :config="{
                id: item.id,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                stroke: '#000000',
                draggable: true,
                fill: 'rgba(0,0,0,0.3)',
              }"
              @dragmove="startDragAnnotation"
              @dragend="stopDragAnnotation"
              @transformend="stopResizeAnnotation"
            />
          </v-group>
          <v-transformer :config="annotator.transformerConfig" />
        </v-layer>
      </v-stage>
    </div>
  </div>
  <div class="row">
    <q-btn @click="save" class="absolute top-0 right-0" icon="save">
      Save
    </q-btn>
  </div>
</template>
<style>
.annotator {
  min-width: 100%;
  max-width: 100%;
}
.q-page-container {
  height: 100vh;
}
.container {
  height: 100%;
}
</style>
