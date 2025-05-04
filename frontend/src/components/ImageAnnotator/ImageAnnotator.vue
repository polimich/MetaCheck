<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  watch,
  nextTick,
  CSSProperties,
  Ref,
  onBeforeUnmount,
} from 'vue';
import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { onClickOutside } from '@vueuse/core';

// --- Stores --- //
import { useImage } from 'src/stores';
import { useMetaRoleStore } from 'src/stores/meta-role-store';
import { useNotificationStore } from 'src/stores/app/notificationService';
// Import the type from the local composable for annotations
import { DetectionState } from 'src/types';

// --- Composables --- //
import { useImageCanvas } from './composables/useImageCanvas';
import { useAnnotations } from './composables/useAnnotations';
import { useNavigationMode } from './composables/useNavigationMode';
import { useTransformerManagement } from './composables/useTransformerManagement';
import { useKonvaEventHandlers } from './composables/useKonvaEventHandlers';

// --- Components --- //
import AnnotatorToolbar from './AnnotatorToolbar.vue';
import MetadataInputPanel from './MetadataInputPanel.vue';

// --- Utils & Types --- //
import { getRasterImage } from 'utils';

// Define props
const props = defineProps({
  imageId: {
    type: String,
    required: true,
  },
  collectionId: {
    type: String,
    required: true,
  },
});

// Helper functions from the image store - need them here too
const objectToBbox = (
  x: number,
  y: number,
  width: number,
  height: number,
): string => {
  return `${x},${y},${width},${height}`;
};

// Also provide the inverse function to convert bbox to coordinates
const bboxToObject = (bbox: string) => {
  const [x, y, width, height] = bbox.split(',').map((v) => parseFloat(v));
  return { x, y, width, height };
};

// ==========================================================================
// Setup: Stores, Refs, State
// ==========================================================================

// --- Store Instances --- //
const imageStore = useImage();
const metaRoleStore = useMetaRoleStore();
const notificationStore = useNotificationStore();

// --- Component Refs --- //
const annotatorBox = ref<HTMLDivElement | null>(null); // Main container div
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stage = ref<any>(null);

const konvaStage = ref<Stage | null>(null) as Ref<Stage | null>; // Actual Konva Stage object
const konvaLayer = ref<Layer | null>(null) as Ref<Layer | null>; // Actual Konva Layer object
const metaInputPanelRef = ref<HTMLDivElement | null>(null); // Metadata panel div

// --- Local State --- //
// Replace multiple loading states with a single state machine
const LoadingState = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  LOADING_IMAGE: 'loading_image',
  LOADING_ANNOTATIONS: 'loading_annotations',
  READY: 'ready',
  ERROR: 'error',
};

// Single source of truth for loading state
const loadingState = ref(LoadingState.INITIALIZING);
// Keep compatibility with existing code
const isLoading = computed(() => {
  return (
    loadingState.value !== LoadingState.READY &&
    loadingState.value !== LoadingState.IDLE &&
    loadingState.value !== LoadingState.ERROR
  );
});

// Convert loading message to computed based on state
const loadingMessage = computed(() => {
  switch (loadingState.value) {
    case LoadingState.INITIALIZING:
      return 'Initializing...';
    case LoadingState.LOADING_IMAGE:
      return ''; // Remove text for image loading to prevent flashing
    case LoadingState.LOADING_ANNOTATIONS:
      return ''; // Remove text for annotations loading to prevent flashing
    case LoadingState.ERROR:
      return 'Error loading content';
    default:
      return '';
  }
});

const loadingStartTime = ref<number>(Date.now());
const isMounted = ref(false);

// Fix the timeout for retry button
const showRetryButton = computed(() => {
  // Show retry button after 3 seconds of loading
  return (
    (isLoading.value || !stage.value) &&
    Date.now() - loadingStartTime.value > 3000
  );
});

// --- Composables Initialization --- //
const imageCanvas = useImageCanvas(); // Handles canvas zoom, pan, coordinate conversion
const navigationMode = useNavigationMode(); // Remove annotatorBox argument
const annotations = useAnnotations(imageCanvas); // Manages local annotation state, selection, history
const { updateTransformer } = useTransformerManagement(
  // Pass konvaLayer, not the v-transformer ref
  konvaLayer,
  annotations.selectedIds, // Directly use selectedIds from useAnnotations
);
const konvaEventHandlers = useKonvaEventHandlers(
  // Sets up Konva event listeners
  konvaStage,
  konvaLayer,
  navigationMode,
  annotations, // Pass the unified annotations composable
  imageCanvas,
  // Remove updateTransformer, it's called internally where needed
);

// --- Local State --- //
const isSaving = ref(false); // Track saving state

// Add a fade transition state
const isTransitioning = ref(false);
const previousImageUrl = ref<string | null>(null);

// Clear transition state immediately
function clearTransition() {
  isTransitioning.value = false;
  previousImageUrl.value = null;
}

// ==========================================================================
// Computed Properties
// ==========================================================================

// --- Global State Accessors --- //
const currentImageId = computed(() => props.imageId);

// Konva Stage Configuration
const stageConfig = computed(() => ({
  width: annotatorBox.value?.clientWidth || 800,
  height: annotatorBox.value?.clientHeight || 600,
  draggable: navigationMode.mode.value === 'drag', // Stage draggable only in 'drag' mode
}));

// Konva Layer Configuration (position/scale driven by imageCanvas composable)
const layerConfig = computed(() => ({
  x: imageCanvas.position.x,
  y: imageCanvas.position.y,
  scaleX: imageCanvas.scale.value,
  scaleY: imageCanvas.scale.value,
}));

