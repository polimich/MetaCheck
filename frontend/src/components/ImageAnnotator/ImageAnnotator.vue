<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  watch,
  nextTick,
  Ref,
  CSSProperties,
} from 'vue';
import { useImageStore } from 'src/stores';
import { useCurrentCollectionState } from 'src/stores/frontend-state';
import { useImageCanvas } from './composables/useImageCanvas';
import { useAnnotations } from './composables/useAnnotations';
import { useNavigationMode } from './composables/useNavigationMode';
import { useTransformerManagement } from './composables/useTransformerManagement';
import { useKonvaEventHandlers } from './composables/useKonvaEventHandlers';
import { getRasterImage } from 'utils';
import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { ImageSkeleton } from 'src/components';
import AnnotatorToolbar from './AnnotatorToolbar.vue';
import { useMetaRoleStore } from 'src/stores/meta-role-store';
import { DetectionState } from 'src/types';
import { onClickOutside } from '@vueuse/core';
import { useNotificationStore } from 'src/stores/app/notificationService';

// Props
const props = defineProps({
  imageId: String,
  collectionId: String,
});

// Use currentCollectionState instead of route
const imageStore = useImageStore();
const currentCollection = useCurrentCollectionState();
const metaRoleStore = useMetaRoleStore();
const notificationStore = useNotificationStore();

// Store initial position and scale for reset
const initialPosition = ref({ x: 0, y: 0 });
const initialScale = ref(1);

// Current image and collection IDs
const currentImageId = computed(() => {
  // Try props first, then currentCollection
  return props.imageId || currentCollection.selectedImageId;
});

const currentCollectionId = computed(() => {
  // Try props first, then currentCollection
  return props.collectionId || currentCollection.id;
});

// Image URL
const imageUrl = computed(() => {
  if (!currentImageId.value) return '';
  return getRasterImage(currentImageId.value) + `?t=${Date.now()}`;
});

// Set up composables
const annotatorBox = ref<HTMLDivElement | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stage = ref<any>(null); // Ref for the v-stage component instance
const konvaStage = ref<Stage | null>(null) as Ref<Stage | null>;
const konvaLayer = ref<Layer | null>(null) as Ref<Layer | null>;
const imageCanvas = useImageCanvas();
const navigationMode = useNavigationMode();
const annotations = useAnnotations(imageCanvas);
const { updateTransformer } = useTransformerManagement(
  konvaLayer,
  annotations.selectedIds,
);

// Use Konva event handlers composable
const konvaEventHandlers = useKonvaEventHandlers(
  konvaStage,
  konvaLayer,
  navigationMode,
  annotations,
  imageCanvas,
);

// Component loading state
const isLoading = ref(true);
const loadingMessage = ref('Loading image...');
const isMounted = ref(false);

// Modify stageConfig for stage dragging
const stageConfig = computed(() => ({
  width: annotatorBox.value?.clientWidth || 800,
  height: annotatorBox.value?.clientHeight || 600,
  draggable: navigationMode.mode.value === 'drag', // Make STAGE draggable
}));

// Modify layerConfig - ensure layer is NOT draggable
const layerConfig = computed(() => ({
  x: imageCanvas.position.x,
  y: imageCanvas.position.y,
  scaleX: imageCanvas.scale.value,
  scaleY: imageCanvas.scale.value,
  // draggable: false, // Explicitly not needed as default is false
}));

// Image config for v-image
const imageConfig = computed(() => ({
  image: imageCanvas.image.value,
  width: imageCanvas.dimensions.value?.originalWidth || 0,
  height: imageCanvas.dimensions.value?.originalHeight || 0,
  listening: false, // Image itself shouldn't capture clicks, layer/stage should
  name: 'image', // Assign name for hit detection check
}));

// Add transparency to color for annotation fill
function addAlpha(color: string, opacity: number) {
  let _opacity = Math.round(Math.min(Math.max(opacity ?? 1, 0), 1) * 255);
  return color + _opacity.toString(16).toUpperCase();
}

// --- Metadata Input State ---
const metaRoles = computed(() => metaRoleStore.getMetaRoleSelectOptions);
const selectedMetaRole = ref<string | null>(null);
const annotationValue = ref<string>('');
const metaInputPanelRef = ref<HTMLDivElement | null>(null);

