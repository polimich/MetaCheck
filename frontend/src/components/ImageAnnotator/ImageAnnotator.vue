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
import Konva from 'konva';
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
  // Add a timestamp or random value to force reload when id changes
  return getRasterImage(currentImageId.value) + `?t=${Date.now()}`;
});

// Reactive variables
const annotatorBox: Ref<HTMLDivElement | null> = ref(null);
const isMounted = ref(false);
const stage = ref<Stage | null>(null);
const loading = ref(false);
const dataLoaded = ref(false);
const annotator = reactive(new Annotator());

// Watch for changes in the imageId prop
watch(
  () => props.imageId,
  async (newImageId) => {
    if (newImageId && newImageId !== currentImageId.value) {
      currentImageId.value = newImageId;
      // Reset the stage to ensure clean state
      resetLayerPosition();

      // Clear existing data
      imageStore.detections = [];
      annotator.undoStack = [];
      annotator.redoStack = [];

      // Reload image data with the new ID
      await reloadImageData();
    }
  },
  { immediate: true },
);

// Watch for changes in the collectionId prop
watch(
  () => props.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== currentCollectionId.value) {
      currentCollectionId.value = newCollectionId;
      // Reset stage and clear data for new collection
      resetLayerPosition();

      // Clear existing data
      imageStore.detections = [];
      annotator.undoStack = [];
      annotator.redoStack = [];

      // Reload image data with the new collection ID
      await reloadImageData();
    }
  },
  { immediate: true },
);

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
const reloadImageData = async (): Promise<void> => {
  dataLoaded.value = false;
  loading.value = true;

  try {
    // Clear transformer to avoid ghost selections
    if (annotator.transformer) {
      annotator.transformer.nodes([]);
    }

    // Load the image and detections
    await imageStore.loadImage(currentImageId.value, currentCollectionId.value);
    await imageStore.loadDetections(currentImageId.value);

    // Force a re-initialization of the stage
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

// Modify the init function to better handle reinitialization
const init = async (): Promise<void> => {
  if (!isMounted.value) return;
  if (!dataLoaded.value) return;
  if (!annotatorBox.value) return;

  // Force reinitialization when image changes
  const forceReinit = true;

  if (forceReinit) {
    loading.value = true;
    // Use nextTick to ensure the DOM is updated before we initialize
    await nextTick();

    try {
      // Force reset of the annotator state
      if (annotator.stage) {
        annotator.transformer?.nodes([]);
        annotator.innerToolBox.hide();
      }

      await initAnnotator(
        annotatorBox.value,
        imageUrl.value,
        imageStore.detections,
      );

      // Draw any loaded annotations
      if (imageStore.detections && imageStore.detections.length > 0) {
        // Ensure we're in annotation mode
        annotator.changeAnnotateMode('add');
        annotator.stage.draw();
      }
    } catch (error) {
      console.error('Error initializing annotator:', error);
    } finally {
      // Give the browser a moment to render before removing loading state
      setTimeout(() => {
        loading.value = false;
      }, 100);
    }
  }
};

// Improve the initAnnotator function
const initAnnotator = async (
  container: Element,
  url: string,
  annotations: DetectionState[],
): Promise<void> => {
  console.log(`Initializing annotator with image: ${url}`);

  try {
    // Reset image scale and config
    await annotator.initImageSetting(container, url);

    // Initialize the canvas - this will handle both new and existing stages
    annotator.initCanvas(stage.value);

    // Update with current annotations
    if (annotations && annotations.length >= 1) {
      annotator.innerToolBox.updateAnnotation(annotations[0]);
    }

    // Configure Konva for better performance
    Konva.pixelRatio = 1; // Lower pixel ratio for better performance

    // Force a redraw after initialization
    annotator.stage.draw();
  } catch (error) {
    console.error('Error in initAnnotator:', error);
    throw error;
  }
};

// Replace throttled functions with direct implementations
const dragLayer = () => {
  // Only allow dragging in drag mode
  if (annotator.mode !== 'drag') {
    annotator.layer.setAttrs({ draggable: false });
    return;
  }

  // Change cursor while dragging
  document.body.style.cursor = 'grabbing';

  // Hide the toolbox during panning
  annotator.innerToolBox.hide();
};

// Add event listeners for Alt key to enable wheel zoom without clicking
onMounted(async () => {
  isMounted.value = true;
  setupResizeObserver();

  // Add global event listeners for Alt key to enable wheel zoom
  window.addEventListener('keydown', handleAltKeyDown);
  window.addEventListener('keyup', handleAltKeyUp);

  await init();
});

// Clean up event listeners on component unmount
onUnmounted(() => {
  // Remove global event listeners to prevent memory leaks
  window.removeEventListener('keydown', handleAltKeyDown);
  window.removeEventListener('keyup', handleAltKeyUp);

  // Clean up resize observer
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

// Track Alt key state
const isAltKeyPressed = ref(false);

// Handle Alt key down
const handleAltKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Alt') {
    isAltKeyPressed.value = true;
    // Change cursor to indicate zoom mode is available
    if (annotatorBox.value) {
      annotatorBox.value.style.cursor = 'zoom-in';
    }
  }
};

// Handle Alt key up
const handleAltKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Alt') {
    isAltKeyPressed.value = false;
    // Restore cursor to default or current tool cursor
    if (annotatorBox.value) {
      annotatorBox.value.style.cursor =
        annotator.mode === 'add' ? 'crosshair' : 'grab';
    }
  }
};