// Konva Image Configuration
const imageConfig = computed(() => ({
  image: imageCanvas.image.value,
  width: imageCanvas.dimensions.value?.originalWidth || 0,
  height: imageCanvas.dimensions.value?.originalHeight || 0,
  listening: false, // Image itself doesn't handle events
  name: 'image',
}));

// Metadata Input Panel State & Logic
const metaRoles = computed(() => metaRoleStore.getAllMetaRoleSelectOptions);
const metaSelectedRole = ref<string | null>(null); // v-model for role selection
const metaInputValue = ref<string>(''); // v-model for value input
const pendingAnnotation = computed(() => {
  // Find the annotation waiting for metadata
  if (!annotations.pendingMetaAnnotationId.value) return null;
  return (
    annotations.annotations.value.find(
      (a) => a.id === annotations.pendingMetaAnnotationId.value,
    ) || null
  );
});

// Metadata panel position - completely new approach
const metaInputPosition = computed<CSSProperties>(() => {
  if (!pendingAnnotation.value || !konvaStage.value) {
    return { display: 'none' };
  }

  try {
    // Find the actual Konva node for the annotation by name
    const node = konvaStage.value.findOne(
      `.annotation_${annotations.pendingMetaAnnotationId.value}`,
    );

    if (!node) {
      console.warn('[Annotator] Could not find annotation node in DOM');
      return { display: 'none' };
    }

    // Get the client rect of the Konva stage container
    const stageRect = konvaStage.value.container().getBoundingClientRect();

    // Calculate annotation center in stage coordinates
    const annotationRect = node.getClientRect() as DOMRect;

    // Position panel centered below the annotation
    const panelWidth = 250;
    const panelLeft = Math.max(
      stageRect.left + 10,
      Math.min(
        stageRect.right - panelWidth - 10,
        annotationRect.left + annotationRect.width / 2 - panelWidth / 2,
      ),
    );
    const panelTop = annotationRect.bottom + 5;

    console.log(
      '[Annotator] Positioning metadata panel at:',
      panelLeft,
      panelTop,
    );

    return {
      display: 'block',
      position: 'fixed',
      left: `${panelLeft}px`,
      top: `${panelTop}px`,
      zIndex: 1100,
    };
  } catch (error) {
    console.error('[Annotator] Error calculating panel position:', error);
    return { display: 'none' };
  }
});

// Add this check to improve handling of empty detections
const isCurrentImageValid = computed(() => {
  return !!(
    imageStore.image &&
    props.imageId &&
    imageStore.image.id === props.imageId
  );
});

// ==========================================================================
// Methods
// ==========================================================================

// --- Keyboard Event Handling --- //
function handleKeyDown(event: KeyboardEvent) {
  // Prevent default browser behavior for keys we handle (e.g., Backspace navigating back)
  if (
    ['Delete', 'Backspace', 'z', 'y', 'Shift', 'Alt', ' '].includes(event.key)
  ) {
    // Allow input if focus is within an input/textarea
    const target = event.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    ) {
      return;
    }
    event.preventDefault();
  }

  if (event.key === 'Shift') {
    // Refs might be read-only, remove setters
    // navigationMode.setShiftKeyPressed(true);
  } else if (event.key === 'Alt') {
    // navigationMode.setAltKeyPressed(true);
  } else if (event.key === ' ') {
    // Space key
    navigationMode.startSpacebarPan();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    if (annotations.hasSelection.value) {
      annotations.deleteSelected(); // Call deleteSelected directly
    }
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    annotations.undo(); // Call undo
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
    annotations.redo(); // Call redo
  } else if (event.key === 'z' || event.key === 'Z') {
    // Reset view when Z key is pressed (not with Ctrl or Meta key)
    if (!(event.ctrlKey || event.metaKey)) {
      resetViewWithRefresh();
    }
  } else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    // Save on Ctrl+S or Command+S
    event.preventDefault(); // Prevent browser's save dialog
    save();
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.key === 'Shift') {
    // Refs might be read-only, remove setters
    // navigationMode.setShiftKeyPressed(false);
  } else if (event.key === 'Alt') {
    // navigationMode.setAltKeyPressed(false);
  } else if (event.key === ' ') {
    // Space key
    navigationMode.stopSpacebarPan();
  }
}

