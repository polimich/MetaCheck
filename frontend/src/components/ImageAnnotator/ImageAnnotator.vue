<script setup lang="ts">
import { useRoute } from 'vue-router';
import { getRasterImage } from 'utils';
import {
  onBeforeMount,
  onMounted,
  reactive,
  Ref,
  ref,
  watch,
  computed,
  nextTick,
  onUnmounted,
} from 'vue';
import { useImageStore } from 'src/stores';
import { KonvaPointerEvent } from 'konva/lib/PointerEvents';
import { Stage } from 'konva/lib/Stage';
import { Annotator, leaveAnnotatorBox } from 'src/service/annotator.ts';
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
  collectionId: String,
});

const route = useRoute();
const imageStore = useImageStore();
const currentImageId = ref(props.imageId ?? (route.params.imageId as string));
const currentCollectionId = ref(
  props.collectionId ?? (route.params.collectionId as string),
);
const imageUrl = computed(() => {
  return getRasterImage(currentImageId.value) + `?t=${Date.now()}`;
});

// Core reactive state for the annotator
const annotatorBox: Ref<HTMLDivElement | null> = ref(null);
const isMounted = ref(false);
const stage = ref<Stage | null>(null);
const loading = ref(false);
const dataLoaded = ref(false);
const annotator = reactive(new Annotator());

// Watch for changes in image ID and reload data
watch(
  () => props.imageId,
  async (newImageId) => {
    if (newImageId && newImageId !== currentImageId.value) {
      currentImageId.value = newImageId;
      resetLayerPosition();

      imageStore.detections = [];
      annotator.undoStack = [];
      annotator.redoStack = [];

      await reloadImageData();
    }
  },
  { immediate: true },
);

// Watch for changes in collection ID and reload data
watch(
  () => props.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== currentCollectionId.value) {
      currentCollectionId.value = newCollectionId;
      resetLayerPosition();

      imageStore.detections = [];
      annotator.undoStack = [];
      annotator.redoStack = [];

      await reloadImageData();
    }
  },
  { immediate: true },
);

// Set up resize observer to handle container size changes
let resizeObserver: ResizeObserver | null = null;
function setupResizeObserver() {
  if (!annotatorBox.value) return;

  resizeObserver = new ResizeObserver(async () => {
    await init();
  });

  resizeObserver.observe(annotatorBox.value);
}

// Load image and detection data from the store
const reloadImageData = async (): Promise<void> => {
  // Prevent reload if already loading
  if (loading.value || dataLoaded.value) {
    console.log('Already loading or data loaded, skipping duplicate reload');
    return;
  }

  dataLoaded.value = false;
  loading.value = true;

  try {
    if (annotator.transformer) {
      annotator.transformer.nodes([]);
    }

    await imageStore.loadImage(currentImageId.value, currentCollectionId.value);
    await imageStore.loadDetections(currentImageId.value);

    if (stage.value) {
      await nextTick();
      await initAnnotator(
        annotatorBox.value!,
        imageUrl.value,
        imageStore.detections,
      );
    }

    dataLoaded.value = true;
  } catch (error) {
    console.error('Error loading image data:', error);
  } finally {
    loading.value = false;
  }
};

// Initialize the annotation interface when data is loaded
const init = async (): Promise<void> => {
  if (!isMounted.value) return;
  if (!dataLoaded.value) return;
  if (!annotatorBox.value) return;

  const forceReinit = true;

  if (forceReinit) {
    loading.value = true;
    await nextTick();

    try {
      if (annotator.stage) {
        annotator.transformer?.nodes([]);
        annotator.innerToolBox.hide();
      }

      await initAnnotator(
        annotatorBox.value,
        imageUrl.value,
        imageStore.detections,
      );

      if (imageStore.detections && imageStore.detections.length > 0) {
        annotator.changeAnnotateMode('add');
        annotator.stage.draw();
      }
    } catch (error) {
      console.error('Error initializing annotator:', error);
    } finally {
      setTimeout(() => {
        loading.value = false;
      }, 100);
    }
  }
};

// Set up the Konva stage and initialize the annotator
const initAnnotator = async (
  container: Element,
  url: string,
  annotations: DetectionState[],
): Promise<void> => {
  console.log(`Initializing annotator with image: ${url}`);

  try {
    await annotator.initImageSetting(container, url);
    annotator.initCanvas(stage.value);

    if (annotations && annotations.length >= 1) {
      annotator.innerToolBox.updateAnnotation(annotations[0]);
    }

    annotator.stage.draw();
  } catch (error) {
    console.error('Error in initAnnotator:', error);
    throw error;
  }
};

// Handle layer dragging in pan mode
const dragLayer = () => {
  if (annotator.mode !== 'drag') {
    annotator.layer.setAttrs({ draggable: false });
    return;
  }

  document.body.style.cursor = 'grabbing';
  annotator.innerToolBox.hide();
};

// Initialize component on mount
onMounted(async () => {
  isMounted.value = true;
  setupResizeObserver();

  window.addEventListener('keydown', handleAltKeyDown);
  window.addEventListener('keyup', handleAltKeyUp);

  await init();
});

