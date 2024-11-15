<script setup lang="ts">
import { useRoute } from 'vue-router';
import { getRasterImage } from 'utils';
import { onBeforeMount, onMounted, reactive, Ref, ref } from 'vue';
import { useImageStore } from 'src/stores';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { Stage } from 'konva/lib/Stage';
import type { Node } from 'konva/lib/Node';
import { Annotator, Markbox } from 'src/service/annotator.ts';
import Konva from 'konva';
import Container = Konva.Container;
import { Vector2d } from 'konva/lib/types';

const route = useRoute();
const imageStore = useImageStore();
// Reactive variables
const annotatorBox: Ref<HTMLDivElement | null> = ref(null);

const isMounted = ref(false);
const stage = ref<Stage | null>(null);
const loading = ref(false);
const annotator = reactive(new Annotator());
const imageId = route.params.imageId as string;
const imageUrl = getRasterImage(imageId);
const imageScale = ref<number>(1);
let resizeObserver: ResizeObserver | null = null;

const markboxes: Markbox[] = reactive([
  {
    id: '1',
    labelName: 'test',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  },
]);

// functions
// responsive
function setupResizeObserver() {
  if (!annotatorBox.value) return;

  resizeObserver = new ResizeObserver(async () => {
    await init();
  });

  resizeObserver.observe(annotatorBox.value);
}

const init = async (): Promise<void> => {
  if (!isMounted.value) return;
  // TODO: get markboxes from API
  if (!annotatorBox.value) return;
  await initAnnotator(annotatorBox.value, imageUrl, markboxes);
};

const initAnnotator = async (
  container: Element,
  url: string,
  markboxes: Markbox[],
): Promise<void> => {
  loading.value = true;
  await annotator.initImageSetting(container, url);
  annotator.initCanvas(stage.value);
  if (markboxes.length >= 1) {
    annotator.innerToolBox.updateMarkbox(markboxes[0]);
  }
  loading.value = false;
};

// markboxes

// anotator box
function enterAnnotatorBox() {
  if (!annotatorBox.value) return;
  annotatorBox.value.focus();
}

function leaveAnnotatorBox() {
  document.body.style.cursor = 'auto';
  annotator.innerToolBox.hidden();
  // save markbox to database
}
// create markbox
const createMarkbox = () => {
  if (annotator.mode !== 'add') return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;
  const { x, y } = pointerPosition;
  console.log('x, y', x, y);
  const markbox = new Markbox();
  markbox.x = x > 0 ? x : 0;
  markbox.y = y > 0 ? y : 0;
  markboxes.push(markbox);
  annotator.innerToolBox.updateMarkbox(markbox);
  annotator.isAnnotating = true;
};

const editMarkboxVolume = (): void => {
  if (annotator.mode !== 'add') return;
  if (!annotator.isAnnotating) return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;
  const { x: newX, y: newY } = pointerPosition;
  const markbox = getLastestMarkbox();
  if (!markbox) return;
  const { x: oldX, y: oldY } = markbox;
  markbox.width = newX - oldX;
  markbox.height = newY - oldY;
};

const stopEditMarkboxVolume = (event: KonvaPointerEvent) => {
  if (annotator.mode !== 'add') return;

  annotator.isAnnotating = false;
  const markbox = getLastestMarkbox();
  if (!markbox) return;

  if (markbox.height === 0 || markbox.width === 0) {
    removeMarkbox(markbox.id);
    return;
  }

  adjustMarkbox(event.target, markbox);

  if (annotator.transformer.nodes().length == 0)
    annotator.innerToolBox.updateMarkbox(markbox);

  annotator.innerToolBox.show(event.evt);
};

const leaveAnnotateRange = () => {};

//drag markbox
const startDragMarkbox = (event: KonvaPointerEvent) => {
  annotator.innerToolBox.hidden();

  const { x, y, id } = event.target.attrs;
  const markbox = getMarkboxById(id);
  if (!markbox) return;
  markbox.x = x / imageScale.value;
  markbox.y = y / imageScale.value;
};

const stopDragMarkbox = (event: KonvaPointerEvent) => {
  const { id, x, y, height, width } = event.target.attrs;
  const { height: stageHeight, width: stageWidth } = annotator.stageConfig;
  const markbox = getMarkboxById(id);

  if (!markbox) return;
  if (markbox.y < 0) {
    markbox.y = 0;
  } else if (markbox.y + height > stageHeight / annotator.imageScale) {
    markbox.y = stageHeight / annotator.imageScale - height;
  } else {
    markbox.y = y;
  }

  if (markbox.x < 0) {
    markbox.x = 0;
  } else if (markbox.x + width > stageWidth / annotator.imageScale) {
    markbox.x = stageWidth / annotator.imageScale - width;
  } else {
    markbox.x = x;
  }

  annotator.innerToolBox.show(event.evt);
  // TODO save markbox to database
};