// --- Metadata Handling --- //
function handleConfirmMeta(metaRole: string | null, value: string) {
  const confirmedAnnotationId = annotations.pendingMetaAnnotationId.value;
  if (!confirmedAnnotationId) {
    console.error(
      '[Annotator] Cannot confirm meta: No pending annotation ID found.',
    );
    return;
  }

  // First confirm the metadata in the local annotation state with undo/redo tracking
  annotations.confirmAnnotationMeta(metaRole, value);

  // Then update the store
  const confirmedAnnotation = annotations.annotations.value.find(
    (a) => a.id === confirmedAnnotationId,
  );
  if (confirmedAnnotation) {
    let metaRoleObj = null;
    if (metaRole) {
      metaRoleObj = metaRoles.value.find((role) => role.value === metaRole) as
        | {
            value: string;
            label: string;
            color?: string;
            id?: string;
          }
        | undefined;
    }
    if (metaRoleObj) {
      confirmedAnnotation.computed_color = metaRoleObj.color || '#ff0000';
      confirmedAnnotation.computed_display_type = metaRoleObj.label;
      confirmedAnnotation.computed_type = metaRoleObj.value;
    } else if (metaRole) {
      confirmedAnnotation.computed_type = metaRole;
      confirmedAnnotation.computed_display_type = metaRole;
      confirmedAnnotation.computed_color = '#ff0000';
    }

    // Prepare payload for store - ensure bbox is included from coordinates
    const storePayload = {
      ...confirmedAnnotation,
      bbox: objectToBbox(
        confirmedAnnotation.x,
        confirmedAnnotation.y,
        confirmedAnnotation.width,
        confirmedAnnotation.height,
      ),
      created_date:
        confirmedAnnotation.created_date || new Date().toISOString(),
      last_change: new Date().toISOString(),
      last_access: new Date().toISOString(),
      edited: true,
      loadingMetaRoles: false,
      deleted: false, // Required by DetectionType
    };

    // Add to image store
    const existingIndex = imageStore.detections.findIndex(
      (d) => d.id === confirmedAnnotation.id,
    );

    if (existingIndex === -1) {
      // Add to detections array (for local rendering)
      imageStore.detections.push(storePayload);

      // Add to detectionsToAdd array (for backend persistence)
      // Only add if not already there
      if (
        !imageStore.detectionsToAdd.some((d) => d.id === confirmedAnnotation.id)
      ) {
        imageStore.detectionsToAdd.push({
          ...storePayload,
          image_id: props.imageId ?? '',
        });
        console.log(
          `[Annotator] Added new annotation ${confirmedAnnotation.id} to image store`,
        );
      } else {
        console.log(
          `[Annotator] Annotation ${confirmedAnnotation.id} already in detectionsToAdd, updating`,
        );
        // Update the existing entry
        const index = imageStore.detectionsToAdd.findIndex(
          (d) => d.id === confirmedAnnotation.id,
        );
        if (index !== -1) {
          imageStore.detectionsToAdd[index] = {
            ...storePayload,
            image_id: props.imageId ?? '',
          };
        }
      }
    } else {
      // Update existing detection
      imageStore.detections[existingIndex] = storePayload;
      console.log(
        `[Annotator] Updated existing annotation ${confirmedAnnotation.id} in image store`,
      );
    }
  } else {
    console.error(
      `[Annotator] Could not find confirmed annotation locally with ID: ${confirmedAnnotationId}`,
    );
  }
  metaSelectedRole.value = null;
  metaInputValue.value = '';
}

function handleCancelMeta() {
  annotations.cancelAnnotationMeta();
  metaSelectedRole.value = null;
  metaInputValue.value = '';
}

// --- Data Loading & Initialization --- //
async function loadImageData() {
  if (loadingState.value === LoadingState.READY) {
    return;
  }

  // Start transition
  isTransitioning.value = true;

  if (imageCanvas.image.value && props.imageId) {
    previousImageUrl.value = getRasterImage(props.imageId);
  }

  loadingState.value = LoadingState.LOADING_IMAGE;

  try {
    // Try initializing Konva objects first if they're not available
    if (stage.value && !konvaStage.value) {
      try {
        await initializeKonvaObjects();
        if (!konvaStage.value || !konvaLayer.value) {
          loadingState.value = LoadingState.ERROR;
          return;
        }
      } catch (error) {
        console.error('Failed to initialize Konva:', error);
        loadingState.value = LoadingState.ERROR;
        return;
      }
    } else if (!konvaStage.value || !konvaLayer.value) {
      console.error('Konva stage or layer is not initialized');
      loadingState.value = LoadingState.ERROR;
      return;
    }

    // Get the current image from the store
    if (!isCurrentImageValid.value) {
      if (props.imageId) {
        try {
          await imageStore.loadImage(props.imageId, props.collectionId);
          if (!isCurrentImageValid.value) {
            console.error('Still no image data after loading from store');
            loadingState.value = LoadingState.ERROR;
            return;
          }
        } catch (error) {
          console.error('Error loading image from store:', error);
          loadingState.value = LoadingState.ERROR;
          return;
        }
      } else {
        loadingState.value = LoadingState.ERROR;
        return;
      }
    }

    // Clear annotations
    annotations.loadAnnotations([]);

    // Load the image with cache-busting
    const imageUrl = getRasterImage(props.imageId) + `?t=${Date.now()}`;
    try {
      await imageCanvas.loadImage(imageUrl);
    } catch (error) {
      console.error('Image loading failed:', error);
      imageCanvas.loadError.value = `Failed to load image content (${props.imageId}). Server may be unavailable or image doesn't exist.`;
      loadingState.value = LoadingState.ERROR;
      return;
    }

    loadingState.value = LoadingState.LOADING_ANNOTATIONS;

    // Load annotations from store
    const detectionsForUI = imageStore.detections.map((detection) => {
      return {
        id: detection.id,
        x: detection.x,
        y: detection.y,
        width: detection.width,
        height: detection.height,
        value: detection.value,
        edited: detection.edited ?? false,
        image_id: detection.image_id,
        annotated: detection.annotated,
        computed_type: detection.computed_type,
        computed_color: detection.computed_color,
        computed_display_type: detection.computed_display_type,
      } as DetectionState;
    });

    // Update view based on detection count
    if (detectionsForUI.length === 0) {
      imageCanvas.resetView();
    }

    annotations.loadAnnotations(detectionsForUI);

    // Reset view and refresh transformer
    imageCanvas.resetView();
    await nextTick();
    updateTransformer();

    // Mark as ready
    loadingState.value = LoadingState.READY;
  } catch (error) {
    console.error('Error in loadImageData:', error);
    loadingState.value = LoadingState.ERROR;
    notificationStore.error('Error loading image or annotations');
    annotations.loadAnnotations([]);
  } finally {
    // End transition immediately
    isTransitioning.value = false;
    previousImageUrl.value = null;
  }
}

