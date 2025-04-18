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
import MetadataInputPanel from './MetadataInputPanel.vue';
import { useSynchronization } from './composables/useSynchronization';

// Use stores for state management instead of props
const imageStore = useImageStore();
const currentCollection = useCurrentCollectionState();
const metaRoleStore = useMetaRoleStore();
const notificationStore = useNotificationStore();

// Store initial position and scale for reset
const initialPosition = ref({ x: 0, y: 0 });
const initialScale = ref(1);

// Current image and collection IDs from store
const currentImageId = computed(() => currentCollection.selectedImageId);
const currentCollectionId = computed(() => currentCollection.id);

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
const synchronization = useSynchronization();

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
const metaRoles = computed(() => metaRoleStore.getAllMetaRoleSelectOptions);
const metaInputPanelRef = ref<HTMLDivElement | null>(null);

// --- Metadata Input Positioning Logic ---
const pendingAnnotation = computed(() => {
  if (!annotations.pendingMetaAnnotationId.value) return null;

  // Find the annotation and ensure we return null if not found (instead of undefined)
  return (
    annotations.annotations.value.find(
      (a) => a.id === annotations.pendingMetaAnnotationId.value,
    ) || null
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
  } as CSSProperties; // Assert the whole object as CSSProperties
});

// --- Metadata Input Actions ---
function handleConfirmMeta(metaRole: string | null, value: string) {
  annotations.confirmAnnotationMeta(metaRole, value);
}

function handleCancelMeta() {
  annotations.cancelAnnotationMeta();
}

// --- onClickOutside Logic for MetadataInputPanel ---
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

  // If panel is visible and pending annotation exists, cancel it
  if (annotations.pendingMetaAnnotationId.value) {
    console.log(
      'onClickOutside: Detected click outside meta panel. Cancelling annotation.',
    );
    handleCancelMeta();
  }
});