function updateTransformerContent(id: string, evt: MouseEvent): void {
  const node = annotator.stage.findOne(`#${id}`);
  if (!node) return;
  annotator.transformer.nodes([node]);
  annotator.innerToolBox.show(evt);
}

const startResizeMarkbox = (event: KonvaPointerEvent) => {
  const target = event.target;

  if (target.getClassName() !== 'Rect') {
    annotator.transformer.nodes([]);
    annotator.innerToolBox.hidden();
    return;
  }

  const markbox = getMarkboxById(target.attrs.id);
  if (!markbox) return;

  annotator.innerToolBox.updateMarkbox(markbox);
  updateTransformerContent(markbox.id, event.evt);
};

const stopResizeMarkbox = (event: KonvaPointerEvent) => {
  const {
    id: eventId,
    x: eventX,
    y: eventY,
    scaleX,
    scaleY,
  } = event.target.attrs;

  const markbox = getMarkboxById(eventId);
  if (!markbox) return;

  if (scaleX.toFixed(5) !== '1') markbox.width *= scaleX;
  if (scaleY.toFixed(5) !== '1') markbox.height *= scaleY;

  markbox.x = eventX;
  markbox.y = eventY;

  event.target.setAttrs({
    x: eventX,
    y: eventY,
    scaleX: 1,
    scaleY: 1,
  });
  annotator.innerToolBox.show(event.evt);
  console.log('stopResizeMarkbox', markbox);
  // TODO save markbox to database
};

// resize layer
const wheelResizeLayer = (event: KonvaPointerEvent) => {
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
  annotator.innerToolBox.hidden();
};

const resetLayerPosition = () => {
  annotator.layer.setAttrs({
    x: 0,
    y: 0,
    scaleX: annotator.imageScale,
    scaleY: annotator.imageScale,
  });
  annotator.innerToolBox.hidden();
};

//

function getMarkboxById(id: string): Markbox | undefined {
  return markboxes.find((item) => item.id === id);
}

function getLastestMarkbox(): Markbox | undefined {
  return markboxes.at(-1);
}

function removeMarkbox(id: string) {
  console.log('remove markbox', id);
  const rect = annotator.stage.findOne(`#${id}`);
  if (!rect) return;
  const parent = rect.findAncestor('Group') as Container;
  parent.destroy();
  annotator.transformer.nodes([]);

  annotator.innerToolBox.hidden();
  const targetIndex = markboxes.findIndex((item) => item.id === id);
  if (targetIndex === -1) return;
  markboxes.splice(targetIndex, 1);
  if (markboxes.length === 0) return;
  annotator.innerToolBox.updateMarkbox(markboxes.at(-1)!);
  //TODO save markbox to database
  console.log(markboxes);
  // emits("saveMarkbox", props.file.name, markboxes);
}

function adjustMarkbox(node: Node, markbox: Markbox) {
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
    markbox.x = newX;
    markbox.width = newWidth;
  }

  if (shapeHeight < 0) {
    const newY = nodeY + shapeHeight;
    const newHeight = Math.abs(shapeHeight);
    node.setAttrs({ y: newY, height: newHeight });
    markbox.y = newY;
    markbox.height = newHeight;
  }
  // TODO save markbox to database
}

function handleKeyDownEvent(event: KeyboardEvent) {
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
      if (markboxes.length === 0) return;
      if (annotator.innerToolBox.getMarkboxId() === '') return;
      removeMarkbox(annotator.innerToolBox.getMarkboxId());
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
  await imageStore.loadImage(imageId);
  // configKonva.value.width = imageStore.image?.width as number;
  // configKonva.value.height = imageStore.image?.height as number;
});

onMounted(async () => {
  isMounted.value = true;
  await init();
  setupResizeObserver();
});
</script>

<template>
  <!--  <q-img :src="getRasterImage(imageId)" id="img" />-->
  <div class="full-width row wrap container">
    <div
      class="annotator"
      ref="annotatorBox"
      tabindex="0"
      @mouseover="enterAnnotatorBox"
      @mouseleave="leaveAnnotatorBox"
      @keydown="handleKeyDownEvent"
    >
      <v-stage
        :config="annotator.stageConfig"
        ref="stage"
        @mousedown="startResizeMarkbox"
      >
        <v-layer
          :config="annotator.layerConfig"
          @mousemove="editMarkboxVolume"
          @mouseup="stopEditMarkboxVolume"
          @mouseleave="leaveAnnotateRange"
          @wheel="wheelResizeLayer"
          @dragmove="dragLayer"
        >
          <v-image :config="annotator.imageConfig" @mousedown="createMarkbox" />
          <v-group
            v-for="item in markboxes"
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
              }"
              @dragmove="startDragMarkbox"
              @dragend="stopDragMarkbox"
              @transformend="stopResizeMarkbox"
            />
          </v-group>
          <v-transformer :config="annotator.transformerConfig" />
        </v-layer>
      </v-stage>
    </div>
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