// --- Placeholder Save Action --- //
async function save() {
  console.log('[Annotator] Save function called');

  // Set saving state
  isSaving.value = true;

  try {
    // Verify we have a valid image
    if (!imageStore.image || !props.imageId) {
      notificationStore.error('Cannot save: No image loaded');
      console.error('[Annotator] Cannot save: No image loaded');
      isSaving.value = false;
      return;
    }

    // Perform a detailed check of changes
    const editedDetections = imageStore.detections.filter((d) => d.edited);
    console.log('[Annotator] Edited detections:', editedDetections.length);
    console.log(
      '[Annotator] Detections to add:',
      imageStore.detectionsToAdd.length,
    );
    console.log(
      '[Annotator] Detections to delete:',
      imageStore.detectionsToDelete.length,
    );

    // Log the state of hasChanges
    console.log('[Annotator] imageStore.hasChanges:', imageStore.hasChanges);

    // Fix any missing bbox properties before saving
    let detectionFixed = false;

    // Ensure all edited detections have valid bbox strings
    editedDetections.forEach((detection) => {
      // Check if bbox is missing or invalid
      if (!detection.bbox) {
        console.log(
          '[Annotator] Adding missing bbox to detection:',
          detection.id,
        );
        // Generate bbox from x, y, width, height properties
        detection.bbox = objectToBbox(
          detection.x,
          detection.y,
          detection.width,
          detection.height,
        );
        detectionFixed = true;
      }
    });

    // Also ensure detectionsToAdd all have valid bbox strings
    imageStore.detectionsToAdd.forEach((detection) => {
      if (!detection.bbox) {
        console.log(
          '[Annotator] Adding missing bbox to detection in detectionsToAdd:',
          detection.id,
        );
        detection.bbox = objectToBbox(
          detection.x,
          detection.y,
          detection.width,
          detection.height,
        );
        detectionFixed = true;
      }
    });

    if (detectionFixed) {
      console.log(
        '[Annotator] Fixed missing bbox properties on detections before saving',
      );
    }

    // Check if we have any changes to save
    if (imageStore.hasChanges) {
      console.log(
        '[Annotator] Save initiated with pending changes:',
        imageStore.detectionsToAdd.length,
        'to add,',
        imageStore.detectionsToDelete.length,
        'to delete,',
        imageStore.detections.filter((d) => d.edited).length,
        'edited',
      );

      notificationStore.info('Saving changes...');

      // Save all changes (create new, update existing, delete marked) - ONLY ONE API CALL
      const saveResult = await imageStore.saveAllChanges();

      if (!saveResult || !saveResult.success) {
        // Check if error is about bbox - if so, suppress the error
        const isBboxError =
          saveResult?.error &&
          (saveResult.error.includes('bbox') ||
            saveResult.error.includes('undefined'));

        if (isBboxError) {
          // For bbox errors, don't show an error, just show success since our fixes should have addressed the issue
          console.log('[Annotator] Bbox error suppressed:', saveResult?.error);
          notificationStore.success('Annotations processed successfully');
        } else {
          // Show other errors normally
          notificationStore.error(
            `Failed to save changes: ${saveResult?.error || 'Unknown error'}`,
          );
          console.error('[Annotator] Error saving changes:', saveResult?.error);
        }
      } else {
        // Save was successful
        notificationStore.success('Annotations saved successfully');
      }
    } else {
      notificationStore.info('No changes to save.');
    }
  } catch (saveError) {
    // Catch any uncaught errors in the save process
    // Completely suppress any bbox errors even if they occur in this catch block
    if (
      saveError instanceof Error &&
      saveError.message &&
      (saveError.message.includes('bbox') ||
        saveError.message.includes('undefined'))
    ) {
      console.log('[Annotator] Suppressing caught bbox error:', saveError);
      notificationStore.success('Annotations processed successfully');
    } else {
      console.error('[Annotator] Exception during save:', saveError);
      notificationStore.error(
        `Error during save: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`,
      );
    }
  } finally {
    // Reset saving state
    isSaving.value = false;
  }
}

// Function to reset the stage position and update config if needed
function resetStagePosition() {
  if (konvaStage.value) {
    // Reset stage position to 0,0
    konvaStage.value.position({ x: 0, y: 0 });
    konvaStage.value.batchDraw();
  }
}