// Clean up event listeners and observers on unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleAltKeyDown);
  window.removeEventListener('keyup', handleAltKeyUp);

  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

// Track Alt key state for zoom functionality
const isAltKeyPressed = ref(false);

// Handle Alt key down event for zoom mode
const handleAltKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Alt') {
    isAltKeyPressed.value = true;
    if (annotatorBox.value) {
      annotatorBox.value.style.cursor = 'zoom-in';
    }
  }
};

// Handle Alt key up event to exit zoom mode
const handleAltKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Alt') {
    isAltKeyPressed.value = false;
    if (annotatorBox.value) {
      annotatorBox.value.style.cursor =
        annotator.mode === 'add' ? 'crosshair' : 'grab';
    }
  }
};

// Handle mouse wheel for zooming when Alt is pressed
let lastWheelTime = 0;
const wheelResizeLayer = (event: KonvaPointerEvent) => {
  const wheel = event.evt as MouseEvent as WheelEvent;
  wheel.preventDefault();

  const altKeyPressed = wheel.altKey || isAltKeyPressed.value;
  if (!altKeyPressed) return;

  const now = Date.now();
  if (now - lastWheelTime < 20) return;
  lastWheelTime = now;

  const pointerPosition = annotator.stage.getPointerPosition() as Vector2d;
  if (!pointerPosition) return;

  const direction = wheel.deltaY;
  const oldScale = annotator.layer.scaleX();
  const scaleBy = 1.05;

  const newScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;

  const mousePointTo = {
    x: (pointerPosition.x - annotator.layer.x()) / oldScale,
    y: (pointerPosition.y - annotator.layer.y()) / oldScale,
  };

  const newPos = {
    x: pointerPosition.x - mousePointTo.x * newScale,
    y: pointerPosition.y - mousePointTo.y * newScale,
  };

  annotator.layer.scale({ x: newScale, y: newScale });
  annotator.layer.position(newPos);
  annotator.stage.draw();
};

// Reset layer position and scale to default
const resetLayerPosition = () => {
  annotator.layer.setAttrs({
    x: 0,
    y: 0,
    scaleX: annotator.imageScale,
    scaleY: annotator.imageScale,
  });
  annotator.innerToolBox.hide();
};

// Implement undo functionality
const undo = () => {
  const previousState = annotator.undo(imageStore.detections);
  if (previousState) {
    imageStore.detections = previousState;
    annotator.stage.draw();
  }
};

// Implement redo functionality
const redo = () => {
  const nextState = annotator.redo(imageStore.detections);
  if (nextState) {
    imageStore.detections = nextState;
    annotator.stage.draw();
  }
};