// Fetch meta roles on mount
onMounted(async () => {
  console.log('NewImageAnnotator mounted');
  isMounted.value = true;

  nextTick(() => {
    if (annotatorBox.value) {
      imageCanvas.setContainer(annotatorBox.value);
      console.log('ImageCanvas container set.');
    } else {
      console.error('Annotator box ref is not available after mount');
    }

    if (stage.value) {
      konvaStage.value = stage.value.getStage();
      console.log('Konva Stage obtained:', konvaStage.value ? 'yes' : 'no');

      if (konvaStage.value) {
        konvaLayer.value = konvaStage.value.findOne('Layer') as Layer | null;
        console.log('Konva Layer obtained:', konvaLayer.value ? 'yes' : 'no');

        // Initial transformer update after layer is obtained
        if ((annotations.selectedIds.value?.size || 0) > 0) {
          console.log(
            'Initial selection present on mount, updating transformer',
          );
          updateTransformer(); // Call the function from the composable
        }
      } else {
        console.error('Failed to get Konva Stage object from ref');
      }

      // @ts-expect-error setStage method exists but not in type definition
      imageCanvas.setStage?.(konvaStage.value);
      console.log(
        'Stage set:',
        konvaStage.value ? 'available' : 'not available',
      );
    } else {
      console.error('Stage ref is not available after mount');
    }

    if (currentImageId.value) {
      console.log('Loading image data for:', currentImageId.value);
      loadImageData();
    } else {
      console.log('No current image ID available');
    }
  });
});

// Watch for changes in props imageId and reload data
watch(
  () => props.imageId,
  async (newImageId) => {
    if (newImageId && newImageId !== currentImageId.value) {
      await loadImageData();
    }
  },
);

// Watch for changes in currentCollection selectedImageId
watch(
  () => currentCollection.selectedImageId,
  async (newImageId) => {
    if (newImageId && !props.imageId) {
      await loadImageData();
    }
  },
);

// Watch for changes in collection ID and reload data
watch(
  () => [props.collectionId, currentCollection.id],
  async () => {
    await loadImageData();
  },
);

// Load image and annotation data
async function loadImageData() {
  if (!currentImageId.value) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  loadingMessage.value = 'Loading image...';

  try {
    // Reset view
    imageCanvas.resetView();

    // Load image
    await imageCanvas.loadImage(imageUrl.value);

    // Store initial position and scale after image load
    initialPosition.value = {
      x: imageCanvas.position.x,
      y: imageCanvas.position.y,
    };
    initialScale.value = imageCanvas.scale.value || 1;
    console.log(
      'Stored initial position:',
      initialPosition.value,
      'and scale:',
      initialScale.value,
    );

    // Load annotations
    loadingMessage.value = 'Loading annotations...';

    // Get annotations from current image in collection
    if (currentCollectionId.value) {
      const currentImage = currentCollection.getImageById(currentImageId.value);

      if (currentImage && currentImage.detections) {
        // Use detections from the current image
        annotations.loadAnnotations(currentImage.detections);
      } else {
        // Fall back to imageStore if needed
        await imageStore.loadImage(
          currentImageId.value,
          currentCollectionId.value,
        );
        await imageStore.loadDetections(currentImageId.value);
        annotations.loadAnnotations(imageStore.detections);
      }
    } else {
      // No collection ID, fall back to imageStore only
      await imageStore.loadDetections(currentImageId.value);
      annotations.loadAnnotations(imageStore.detections);
    }

    // Initialize Konva stage if needed
    await initKonva();
  } catch (error) {
    console.error('Error loading image data:', error);
  } finally {
    isLoading.value = false;
  }
}

// Initialize Konva stage and layers
async function initKonva() {
  // Ensure konvaStage/Layer is available
  if (!konvaStage.value || !konvaLayer.value || !imageCanvas.image.value) {
    console.log('initKonva skipped: Konva stage, layer or image not ready');
    return;
  }

  console.log('Initializing Konva stage/layer...');
  await nextTick(); // Ensure DOM is updated if needed
  konvaLayer.value.draw(); // Draw the layer containing image and annotations
  console.log('Konva stage/layer initialized and drawn.');
}