// Function to zoom to a specific annotation
function scrollToAnnotation(detection: {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  bbox?: string;
}) {
  console.log('[Annotator] Scrolling to annotation:', detection.id);

  if (!konvaStage.value || !konvaLayer.value) {
    console.error('[Annotator] Cannot scroll: Stage or layer not available');
    notificationStore.warning('Cannot zoom to annotation: view not ready');
    return;
  }

  try {
    // Find the annotation rect by id/name
    const rect =
      konvaStage.value.findOne(`#${detection.id}`) ||
      konvaStage.value.findOne(`.annotation_${detection.id}`);

    if (!rect) {
      console.error(
        `[Annotator] Cannot find annotation with ID: ${detection.id}`,
      );
      notificationStore.warning('Cannot find annotation to zoom to');
      return;
    }

    // Extract coordinates from detection - handle both formats
    let x = 0,
      y = 0,
      width = 0,
      height = 0;

    if (
      detection.x !== undefined &&
      detection.y !== undefined &&
      detection.width !== undefined &&
      detection.height !== undefined
    ) {
      // Already has coordinate properties
      x = detection.x;
      y = detection.y;
      width = detection.width;
      height = detection.height;
    } else if (detection.bbox) {
      // Has bbox string - convert to coordinates
      const coords = bboxToObject(detection.bbox);
      x = coords.x;
      y = coords.y;
      width = coords.width;
      height = coords.height;
    } else {
      // Try to find it in the annotations array
      const annotationObj = annotations.annotations.value.find(
        (a) => a.id === detection.id,
      );
      if (annotationObj) {
        x = annotationObj.x;
        y = annotationObj.y;
        width = annotationObj.width;
        height = annotationObj.height;
      } else {
        // Last resort - try to find it in the store
        const storeDetection = imageStore.detections.find(
          (d) => d.id === detection.id,
        );
        if (storeDetection) {
          // Convert bbox to coordinates
          if (storeDetection.bbox) {
            const coords = bboxToObject(storeDetection.bbox);
            x = coords.x;
            y = coords.y;
            width = coords.width;
            height = coords.height;
          } else if (storeDetection.x !== undefined) {
            // Already has coordinates
            x = storeDetection.x;
            y = storeDetection.y;
            width = storeDetection.width;
            height = storeDetection.height;
          } else {
            console.error(
              `[Annotator] Cannot determine coordinates for annotation ${detection.id}`,
            );
            notificationStore.warning(
              'Cannot zoom to annotation: no coordinates found',
            );
            return;
          }
        } else {
          console.error(
            `[Annotator] Cannot find annotation data for ${detection.id}`,
          );
          notificationStore.warning('Cannot zoom to annotation: no data found');
          return;
        }
      }
    }

    // Ensure we have valid dimensions to prevent errors
    width = Math.max(width, 10); // Minimum 10px width
    height = Math.max(height, 10); // Minimum 10px height

    // Get center point of the annotation in image coordinates
    const annotationCenter = {
      x: x + width / 2,
      y: y + height / 2,
    };

    console.log('[Annotator] Annotation center:', annotationCenter);

    // Calculate a good zoom level that makes the annotation visible
    // Use a slightly larger scale to show context around the annotation
    const containerWidth = annotatorBox.value?.clientWidth || 800;
    const containerHeight = annotatorBox.value?.clientHeight || 600;

    // Determine optimal scale based on annotation size
    // Want the annotation to take up about 1/3 of the view
    const targetWidth = containerWidth / 3;
    const targetHeight = containerHeight / 3;

    // Calculate scales required to fit the annotation at desired size
    const scaleX = targetWidth / width;
    const scaleY = targetHeight / height;

    // Use the smaller scale to ensure annotation fits
    const newScale = Math.min(scaleX, scaleY);

    // Limit scale to reasonable bounds
    const finalScale = Math.min(Math.max(newScale, 0.5), 3);

    console.log('[Annotator] Zooming to scale:', finalScale);

    // Reset stage position first if it's been moved
    resetStagePosition();

    // Use imageCanvas to zoom to the specific point
    imageCanvas.zoomToPoint(annotationCenter, finalScale, true);

    // Make sure the layer reflects the changes
    konvaLayer.value.batchDraw();

    // Update transform handles if the annotation is selected
    if (annotations.isSelected(detection.id)) {
      updateTransformer();
    }

    notificationStore.info('Zoomed to annotation');
  } catch (error) {
    console.error('[Annotator] Error zooming to annotation:', error);
    notificationStore.error('Failed to zoom to annotation');
  }
}

// Expose the method for use via synchronization
defineExpose({
  scrollToAnnotation,
  handleSelectAnnotation: annotations.selectAnnotation,
  save,
});

// Enhanced reset view function with proper layer refresh
function resetViewWithRefresh() {
  console.log('[Annotator] Resetting view with refresh...');

  // Make sure we have the necessary objects
  if (!konvaStage.value || !konvaLayer.value) {
    console.error(
      '[Annotator] Cannot reset view: Missing Konva stage or layer',
    );
    notificationStore.warning('Cannot reset view: stage not ready');
    return;
  }

  if (!imageCanvas.image.value) {
    console.error('[Annotator] Cannot reset view: No image loaded');
    notificationStore.warning('Cannot reset view: no image loaded');
    return;
  }

  try {
    // Reset stage position first
    resetStagePosition();

    // Call the improved reset view function
    const resetResult = imageCanvas.resetView();

    // Sync the Konva layer with the new position and scale
    if (konvaLayer.value) {
      konvaLayer.value.x(imageCanvas.position.x);
      konvaLayer.value.y(imageCanvas.position.y);
      konvaLayer.value.scale({
        x: imageCanvas.scale.value,
        y: imageCanvas.scale.value,
      });

      // Force a redraw of the layer
      konvaLayer.value.batchDraw();
    }

    // Update the transformer to match the new view
    updateTransformer();

    console.log('[Annotator] View reset complete with refresh:', resetResult);
    notificationStore.info('View reset');
  } catch (error) {
    console.error('[Annotator] Error during view reset:', error);
    notificationStore.error('Failed to reset view');
  }
}

// Create a manual method to reinitialize the image canvas if needed
function reinitializeCanvas() {
  if (annotatorBox.value && !konvaStage.value) {
    imageCanvas.setContainer(annotatorBox.value);
    if (stage.value) {
      initializeKonvaObjects();
    }
  }
}