// Improved wheel handler that works with Alt key and resets the canvas properly
let lastWheelTime = 0;
const wheelResizeLayer = (event: KonvaPointerEvent) => {
  // Check if Alt key is pressed using the tracked state
  const wheel = event.evt as MouseEvent as WheelEvent;
  wheel.preventDefault();

  // Use either the event's Alt key state or our tracked state
  const altKeyPressed = wheel.altKey || isAltKeyPressed.value;
  if (!altKeyPressed) return;

  // Simple rate limiting - only process wheel events every 20ms
  const now = Date.now();
  if (now - lastWheelTime < 20) return;
  lastWheelTime = now;

  // Get current pointer position for zoom center
  const pointerPosition = annotator.stage.getPointerPosition() as Vector2d;
  if (!pointerPosition) return;

  const direction = wheel.deltaY;
  const oldScale = annotator.layer.scaleX();
  const scaleBy = 1.05;

  // Calculate new scale based on wheel direction
  const newScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;

  // Calculate mouse point in relation to the layer
  const mousePointTo = {
    x: (pointerPosition.x - annotator.layer.x()) / oldScale,
    y: (pointerPosition.y - annotator.layer.y()) / oldScale,
  };

  // Calculate new position to keep the point under the mouse
  const newPos = {
    x: pointerPosition.x - mousePointTo.x * newScale,
    y: pointerPosition.y - mousePointTo.y * newScale,
  };

  // Apply new scale and position
  annotator.layer.scale({ x: newScale, y: newScale });
  annotator.layer.position(newPos);

  // Force immediate redraw for smoother experience
  annotator.stage.draw();
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

// Add undo/redo functions
const undo = () => {
  // Get the previous state from the undo stack
  const previousState = annotator.undo(imageStore.detections);
  if (previousState) {
    // Replace current detections with the previous state
    imageStore.detections = previousState;
    annotator.stage.draw();
  }
};

const redo = () => {
  // Get the next state from the redo stack
  const nextState = annotator.redo(imageStore.detections);
  if (nextState) {
    // Replace current detections with the next state
    imageStore.detections = nextState;
    annotator.stage.draw();
  }
};

// Update keyboard handler to include save shortcut
async function handleKeyDownEvent(event: KeyboardEvent) {
  const key = event.key.toUpperCase();
  const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey for Mac

  // Handle keyboard shortcuts with Ctrl
  if (isCtrlPressed) {
    switch (key) {
      case 'Z':
        if (event.shiftKey) {
          // Ctrl+Shift+Z = Redo
          event.preventDefault();
          redo();
        } else {
          // Ctrl+Z = Undo
          event.preventDefault();
          undo();
        }
        return;
      case 'Y':
        // Ctrl+Y = Redo (alternative)
        event.preventDefault();
        redo();
        return;
      case 'S':
        // Ctrl+S = Save
        event.preventDefault();
        await save();
        return;
    }
  }

  // Handle existing shortcuts
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
  await reloadImageData();
});

// Update watchers to react to store changes
watch(dataLoaded, async (newValue) => {
  if (newValue) {
    await init();
  }
});

// Use deep watch on the imageStore for more reliable change detection
watch(
  () => imageStore.image,
  async () => {
    console.log('Image data changed in store, reinitializing');
    // Clear canvas state
    if (annotator.transformer) {
      annotator.transformer.nodes([]);
    }
    annotator.innerToolBox.hide();

    // Reinitialize with new data
    await init();
  },
  { deep: true },
);

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

// More reliable focus handling
const handleFocusIn = () => {
  // This event handler is now empty to prevent unnecessary redraws
  // Just let the native focus behavior handle it
};

// Replace the enterAnnotatorBox function with a proper wrapper
const handleMouseOver = async () => {
  if (!annotatorBox.value) return;
  if (document.activeElement !== annotatorBox.value) {
    // First focus silently without triggering effects
    annotatorBox.value.focus({ preventScroll: true });
  }
};

// Add this computed property to determine if the canvas should show
const showCanvas = computed(() => {
  return isMounted.value && dataLoaded.value && !loading.value;
});

// Handle the end of dragging the canvas
const dragLayerEnd = () => {
  if (annotator.mode === 'drag') {
    // Return cursor to grab when not actively dragging
    document.body.style.cursor = 'grab';
  }
};

// Create a separate wheel handler for the annotator box
const handleAnnotatorWheel = (e: WheelEvent) => {
  // We need to create a similar structure to what Konva expects
  const syntheticEvent = {
    evt: e,
  } as unknown as KonvaPointerEvent;

  wheelResizeLayer(syntheticEvent);
};
</script>

<template>
  <div class="full-width row wrap container">
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
      <!-- Move control buttons inside the annotator div -->
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

      <!-- Help button also moved inside -->
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
            draggable: annotator.mode === 'drag', // Only draggable in drag mode
            clearBeforeDraw: false /* Prevent clearing before draw to reduce flicker */,
            imageSmoothingEnabled: false /* Disable image smoothing for better performance */,
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
              perfectDrawEnabled: false,
              imageSmoothingEnabled: false,
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
                draggable: annotator.mode === 'add', // Only allow dragging annotations in add mode
                fill: addAlpha(item.computed_color, 0.3),
                perfectDrawEnabled: false,
                hitStrokeWidth: 4,
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
              perfectDrawEnabled: false,
            }"
          />
        </v-layer>
      </v-stage>
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
  background-color: #f0f0f0; /* Match the background color */
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

/* Control panel styling - updated to be positioned inside annotator */
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