// Fetch meta roles on mount
onMounted(async () => {
  console.log('ImageAnnotator mounted');
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

// Watch for changes in currentCollection selectedImageId
watch(
  () => currentCollection.selectedImageId,
  async (newImageId, oldImageId) => {
    if (newImageId && newImageId !== oldImageId) {
      console.log(
        `ImageAnnotator: currentCollection.selectedImageId changed to ${newImageId}, reloading data`,
      );
      // Always reload when store changes
      await loadImageData();
    }
  },
);

// Watch for changes in collection ID and reload data
watch(
  () => currentCollection.id,
  async (newCollectionId, oldCollectionId) => {
    if (newCollectionId && newCollectionId !== oldCollectionId) {
      console.log(
        `ImageAnnotator: collection ID changed to ${newCollectionId}, reloading data`,
      );
      await loadImageData();
    }
  },
);

// Watch for changes in the store's selected detection
watch(
  () => imageStore.selectedDetectionId,
  (newSelectedId) => {
    if (newSelectedId) {
      // Check if this detection exists in our annotations
      const exists = annotations.annotations.value.some(
        (ann) => ann.id === newSelectedId,
      );
      if (exists) {
        // Sync with the annotations composable
        annotations.syncSelectionWithStore(newSelectedId);
        // Update transformer
        nextTick(() => {
          updateTransformer();
        });
      }
    } else {
      // Clear selection
      annotations.deselectAll();
      // Update transformer to remove it
      nextTick(() => {
        updateTransformer();
      });
    }
  },
);

// Watch for changes in imageStore detections to sync with external changes
watch(
  () => imageStore.detections,
  (newDetections) => {
    console.log(
      `ImageAnnotator: Detected ${newDetections.length} detections in store, updating annotations`,
    );
    // Always update annotations when detections change, regardless of current count
    annotations.loadAnnotations(imageStore.detectionsGetter);

    // Update transformer if needed
    nextTick(() => {
      updateTransformer();
    });
  },
  { deep: true },
);

// Load image and annotation data
async function loadImageData() {
  if (!currentImageId.value) {
    console.warn(
      'ImageAnnotator: No currentImageId available, cannot load data',
    );
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  loadingMessage.value = 'Loading image...';

  try {
    console.log(
      `ImageAnnotator: Loading data for image ${currentImageId.value}`,
    );

    // Reset view
    imageCanvas.resetView();

    // Reset annotations to clear existing state
    // Use deselectAll and reset annotations manually instead of clearAll
    annotations.deselectAll();
    annotations.loadAnnotations([]);

    // Always load fresh from the store when image changes
    console.log('ImageAnnotator: Loading image and detections from store');
    await imageStore.loadImage(currentImageId.value, currentCollectionId.value);
    await imageStore.loadDetections(currentImageId.value);

    // Try to load image from image URL
    try {
      // Force reload of image by adding timestamp to URL
      await imageCanvas.loadImage(
        getRasterImage(currentImageId.value) + `?t=${Date.now()}`,
      );
      console.log('ImageAnnotator: Canvas image loaded successfully');

      // Store initial position and scale after image load
      initialPosition.value = {
        x: imageCanvas.position.x,
        y: imageCanvas.position.y,
      };
      initialScale.value = imageCanvas.scale.value || 1;
    } catch (error) {
      console.error('ImageAnnotator: Error loading image into canvas:', error);
      // Continue execution to still try loading annotations
    }

    loadingMessage.value = 'Loading annotations...';

    // Always reload annotations from store
    annotations.loadAnnotations(imageStore.detectionsGetter);
    console.log(
      `ImageAnnotator: Loaded ${annotations.annotations.value.length} annotations from store`,
    );

    // Initialize Konva stage if needed
    await initKonva();

    // Force redraw of the Konva stage
    if (konvaStage.value) {
      konvaStage.value.batchDraw();
    }
  } catch (error) {
    console.error('ImageAnnotator: Error loading image data:', error);
    loadingMessage.value = 'Error loading image data';
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

// Expose the handlers for use in the template
defineExpose({
  handleSelectAnnotation,
  scrollToAnnotation,
});

function handleSelectAnnotation(id: string, shift = false) {
  console.log(`ImageAnnotator: Selecting annotation ${id}, shift:`, shift);

  // Select in annotations
  annotations.selectAnnotation(id, shift);

  // Sync with synchronization composable, which will update the store
  // This helps prevent circular update loops
  synchronization.syncSelectionFromAnnotator(id);

  // Update transformer
  nextTick(() => {
    updateTransformer();
  });
}

// Method to scroll/zoom to a specific annotation
function scrollToAnnotation(detection: DetectionState) {
  // First select the detection
  handleSelectAnnotation(detection.id, false);

  // Find the annotation in our annotations list
  const annotation = annotations.annotations.value.find(
    (a) => a.id === detection.id,
  );
  if (!annotation) {
    console.error(
      `Cannot scroll to annotation ${detection.id}: not found in current annotations`,
    );
    return;
  }

  // Calculate center point of the annotation
  const centerX = annotation.x + annotation.width / 2;
  const centerY = annotation.y + annotation.height / 2;

  // Calculate appropriate zoom level based on annotation size
  // Use a multiplier to ensure annotation is visible but not too small
  const minDimension = Math.min(
    imageCanvas.dimensions.value?.originalWidth || 0,
    imageCanvas.dimensions.value?.originalHeight || 0,
  );
  const annotationSize = Math.max(annotation.width, annotation.height);
  const zoomFactor = minDimension / (annotationSize * 5); // 5x padding around annotation

  // Clamp zoom to reasonable values
  const normalizedZoom = Math.min(Math.max(zoomFactor, 0.5), 10);

  // Set new scale and position with smooth animation
  imageCanvas.zoomToPoint({ x: centerX, y: centerY }, normalizedZoom, true);

  console.log(
    `Scrolled to annotation ${detection.id} at (${centerX}, ${centerY}) with zoom ${normalizedZoom}`,
  );

  // Update transformer
  nextTick(() => {
    updateTransformer();
  });
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
        height: '100%',
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
      <MetadataInputPanel
        ref="metaInputPanelRef"
        :pending-annotation="pendingAnnotation"
        :meta-roles="metaRoles"
        :position="metaInputPosition"
        :visible="!!annotations.pendingMetaAnnotationId.value"
        @confirm="handleConfirmMeta"
        @cancel="handleCancelMeta"
      />

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