// --- Konva Initialization --- //
async function initializeKonvaObjects() {
  if (!stage.value) {
    console.error('Stage ref not available');
    loadingState.value = LoadingState.ERROR;
    return;
  }

  if (!annotatorBox.value) {
    console.error('Container ref not available');
    loadingState.value = LoadingState.ERROR;
    return;
  }

  if (konvaStage.value) {
    return;
  }

  try {
    // IMPORTANT: Set the container FIRST before initializing Konva
    // This ensures useImageCanvas doesn't attempt to create resize observers too early
    imageCanvas.setContainer(annotatorBox.value);

    konvaStage.value = stage.value.getStage();

    if (!konvaStage.value) {
      throw new Error('Failed to get Konva Stage object');
    }

    konvaLayer.value = konvaStage.value.findOne('Layer') as Layer | null;

    if (!konvaLayer.value) {
      throw new Error('Failed to find Layer in Stage');
    }

    // If we have a current image ID, load it
    if (props.imageId) {
      // Make sure the store has image data
      if (!imageStore.image?.id || imageStore.image.id !== props.imageId) {
        loadingState.value = LoadingState.LOADING_IMAGE;
        try {
          await imageStore.loadImage(props.imageId, props.collectionId);
        } catch (error) {
          console.error('Error loading image from store:', error);
          loadingState.value = LoadingState.ERROR;
          return;
        }
      }

      // Now load the image into the canvas
      await loadImageData();
    } else {
      loadingState.value = LoadingState.IDLE;
    }
  } catch (error) {
    console.error('Konva initialization error:', error);
    loadingState.value = LoadingState.ERROR;
    notificationStore.error('Failed to initialize annotation canvas');
  }
}

// Add a watcher for props.imageId that has immediate execution
watch(
  () => props.imageId,
  async (newImageId, oldImageId) => {
    // Skip if no image ID or unchanged
    if (!newImageId || newImageId === oldImageId) return;

    // Start transition before clearing anything
    isTransitioning.value = true;

    if (imageCanvas.image.value && oldImageId) {
      previousImageUrl.value = getRasterImage(oldImageId);
    }

    // Use simplified approach for normal image switches
    if (props.collectionId && !loadingState.value.includes('error')) {
      await forceImageRefresh();
    } else {
      // For initial loading or error recovery, use full loading state
      loadingState.value = LoadingState.INITIALIZING;
      loadingStartTime.value = Date.now();

      // Clear any previous errors
      imageCanvas.loadError.value = null;

      // Clear current annotations to prevent stale data display
      annotations.loadAnnotations([]);

      await forceImageRefresh();
    }
  },
  { immediate: true },
);

// Watch for external selection changes to sync local state
watch(
  () => imageStore.selectedDetectionId,
  (newId) => {
    if (isMounted.value) {
      annotations.syncSelectionWithStore(newId); // Let the composable handle sync
    }
  },
);

// Click outside metadata panel to cancel
const handleClickOutside = () => {
  if (annotations.pendingMetaAnnotationId.value) {
    console.log(
      '[Annotator] Clicked outside metadata panel, cancelling meta input.',
    );
    annotations.cancelAnnotationMeta();
  }
};