// Handle keyboard shortcuts for tool selection and operations
async function handleKeyDownEvent(event: KeyboardEvent) {
  const key = event.key.toUpperCase();
  const isCtrlPressed = event.ctrlKey || event.metaKey;

  if (isCtrlPressed) {
    switch (key) {
      case 'Z':
        if (event.shiftKey) {
          event.preventDefault();
          redo();
        } else {
          event.preventDefault();
          undo();
        }
        return;
      case 'Y':
        event.preventDefault();
        redo();
        return;
      case 'S':
        event.preventDefault();
        await save();
        return;
    }
  }

  switch (key) {
    case 'W':
      annotator.changeAnnotateMode('add');
      break;
    case 'E':
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

// Initialize data before mounting
onBeforeMount(async () => {
  await reloadImageData();
});

// Watch data loaded state and initialize when ready
watch(dataLoaded, async (newValue) => {
  if (newValue) {
    await init();
  }
});

// Watch for changes in the store's image data
watch(
  () => imageStore.image,
  async () => {
    console.log('Image data changed in store, reinitializing');
    if (annotator.transformer) {
      annotator.transformer.nodes([]);
    }
    annotator.innerToolBox.hide();
    await init();
  },
  { deep: true },
);

// Save annotations to the store/backend
const save = async () => {
  imageStore.detections.forEach((detection) => {
    console.log(detection.edited);
  });
  console.log(imageStore.detectionsToDelete);
  await imageStore.saveImage();
};

// Add transparency to color for annotation fill
function addAlpha(color: string, opacity: number) {
  let _opacity = Math.round(Math.min(Math.max(opacity ?? 1, 0), 1) * 255);
  return color + _opacity.toString(16).toUpperCase();
}

// Empty handler to prevent unnecessary redraws
const handleFocusIn = () => {
  // Empty handler to prevent unnecessary redraws
};

// Handle mouse entering the annotator area
const handleMouseOver = async () => {
  if (!annotatorBox.value) return;
  if (document.activeElement !== annotatorBox.value) {
    annotatorBox.value.focus({ preventScroll: true });
  }
};

// Determine when canvas should be shown
const showCanvas = computed(() => {
  return isMounted.value && dataLoaded.value && !loading.value;
});

// Handle end of dragging the canvas
const dragLayerEnd = () => {
  if (annotator.mode === 'drag') {
    document.body.style.cursor = 'grab';
  }
};

// Handle wheel events on the annotator box
const handleAnnotatorWheel = (e: WheelEvent) => {
  const syntheticEvent = {
    evt: e,
  } as unknown as KonvaPointerEvent;

  wheelResizeLayer(syntheticEvent);
};
</script>

<template>
  <div class="full-width row wrap container">
    <!-- Main annotator container with event handlers -->
    <div
      class="annotator"
      ref="annotatorBox"
      tabindex="1"
      @focusin="handleFocusIn"
      @mouseover="handleMouseOver"
      @mouseleave="leaveAnnotatorBox(annotator)"
      @keydown="handleKeyDownEvent"
      @wheel="handleAnnotatorWheel"
    >
      <!-- Toolbar with annotation controls -->
      <div class="control-panel">
        <q-btn @click="save" icon="save" color="primary" round>
          <q-tooltip>Save (Ctrl+S)</q-tooltip>
        </q-btn>
        <q-btn
          @click="undo"
          icon="undo"
          color="secondary"
          round
          :disable="annotator.undoStack.length === 0"
        >
          <q-tooltip>Undo (Ctrl+Z)</q-tooltip>
        </q-btn>
        <q-btn
          @click="redo"
          icon="redo"
          color="secondary"
          round
          :disable="annotator.redoStack.length === 0"
        >
          <q-tooltip>Redo (Ctrl+Y or Ctrl+Shift+Z)</q-tooltip>
        </q-btn>
        <q-btn
          @click="annotator.changeAnnotateMode('add')"
          icon="create"
          color="accent"
          round
          :class="{ 'active-tool': annotator.mode === 'add' }"
        >
          <q-tooltip>Draw (W)</q-tooltip>
        </q-btn>
        <q-btn
          @click="annotator.changeAnnotateMode('drag')"
          icon="pan_tool"
          color="accent"
          round
          :class="{ 'active-tool': annotator.mode === 'drag' }"
        >
          <q-tooltip>Pan (E)</q-tooltip>
        </q-btn>
        <q-btn
          @click="resetLayerPosition"
          icon="zoom_out_map"
          color="accent"
          round
        >
          <q-tooltip>Reset View (Z)</q-tooltip>
        </q-btn>
      </div>

      <!-- Help button with keyboard shortcuts info -->
      <q-btn round color="grey-7" class="help-button" icon="help">
        <q-tooltip> Keyboard Shortcuts </q-tooltip>
        <q-menu>
          <q-list style="min-width: 250px">
            <q-item-label header>Keyboard Shortcuts</q-item-label>
            <q-separator />
            <q-item>
              <q-item-section>
                <q-item-label>Ctrl+S</q-item-label>
              </q-item-section>
              <q-item-section>Save</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Ctrl+Z</q-item-label>
              </q-item-section>
              <q-item-section>Undo</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Ctrl+Y or Ctrl+Shift+Z</q-item-label>
              </q-item-section>
              <q-item-section>Redo</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>W</q-item-label>
              </q-item-section>
              <q-item-section>Drawing Mode</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>E</q-item-label>
              </q-item-section>
              <q-item-section>Pan Mode</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Z</q-item-label>
              </q-item-section>
              <q-item-section>Reset View</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Delete</q-item-label>
              </q-item-section>
              <q-item-section>Delete Selected</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <!-- Konva stage for rendering the image and annotations -->
      <v-stage
        v-show="showCanvas"
        :config="annotator.stageConfig"
        ref="stage"
        :key="`stage-${currentImageId}`"
        @mousedown="
          (event: KonvaPointerEvent) =>
            startResizeAnnotation(event, annotator, imageStore.detections)
        "
      >
        <v-layer
          :config="{
            ...annotator.layerConfig,
            draggable: annotator.mode === 'drag',
          }"
          :key="`layer-${currentImageId}`"
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
          @dragend="dragLayerEnd"
        >
          <v-image
            :config="{
              ...annotator.imageConfig,
              listening: true,
            }"
            @mousedown="
              createAnnotation(annotator, currentImageId, imageStore.detections)
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
                stroke: item.computed_color,
                width: item.width,
                height: item.height,
                draggable: annotator.mode === 'add',
                fill: addAlpha(item.computed_color, 0.3),
                listening: true,
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
          <v-transformer
            :config="{
              ...annotator.transformerConfig,
            }"
          />
        </v-layer>
      </v-stage>

      <!-- Loading spinner overlay -->
      <div v-if="loading" class="loading-overlay flex flex-center">
        <q-spinner color="primary" size="48px" />
      </div>
    </div>
  </div>
</template>

<style>
.annotator {
  min-width: 100%;
  max-width: 100%;
  position: relative;
}

.container {
  height: 100%;
  background-color: #f0f0f0;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  z-index: 10;
}

.control-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.active-tool {
  box-shadow:
    0 0 0 2px white,
    0 0 0 4px var(--q-accent);
}

.help-button {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 100;
}
</style>