// Save annotations to the store/backend
async function save() {
  try {
    // Get the current image
    const currentImage = currentCollection.getImageById(currentImageId.value);

    if (currentImage) {
      // Get latest data from composable
      const { annotations: currentAnns, deletedAnnotations: deletedAnns } =
        annotations.annotationsForSave.value;

      // Reset store's arrays for tracking changes
      imageStore.detectionsToAdd.length = 0;
      imageStore.detectionsToDelete.length = 0;

      // Process updates and new annotations
      currentAnns.forEach((ann) => {
        const existingIndex = currentImage.detections.findIndex(
          (d) => d.id === ann.id,
        );
        if (existingIndex !== -1) {
          // Update existing detection - only assign properties managed by this component
          currentImage.detections[existingIndex] = {
            ...currentImage.detections[existingIndex], // Keep existing properties
            x: ann.x,
            y: ann.y,
            width: ann.width,
            height: ann.height,
            value: ann.value,
            computed_type: ann.computed_type,
            computed_color: ann.computed_color,
            computed_display_type: ann.computed_display_type,
            confidence: ann.confidence,
            annotated: ann.annotated,
            edited: true, // Mark as edited
          } as DetectionState;
        } else {
          // Add new detection to the store's array for adding
          imageStore.detectionsToAdd.push({
            ...ann,
            created_date: new Date().toISOString(),
            image_id: currentImageId.value,
            collection_id: currentCollectionId.value,
          } as DetectionState);
        }
      });

      // Process deleted annotations
      deletedAnns.forEach((ann) => {
        // Add to store's array for deletion
        imageStore.detectionsToDelete.push(ann);
      });

      // Mark image as edited if there were changes
      if (
        currentAnns.some((a) => a.edited) ||
        deletedAnns.length > 0 ||
        imageStore.detectionsToAdd.length > 0
      ) {
        currentImage.edited = true;
      }

      // Update imageStore detections for consistency
      imageStore.detections = [...currentAnns];

      // Save all changes (create new, update existing, delete marked)
      const saveResult = await imageStore.saveAllChanges();

      if (!saveResult || !saveResult.success) {
        notificationStore.error(
          `Failed to save changes: ${saveResult?.error || 'Unknown error'}`,
        );
        console.error('Error saving changes:', saveResult?.error);
      } else {
        notificationStore.success('Annotations saved successfully');
        // Clear deleted annotations after successful save
        annotations.deletedAnnotations.value = [];
      }
    } else {
      notificationStore.error('Cannot save: Image not found');
      console.error('Cannot save: Current image not found');
    }
  } catch (error) {
    notificationStore.error(
      `Error saving annotations: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    console.error('Error in save function:', error);
  }
}

// Handle keyboard events
function handleKeyDown(event: KeyboardEvent) {
  // Ignore key events if focused on an input element
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  const key = event.key; // Use event.key for Spacebar check
  const isCtrlPressed = event.ctrlKey || event.metaKey;

  // Handle Spacebar for temporary drag mode
  if (key === ' ' && !event.repeat) {
    // Check for Spacebar, prevent repeat triggers
    event.preventDefault(); // Prevent page scroll
    navigationMode.startSpacebarPan();
    return; // Don't process other shortcuts if space is pressed
  }

  // Prevent default browser behavior for other shortcuts we handle
  if (isCtrlPressed && 'ZYS'.includes(key.toUpperCase())) {
    event.preventDefault();
  }
  if (['W', 'E', 'Z', 'BACKSPACE', 'DELETE'].includes(key.toUpperCase())) {
    event.preventDefault();
  }

  if (isCtrlPressed) {
    switch (key.toUpperCase()) {
      case 'Z':
        if (event.shiftKey) {
          annotations.redo();
        } else {
          annotations.undo();
        }
        return;
      case 'Y':
        annotations.redo();
        return;
      case 'S':
        save();
        return;
    }
  }

  switch (key.toUpperCase()) {
    case 'W':
      navigationMode.setMode('add');
      break;
    case 'E':
      navigationMode.setMode('drag');
      break;
    case 'Z':
      imageCanvas.resetView();
      break;
    case 'BACKSPACE':
    case 'DELETE':
      annotations.deleteSelected();
      break;
  }
}

// Handle key up events (specifically for Spacebar)
function handleKeyUp(event: KeyboardEvent) {
  if (event.key === ' ') {
    // Check for Spacebar release
    event.preventDefault();
    navigationMode.stopSpacebarPan();
  }
}

// Expose the handler for use in the template
defineExpose({
  handleSelectAnnotation,
});

function handleSelectAnnotation(id: string, shift = false) {
  console.log(`Selecting annotation ${id}, shift:`, shift);
  annotations.selectAnnotation(id, shift);
  // Transformer update is handled by the watcher in useTransformerManagement
}

// New wrapper function for resetting view
function handleResetView() {
  imageCanvas.resetView();

  nextTick(() => {
    // Explicitly update the Konva layer with the values from imageCanvas
    if (konvaLayer.value) {
      konvaLayer.value.position({
        x: imageCanvas.position.x,
        y: imageCanvas.position.y,
      });

      konvaLayer.value.scale({
        x: imageCanvas.scale.value || 1,
        y: imageCanvas.scale.value || 1,
      });

      konvaLayer.value.batchDraw();
    }

    // Also update stage position
    if (konvaStage.value) {
      konvaStage.value.position({
        x: 0,
        y: 0,
      });
      konvaStage.value.batchDraw();
    }

    // Update transformer after view reset
    updateTransformer();
  });
}

// --- Metadata Input Positioning Logic ---
const pendingAnnotation = computed(() => {
  if (!annotations.pendingMetaAnnotationId.value) return null;
  return annotations.annotations.value.find(
    (a) => a.id === annotations.pendingMetaAnnotationId.value,
  );
});

const metaInputPosition = computed(() => {
  if (!pendingAnnotation.value || !imageCanvas.image.value) {
    // Return a style object compatible with CSSProperties
    return { display: 'none' } as CSSProperties;
  }

  // Convert annotation bottom-left corner (in image coords) to screen coords
  const imageCoords = {
    x: pendingAnnotation.value.x,
    y: pendingAnnotation.value.y + pendingAnnotation.value.height,
  };
  const screenCoords = imageCanvas.imageToScreenCoords(imageCoords);

  return {
    display: 'block',
    position: 'absolute' as const, // Explicitly cast position
    left: `${screenCoords.x}px`,
    top: `${screenCoords.y + 5}px`,
    zIndex: 11,
    backgroundColor: 'white',
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    minWidth: '200px',
  } as CSSProperties; // Assert the whole object as CSSProperties
});

// --- Metadata Input Actions ---
function handleConfirmMeta() {
  annotations.confirmAnnotationMeta(
    selectedMetaRole.value,
    annotationValue.value,
  );
  // Reset local state
  selectedMetaRole.value = null;
  annotationValue.value = '';
}

function handleCancelMeta() {
  annotations.cancelAnnotationMeta();
  // Reset local state
  selectedMetaRole.value = null;
  annotationValue.value = '';
}

// Reset meta inputs if pending ID changes externally (e.g., undo/redo, load)
watch(annotations.pendingMetaAnnotationId, (newId) => {
  if (!newId) {
    selectedMetaRole.value = null;
    annotationValue.value = '';
  }
});

// --- onClickOutside Logic ---
// Register onClickOutside handler
onClickOutside(metaInputPanelRef, (event) => {
  // Check if the click target is part of the Konva canvas/stage
  // This prevents immediate cancellation when clicking to draw a new box
  const targetElement = event.target as HTMLElement;
  if (targetElement.closest('.konvajs-content')) {
    console.log(
      'onClickOutside: Click inside Konva canvas detected, ignoring.',
    );
    return;
  }

  // Only cancel if the panel is visible (pendingMetaAnnotationId is set)
  // and both inputs are empty
  if (
    annotations.pendingMetaAnnotationId.value &&
    !selectedMetaRole.value &&
    !annotationValue.value
  ) {
    console.log(
      'onClickOutside: Detected click outside empty meta panel. Cancelling annotation.',
    );
    handleCancelMeta(); // Use the existing cancel function
  } else if (annotations.pendingMetaAnnotationId.value) {
    console.log(
      'onClickOutside: Click outside meta panel, but inputs have values or not pending. Doing nothing.',
    );
    // Optionally, you could choose to just hide the panel without cancelling
    // annotations.clearPendingMeta(); // You'd need to expose this from useAnnotations
  }
});
</script>

<template>
  <div class="full-width row wrap container">
    <!-- Main annotator container -->
    <div
      class="annotator"
      ref="annotatorBox"
      tabindex="1"
      @mouseover="annotatorBox?.focus({ preventScroll: true })"
      @keydown="handleKeyDown"
      @keyup="handleKeyUp"
      @wheel.prevent
      :style="{
        cursor: navigationMode.getCursorStyle.value,
        height: 'calc(100vh - 150px)',
        overflow: 'hidden',
        position: 'relative',
      }"
    >
      <!-- Use the new Toolbar Component -->
      <AnnotatorToolbar
        :save="save"
        :undo="annotations.undo"
        :redo="annotations.redo"
        :set-mode="navigationMode.setMode"
        :reset-view="handleResetView"
        :current-mode="navigationMode.mode.value"
        :undo-stack-length="annotations.undoStack.value?.length"
        :redo-stack-length="annotations.redoStack.value?.length"
        :zoom-percentage="imageCanvas.zoomPercentage.value"
      />

      <!-- Metadata Input Panel (conditionally displayed) -->
      <div
        ref="metaInputPanelRef"
        v-if="annotations.pendingMetaAnnotationId.value"
        :style="metaInputPosition"
      >
        <q-select
          v-model="selectedMetaRole"
          :options="metaRoles"
          label="Meta Role"
          dense
          options-dense
          clearable
          use-input
          hide-selected
          fill-input
          input-debounce="0"
          @filter="
            (val, update) => {
              update(() => {});
            }
          "
          class="q-mb-sm"
        />
        <q-input
          v-model="annotationValue"
          label="Value"
          dense
          outlined
          class="q-mb-sm"
          @keyup.enter="handleConfirmMeta"
        />
        <div class="row justify-end q-gutter-sm">
          <q-btn
            label="Cancel"
            color="negative"
            flat
            dense
            @click="handleCancelMeta"
            size="sm"
          />
          <q-btn
            label="Confirm"
            color="primary"
            dense
            @click="handleConfirmMeta"
            size="sm"
          />
        </div>
      </div>

      <!-- Show skeleton while loading -->
      <ImageSkeleton v-if="isLoading" :message="loadingMessage" />

      <!-- Konva stage -->
      <v-stage
        :v-show="!isLoading && isMounted"
        ref="stage"
        :config="stageConfig"
        @mousedown="konvaEventHandlers.handleMouseDown"
        @mousemove="konvaEventHandlers.handleMouseMove"
        @mouseup="konvaEventHandlers.handleMouseUp"
        @dragstart="konvaEventHandlers.handleDragStart"
        @dragmove="konvaEventHandlers.handleDragMove"
        @dragend="konvaEventHandlers.handleDragEnd"
        @wheel="konvaEventHandlers.handleWheel"
      >
        <v-layer :config="layerConfig">
          <v-image :config="imageConfig" />
          <v-rect
            v-for="annotation in annotations.annotations.value"
            :key="annotation.id"
            :config="{
              id: annotation.id,
              name: `annotation_${annotation.id}`,
              x: annotation.x,
              y: annotation.y,
              width: annotation.width,
              height: annotation.height,
              stroke: annotation.computed_color || '#FF0000',
              fill: addAlpha(
                annotation.computed_color || '#FF0000',
                annotations.selectedIds.value?.has(annotation.id) ? 0.5 : 0.3,
              ),
              strokeWidth: annotations.selectedIds.value?.has(annotation.id)
                ? 3
                : 2,
              strokeScaleEnabled: false,
              draggable: navigationMode.mode.value === 'add',
              listening: true,
            }"
            @click="konvaEventHandlers.handleRectClick"
            @mousedown="konvaEventHandlers.handleRectClick"
            @dragstart="konvaEventHandlers.handleRectDragStart"
            @dragend="konvaEventHandlers.handleRectDragEnd"
            @transformend="konvaEventHandlers.handleTransformEnd"
          />
          <!-- Transformer added dynamically -->
        </v-layer>
      </v-stage>
    </div>
  </div>
</template>

<style scoped>
.container {
  height: 100%;
  background-color: #f0f0f0;
}
.annotator {
  width: 100%;
  position: relative;
  background-color: #ffffff;
  border: 1px solid #cccccc;
}

/* Ensure Konva stage takes up available space */
:deep(.konvajs-content) {
  width: 100% !important;
  height: 100% !important;
}
</style>
