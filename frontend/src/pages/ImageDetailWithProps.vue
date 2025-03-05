<script setup lang="ts">
import { useRoute } from 'vue-router';
import { getRasterImage } from 'utils';
import { onBeforeMount, onMounted, reactive, Ref, ref, watch } from 'vue';
import { useImageStore } from 'src/stores';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { Stage } from 'konva/lib/Stage';
import {
  Annotator,
  enterAnnotatorBox,
  leaveAnnotatorBox,
} from 'src/service/annotator.ts';
import { Vector2d } from 'konva/lib/types';
import {
  createAnnotation,
  startEditAnnotationVolume,
  removeAnnotation,
  startDragAnnotation,
  startResizeAnnotation,
  stopDragAnnotation,
  stopEditAnnotationVolume,
  stopResizeAnnotation,
  leaveAnnotateRange,
} from 'src/service/annotation.ts';
import { DetectionState } from 'src/types';

const props = defineProps({
  imageId: String,
});

const route = useRoute();
const imageStore = useImageStore();
// const currentCollectionState = useCurrentCollectionState();
// const collectionDA = useCollectionDataAccess();
const imageId = props.imageId ?? (route.params.imageId as string);
const imageUrl = getRasterImage(imageId);

// Reactive variables
const annotatorBox: Ref<HTMLDivElement | null> = ref(null);
const isMounted = ref(false);
const stage = ref<Stage | null>(null);
const loading = ref(false);
const dataLoaded = ref(false);
const annotator = reactive(new Annotator());

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
  if (imageStore.detections) {
    await initAnnotator(annotatorBox.value, imageUrl, imageStore.detections);
  }
};

const initAnnotator = async (
  container: Element,
  url: string,
  annotations: DetectionState[],
): Promise<void> => {
  loading.value = true;
  await annotator.initImageSetting(container, url);
  annotator.initCanvas(stage.value);
  if (annotations.length >= 1) {
    annotator.innerToolBox.updateAnnotation(annotations[0]);
  }
  loading.value = false;
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
  // annotator.innerToolBox.hide();
};

const resetLayerPosition = () => {
  annotator.layer.setAttrs({
    x: 0,
    y: 0,
    scaleX: annotator.imageScale,
    scaleY: annotator.imageScale,
  });
  annotator.innerToolBox.hide();
};

async function handleKeyDownEvent(event: KeyboardEvent) {
  const key = event.key.toUpperCase();
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
      if (imageStore.detections?.length === 0) return;
      if (annotator.innerToolBox.getAnnotationId() === '') return;
      await removeAnnotation({
        id: annotator.innerToolBox.getAnnotationId(),
        annotator: annotator,
        imageStore: imageStore,
      });
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
  await imageStore.loadImage(imageId, route.params.collectionId as string);
  await imageStore.loadDetections(imageId);
  dataLoaded.value = true;
});

onMounted(async () => {
  isMounted.value = true;
  setupResizeObserver();
  await init();
});

watch(dataLoaded, async () => {
  await init();
});

watch(imageStore, async () => {
  await init();
});

const save = async () => {
  imageStore.detections.forEach((detection) => {
    console.log(detection.edited);
  });
  console.log(imageStore.detectionsToDelete);
  await imageStore.saveImage();
  // TODO: go through collectionState, find edited objects call individual endpoints to update, create, delete everything
  // TODO: from collection from db and fe state
};

function addAlpha(color: string, opacity: number) {
  // coerce values so it is between 0 and 1.
  let _opacity = Math.round(Math.min(Math.max(opacity ?? 1, 0), 1) * 255);
  return color + _opacity.toString(16).toUpperCase();
}
</script>

<template>
  <div class="full-width row wrap container">
    <div
      class="annotator"
      ref="annotatorBox"
      tabindex="1"
      @mouseover="enterAnnotatorBox(annotatorBox)"
      @mouseleave="leaveAnnotatorBox(annotator)"
      @keydown="handleKeyDownEvent"
    >
      <v-stage
        :config="annotator.stageConfig"
        ref="stage"
        @mousedown="
          (event: KonvaPointerEvent) =>
            startResizeAnnotation(event, annotator, imageStore.detections)
        "
      >
        <v-layer
          :config="annotator.layerConfig"
          @mousemove="
            startEditAnnotationVolume(annotator, imageStore.detections)
          "
          @mouseup="
            (event: KonvaPointerEvent) =>
              stopEditAnnotationVolume(event, annotator, imageStore)
          "
          @mouseleave="leaveAnnotateRange(annotator, imageStore)"
          @wheel="wheelResizeLayer"
          @dragmove="dragLayer"
        >
          <v-image
            :config="annotator.imageConfig"
            @mousedown="
              createAnnotation(annotator, imageId, imageStore.detections)
            "
          />
          <v-group
            v-for="item in imageStore.detections"
            :key="item.id"
            :config="{ name: item.id, visible: true }"
          >
            <v-rect
              :config="{
                id: item.id,
                x: item.x,
                y: item.y,
                stroke: item.type.color,
                width: item.width,
                height: item.height,
                draggable: true,
                fill: addAlpha(item.type.color, 0.3),
              }"
              @dragmove="
                (event: KonvaPointerEvent) =>
                  startDragAnnotation(event, annotator, imageStore.detections)
              "
              @dragend="
                (event: KonvaPointerEvent) =>
                  stopDragAnnotation(event, annotator, imageStore.detections)
              "
              @transformend="
                (event: KonvaPointerEvent) =>
                  stopResizeAnnotation(event, annotator, imageStore.detections)
              "
            />
          </v-group>
          <v-transformer :config="annotator.transformerConfig" />
        </v-layer>
      </v-stage>
    </div>
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

.container {
  height: 100%;
}
</style>