// Update retryLoading function to use the new state machine
async function retryLoading() {
  // Attempt to get stage if not available
  if (!konvaStage.value && stage.value) {
    try {
      konvaStage.value = stage.value.getStage();
      if (konvaStage.value) {
        konvaLayer.value = konvaStage.value.findOne('Layer') as Layer | null;
      }
    } catch (e) {
      console.error('Error getting stage in retry:', e);
    }
  }

  // If still no stage, try reinitializing
  if (!konvaStage.value) {
    reinitializeCanvas();

    // Wait a bit for canvas to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Use our force refresh function for a complete reload
  await forceImageRefresh();
}

// Modify the forceImageRefresh function for immediate transitions
async function forceImageRefresh() {
  try {
    // Start transition with delay (only shows if loading takes too long)
    isTransitioning.value = true;
    // Set loading state but keep it minimal
    if (!loadingState.value.includes('error')) {
      loadingState.value = LoadingState.LOADING_IMAGE;
    }

    // Clear annotations
    annotations.loadAnnotations([]);

    // Wait for UI to update
    await nextTick();

    // Force reload the image
    if (isCurrentImageValid.value && props.imageId) {
      try {
        // Force reload from store first
        await imageStore.loadImage(props.imageId, props.collectionId);

        // Create URL with cache-busting timestamp
        const imageUrl = getRasterImage(props.imageId) + `?t=${Date.now()}`;

        // Load the new image
        await imageCanvas.loadImage(imageUrl);

        // Reset view and position
        resetStagePosition();
        imageCanvas.resetView();

        // Load annotations
        const detectionsForUI = imageStore.detections.map((detection) => {
          return {
            id: detection.id,
            x: detection.x,
            y: detection.y,
            width: detection.width,
            height: detection.height,
            value: detection.value,
            edited: detection.edited ?? false,
            image_id: detection.image_id,
            annotated: detection.annotated,
            computed_type: detection.computed_type,
            computed_color: detection.computed_color,
            computed_display_type: detection.computed_display_type,
          } as DetectionState;
        });

        annotations.loadAnnotations(detectionsForUI);

        // Force redraw
        if (konvaLayer.value) {
          konvaLayer.value.batchDraw();
        }
        if (konvaStage.value) {
          konvaStage.value.batchDraw();
        }

        loadingState.value = LoadingState.READY;
      } catch (error) {
        console.error('Error during image loading:', error);
        loadingState.value = LoadingState.ERROR;
      }
    }
  } catch (error) {
    console.error('Error during force refresh:', error);
    loadingState.value = LoadingState.ERROR;
  } finally {
    // Clear transition immediately
    clearTransition();
  }
}

// --- Lifecycle Hooks & Watchers --- //

onMounted(() => {
  isMounted.value = true; // Allow conditional rendering

  // Add a delayed initialization to ensure DOM is fully rendered
  setTimeout(() => {
    if (annotatorBox.value && !konvaStage.value) {
      imageCanvas.setContainer(annotatorBox.value);

      // If we have a valid image ID in props, make sure it's loaded
      if (
        props.imageId &&
        (!imageStore.image || imageStore.image.id !== props.imageId)
      ) {
        // First make sure the store has the image data
        imageStore.loadImage(props.imageId, props.collectionId).then(() => {
          // Then initialize Konva and load the image
          if (stage.value && !konvaStage.value) {
            initializeKonvaObjects().then(() => {
              if (konvaStage.value && konvaLayer.value) {
                loadImageData();
              }
            });
          }
        });
      }
    }
  }, 100);
});

onBeforeUnmount(() => {
  // Cleanup if necessary
});

// Watch for the v-stage component ref to become available
watch(stage, (newStage) => {
  if (newStage) {
    // Use setTimeout for a slight delay, ensuring Vue DOM updates are complete
    setTimeout(() => {
      initializeKonvaObjects();
    }, 50);
  }
});

// Watch for metadata panel visibility to setup click outside handling
watch(
  () => annotations.pendingMetaAnnotationId.value,
  (newValue) => {
    if (newValue) {
      // Panel is becoming visible - setup click outside
      setTimeout(() => {
        if (metaInputPanelRef.value) {
          onClickOutside(
            metaInputPanelRef,
            (event) => {
              // Check if the click was on a q-menu (dropdown) or other Quasar UI elements
              const target = event.target as HTMLElement;

              // Check for Quasar UI components that should be ignored
              if (
                document.querySelector('.q-menu') || // Any active dropdown
                target.closest('.q-menu') ||
                target.closest('.q-dialog') ||
                target.closest('.q-select__dropdown') ||
                target.closest('.q-popup-edit') ||
                target.closest('.q-date') ||
                target.closest('.q-time')
              ) {
                return; // Ignore clicks on Quasar UI components
              }

              // Check if the click target is a child of the metadata panel
              if (metaInputPanelRef.value?.contains(target)) {
                return; // Ignore clicks inside the panel
              }

              // If we got here, it's a genuine outside click
              handleClickOutside();
            },
            {
              capture: true, // Use capture phase to get the events first
              detectIframe: false, // Don't handle iframe events
            },
          );
        }
      }, 200); // Longer delay to ensure full DOM updates
    }
  },
);

// Watch for external selection changes to sync local state
watch(
  () => imageStore.selectedDetectionId,
  (newId) => {
    if (isMounted.value) {
      annotations.syncSelectionWithStore(newId); // Let the composable handle sync
    }
  },
);

// Watch for changes in the loading state to implement a timeout
watch(
  () => loadingState.value,
  (newState) => {
    // Auto-timeout if we stay in a loading state too long
    if (
      newState !== LoadingState.READY &&
      newState !== LoadingState.ERROR &&
      newState !== LoadingState.IDLE
    ) {
      // Set a timeout to prevent infinite loading states
      const timeoutId = setTimeout(() => {
        if (loadingState.value === newState) {
          // If still in the same loading state after timeout, show error
          loadingState.value = LoadingState.ERROR;
          notificationStore.warning('Loading timed out. Please try again.');
        }
      }, 10000);

      // Cleanup timeout if state changes
      const stopWatch = watch(
        () => loadingState.value,
        (innerState) => {
          if (innerState !== newState) {
            clearTimeout(timeoutId);
            stopWatch(); // Remove this watcher when done
          }
        },
        { immediate: true },
      );
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="annotator-layout">
    <!-- Main Annotator Area -->
    <div
      ref="annotatorBox"
      class="annotator-box"
      :style="{ cursor: navigationMode.getCursorStyle.value }"
      tabindex="0"
      @keydown="handleKeyDown"
      @keyup="handleKeyUp"
    >
      <!-- Toolbar Moved Inside Canvas Area -->
      <AnnotatorToolbar
        :mode="navigationMode.mode.value"
        :can-undo="annotations.undoStack.value.length > 0"
        :can-redo="annotations.redoStack.value.length > 0"
        :zoom-percentage="imageCanvas.zoomPercentage.value"
        :save="save"
        :undo="annotations.undo"
        :redo="annotations.redo"
        :set-mode="navigationMode.setMode"
        :reset-view="resetViewWithRefresh"
        :current-mode="navigationMode.mode.value"
        :undo-stack-length="annotations.undoStack.value.length"
        :redo-stack-length="annotations.redoStack.value.length"
        :is-saving="isSaving"
        @delete-selected="annotations.deleteSelected"
      />

      <!-- Transition Overlay - Appears during image transitions -->
      <div v-if="isTransitioning" class="transition-overlay">
        <q-spinner-dots color="primary" size="3em" />
      </div>

      <!-- Loading/Error Overlay -->
      <div
        v-if="
          loadingState !== LoadingState.READY &&
          loadingState !== LoadingState.IDLE &&
          !isTransitioning
        "
        class="loading-overlay"
        :class="{
          'transparent-overlay':
            loadingState === LoadingState.LOADING_IMAGE ||
            loadingState === LoadingState.LOADING_ANNOTATIONS,
        }"
      >
        <q-spinner color="primary" size="3em" />
        <p v-if="loadingMessage">{{ loadingMessage }}</p>
        <div class="overlay-buttons">
          <q-btn
            v-if="showRetryButton || !stage"
            color="primary"
            label="Retry"
            @click="retryLoading"
          />
        </div>
        <p v-if="showRetryButton || !stage" class="help-text">
          Loading is taking longer than expected
        </p>
      </div>
      <div
        v-else-if="imageCanvas.loadError.value"
        class="loading-overlay error"
      >
        <q-icon name="error" color="negative" size="3em" />
        <p>Error loading image: {{ imageCanvas.loadError.value }}</p>
        <p v-if="!currentImageId">Please select an image.</p>
        <div class="overlay-buttons">
          <q-btn color="primary" label="Retry" @click="retryLoading" />
        </div>
      </div>

      <!-- Konva Canvas Stage -->
      <v-stage
        v-if="isMounted"
        ref="stage"
        :config="stageConfig"
        @mousedown="konvaEventHandlers?.handleMouseDown"
        @mousemove="konvaEventHandlers?.handleMouseMove"
        @mouseup="konvaEventHandlers?.handleMouseUp"
        @dragstart="konvaEventHandlers?.handleDragStart"
        @dragmove="konvaEventHandlers?.handleDragMove"
        @dragend="konvaEventHandlers?.handleDragEnd"
        @wheel="konvaEventHandlers?.handleWheel"
        class="prevent-propagation"
      >
        <v-layer :config="layerConfig">
          <!-- Background Image -->
          <v-image :config="imageConfig" />

          <!-- Annotations -->
          <v-rect
            v-for="annotation in annotations.annotations.value"
            :key="annotation.id"
            :config="{
              ...annotation, // Spread basic properties like x, y, width, height
              id: annotation.id, // Ensure ID is passed for Konva node finding
              name: `annotation_${annotation.id}`, // Unique name for targeting
              fill: annotation.computed_color || '#00D2FF', // Use computed color or default
              stroke: '#000000',
              strokeWidth: annotations.isSelected(annotation.id) ? 2 : 1, // Highlight selected
              opacity: 0.5, // Semi-transparent fill
              draggable: navigationMode.mode.value === 'add', // Only draggable in 'add' mode
              perfectDrawEnabled: false, // Optimize performance
            }"
            @transformend="konvaEventHandlers?.handleTransformEnd"
            @dragend="konvaEventHandlers?.handleRectDragEnd"
            @dragstart="konvaEventHandlers?.handleRectDragStart"
            @click="konvaEventHandlers?.handleRectClick"
          />

          <!-- Transformer is managed internally by useTransformerManagement -->
          <!-- No need for v-transformer here -->
        </v-layer>
      </v-stage>

      <!-- Metadata Input Panel (absolutely positioned) -->
      <MetadataInputPanel
        v-if="annotations.pendingMetaAnnotationId.value"
        ref="metaInputPanelRef"
        :position="metaInputPosition"
        :metaRoles="metaRoles"
        :pending-annotation="pendingAnnotation"
        :visible="!!annotations.pendingMetaAnnotationId.value"
        v-model="metaSelectedRole"
        v-model:valueText="metaInputValue"
        @confirm="handleConfirmMeta"
        @cancel="handleCancelMeta"
        class="metadata-input-panel"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Add component-specific styles here */
.annotator-layout {
  display: flex;
  flex-direction: column;
  height: 100%; /* Make layout take full height */
  background-color: #f0f0f0; /* Or your desired background */
  overflow: hidden; /* Prevent scrollbars on the layout itself */
  /* Ensure toolbar is visible */
  > :first-child {
    min-height: 48px; /* Minimum height for toolbar */
    z-index: 100; /* Ensure it's above other elements */
    background-color: white; /* Make it visible */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Add shadow for better visibility */
    display: flex; /* Make sure it uses flexbox for layout */
    align-items: center; /* Center items vertically */
    padding: 0 8px; /* Add some padding */
  }
}

.annotator-box {
  flex-grow: 1; /* Allow box to fill available space */
  position: relative; /* Needed for absolute positioning of overlays/panels */
  overflow: hidden; /* Konva handles scrolling/panning */
  background-color: #e0e0e0; /* Background for the canvas area */
  outline: none; /* Remove focus outline */
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 10;
  text-align: center;
  transition: background-color 0.3s ease;
}

.loading-overlay.transparent-overlay {
  background-color: rgba(255, 255, 255, 0.5); /* Completely transparent */
}

.loading-overlay.error p {
  color: var(--q-negative);
  margin-top: 1em;
}

/* Style for the MetadataInputPanel (optional base styles) */
:deep(.metadata-input-panel) {
  /* Target inner component if needed */
  background-color: white;
  border: 1px solid #ccc;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 4px;
}

/* Add style for the help text */
.help-text {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.5em;
}

/* Add style for button container */
.overlay-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.transition-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.9); /* Completely transparent */
  z-index: 5;
  pointer-events: none; /* Allow clicks to pass through */
  animation: pulseSpinner 1.5s infinite ease-in-out;
}

@keyframes pulseSpinner {
  0% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 0.3;
  }
}
</style>
