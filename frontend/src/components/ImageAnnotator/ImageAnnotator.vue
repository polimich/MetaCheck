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
import { onClickOutside as useClickOutside } from '@vueuse/core';

// --- Stores --- //
import { useImageStore } from 'src/stores/data/useImage';
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
const imageStore = useImageStore();
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
      return 'Initializing annotator...';
    case LoadingState.LOADING_IMAGE:
      return 'Loading image...';
    case LoadingState.LOADING_ANNOTATIONS:
      return 'Processing annotations...';
    case LoadingState.ERROR:
      return 'Error loading content';
    default:
      return '';
  }
});

const loadingStartTime = ref<number>(Date.now());
const isMounted = ref(false);
const debugState = ref<string>('initial');

// Add a reactive timer
const currentTime = ref(Date.now());
const elapsedTime = computed(() => {
  return Math.floor((currentTime.value - loadingStartTime.value) / 1000);
});

// Add method to update time
function updateTime() {
  currentTime.value = Date.now();
}

// Add additional debug info for v-stage rendering
const stageRenderingBlocked = computed(() => {
  // Return the reason why v-stage isn't rendering
  if (isLoading.value) return 'isLoading is true';
  if (imageCanvas.loadError.value)
    return `loadError: ${imageCanvas.loadError.value}`;
  if (!isMounted.value) return 'component not mounted';
  return 'none - should render';
});

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
  debugState.value = 'loadImageData';
  console.log('[Annotator DEBUG] loadImageData called');

  // Set loading state and reset timer
  loadingState.value = LoadingState.LOADING_IMAGE;
  loadingStartTime.value = Date.now();

  // Exit early if still initializing
  if (!konvaStage.value || !konvaLayer.value) {
    console.warn(
      '[Annotator DEBUG] Attempted to load image before Konva initialization',
    );
    loadingState.value = LoadingState.ERROR;
    return;
  }

  // Get the current image from the store directly
  if (!imageStore.image || !props.imageId) {
    console.error('[Annotator DEBUG] No image data in store');
    loadingState.value = LoadingState.ERROR;
    return;
  }

  try {
    console.log('[Annotator DEBUG] Loading image:', props.imageId);

    // Construct URL using the ID from props
    const imageUrl = getRasterImage(props.imageId) + `?t=${Date.now()}`;
    await imageCanvas.loadImage(imageUrl);
    console.log('[Annotator DEBUG] Image loaded into canvas successfully');

    loadingState.value = LoadingState.LOADING_ANNOTATIONS;

    // Load annotations from store - use the UI-ready detections from the store
    // These already have x, y, width, height properties extracted from bbox
    const detectionsForUI = imageStore.detections.map((detection) => {
      // Convert from DetectionWithUI (in the store) to DetectionState (for annotations)
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
    console.log(
      '[Annotator DEBUG] Loaded annotations:',
      imageStore.detections.length,
    );

    // Reset view and refresh transformer
    imageCanvas.resetView();
    await nextTick();
    updateTransformer();

    // Mark as ready
    debugState.value = 'ready';
    loadingState.value = LoadingState.READY;
    console.log('[Annotator DEBUG] Image and annotations fully loaded');
  } catch (error) {
    console.error('[Annotator DEBUG] Error in loadImageData:', error);
    debugState.value = 'error';
    loadingState.value = LoadingState.ERROR;
    notificationStore.error('Error loading image or annotations');
    annotations.loadAnnotations([]);
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
    } else {
      notificationStore.info('No changes to save.');
      isSaving.value = false; // Reset saving state
      return; // Nothing to save
    }

    // Save all changes (create new, update existing, delete marked)
    const saveResult = await imageStore.saveAllChanges();

    if (!saveResult || !saveResult.success) {
      notificationStore.error(
        `Failed to save changes: ${saveResult?.error || 'Unknown error'}`,
      );
      console.error('[Annotator] Error saving changes:', saveResult?.error);
    } else {
      notificationStore.success('Annotations saved successfully');
    }
  } catch (error) {
    notificationStore.error(
      `Error saving annotations: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    console.error('[Annotator] Error in save function:', error);
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

// --- Konva Initialization --- //
async function initializeKonvaObjects() {
  debugState.value = 'initKonva';
  console.log('[Annotator DEBUG] initializeKonvaObjects called');

  if (!stage.value) {
    console.error('[Annotator DEBUG] Stage ref not available');
    loadingState.value = LoadingState.ERROR;
    return;
  }

  if (!annotatorBox.value) {
    console.error('[Annotator DEBUG] Container ref not available');
    loadingState.value = LoadingState.ERROR;
    return;
  }

  if (konvaStage.value) {
    console.log('[Annotator DEBUG] Konva already initialized');
    return;
  }

  try {
    // IMPORTANT: Set the container FIRST before initializing Konva
    // This ensures useImageCanvas doesn't attempt to create resize observers too early
    console.log('[Annotator DEBUG] Setting container for imageCanvas');
    imageCanvas.setContainer(annotatorBox.value);

    console.log('[Annotator DEBUG] Getting Konva Stage from component ref');
    konvaStage.value = stage.value.getStage();

    if (!konvaStage.value) {
      throw new Error('Failed to get Konva Stage object');
    }

    console.log('[Annotator DEBUG] Finding Konva Layer');
    konvaLayer.value = konvaStage.value.findOne('Layer') as Layer | null;

    if (!konvaLayer.value) {
      throw new Error('Failed to find Layer in Stage');
    }

    debugState.value = 'konvaReady';
    console.log('[Annotator DEBUG] Konva successfully initialized');

    // If we have a current image ID, load it
    if (props.imageId) {
      console.log(
        '[Annotator DEBUG] Loading initial image data after Konva init',
      );
      // Make sure the store has image data
      if (!imageStore.image?.id || imageStore.image.id !== props.imageId) {
        loadingState.value = LoadingState.LOADING_IMAGE;
        try {
          console.log(
            '[Annotator DEBUG] Loading image from store:',
            props.imageId,
          );
          await imageStore.loadImage(props.imageId);
        } catch (error) {
          console.error(
            '[Annotator DEBUG] Error loading image from store:',
            error,
          );
          loadingState.value = LoadingState.ERROR;
          return;
        }
      }

      // Now load the image into the canvas
      await loadImageData();
    } else {
      console.log(
        '[Annotator DEBUG] No image ID in props, skipping data loading',
      );
      loadingState.value = LoadingState.IDLE;
    }
  } catch (error) {
    console.error('[Annotator DEBUG] Konva initialization error:', error);
    debugState.value = 'error';
    notificationStore.error('Failed to initialize annotation canvas');
    loadingState.value = LoadingState.ERROR;
  }
}

// Create a manual method to reinitialize the image canvas if needed
function reinitializeCanvas() {
  console.log('[Annotator DEBUG] Reinitializing canvas manually');
  if (annotatorBox.value && !konvaStage.value) {
    imageCanvas.setContainer(annotatorBox.value);
    if (stage.value) {
      initializeKonvaObjects();
    }
  }
}

// ==========================================================================
// Lifecycle Hooks & Watchers
// ==========================================================================

onMounted(() => {
  console.log('[Annotator DEBUG] Component mounted');
  debugState.value = 'mounted';
  isMounted.value = true; // Allow conditional rendering

  // Add a delayed initialization to ensure DOM is fully rendered
  setTimeout(() => {
    if (annotatorBox.value && !konvaStage.value) {
      console.log('[Annotator DEBUG] Running delayed initialization');
      imageCanvas.setContainer(annotatorBox.value);
    }
  }, 100);

  // Start timer update interval
  const timerInterval = setInterval(updateTime, 1000);

  // Add a check for visible annotations to force-hide loading
  const visibilityCheck = setInterval(() => {
    // If we're still loading but annotations are present in the DOM, force hide
    if (
      loadingState.value !== LoadingState.READY &&
      loadingState.value !== LoadingState.IDLE &&
      annotations.annotations.value.length > 0 &&
      konvaStage.value &&
      elapsedTime.value > 2
    ) {
      console.log(
        '[Annotator DEBUG] Annotations visible but loading still active - forcing hide',
      );
      forceHideLoadingOverlay();
    }
  }, 1000);

  // Clean up intervals on unmount
  onBeforeUnmount(() => {
    clearInterval(timerInterval);
    clearInterval(visibilityCheck);
  });
});

onBeforeUnmount(() => {
  // Cleanup if necessary (e.g., remove event listeners manually added)
  console.log('[Annotator] Component unmounting.');
});

// --- Watchers --- //

// Watch for the v-stage component ref to become available
watch(stage, (newStage) => {
  console.log('[Annotator DEBUG] Stage ref changed:', !!newStage);
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
    console.log(
      '[Annotator DEBUG] Metadata panel visibility changed:',
      !!newValue,
    );
    if (newValue) {
      // Panel is becoming visible - setup click outside after a small delay to ensure DOM updates
      setTimeout(() => {
        if (metaInputPanelRef.value) {
          console.log(
            '[Annotator DEBUG] Setting up click outside for metadata panel',
          );
          useClickOutside(
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
                console.log(
                  '[Annotator DEBUG] Click on or during active Quasar UI component, ignoring',
                );
                return; // Ignore clicks on Quasar UI components
              }

              // Check if the click target is a child of the metadata panel
              if (metaInputPanelRef.value?.contains(target)) {
                console.log(
                  '[Annotator DEBUG] Click inside metadata panel, ignoring',
                );
                return; // Ignore clicks inside the panel
              }

              // If we got here, it's a genuine outside click
              console.log(
                '[Annotator DEBUG] Genuine outside click detected, handling...',
              );
              handleClickOutside();
            },
            {
              capture: true, // Use capture phase to get the events first
              detectIframe: false, // Don't handle iframe events
            },
          );
        } else {
          console.log(
            '[Annotator DEBUG] Cannot setup click outside - metaInputPanelRef not available',
          );
        }
      }, 200); // Longer delay to ensure full DOM updates
    }
  },
);

// Watch for changes in the selected image ID
watch(
  () => loadingState.value,
  (newState) => {
    // Auto-timeout if we stay in a loading state too long
    if (
      newState !== LoadingState.READY &&
      newState !== LoadingState.ERROR &&
      newState !== LoadingState.IDLE
    ) {
      const timeoutId = setTimeout(() => {
        if (loadingState.value === newState) {
          console.log(
            `[Annotator DEBUG] Loading state ${newState} timed out after 10s`,
          );
          // Update with mutation instead of assignment
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

// Update watch for image ID changes to use state machine and props
watch(
  () => props.imageId,
  async (newImageId, oldImageId) => {
    debugState.value = 'watchImageId';
    console.log(
      '[Annotator DEBUG] imageId prop changed:',
      oldImageId,
      '->',
      newImageId,
    );

    if (!isMounted.value) {
      console.log(
        '[Annotator DEBUG] Component not mounted yet, deferring image load',
      );
      return;
    }

    if (!newImageId) {
      console.log('[Annotator DEBUG] New image ID is empty, clearing state');
      loadingState.value = LoadingState.IDLE;
      annotations.loadAnnotations([]);
      return;
    }

    if (newImageId === oldImageId) {
      console.log('[Annotator DEBUG] Image ID unchanged, skipping load');
      return;
    }

    loadingState.value = LoadingState.LOADING_IMAGE;

    try {
      console.log('[Annotator DEBUG] Loading image from store:', newImageId);
      await imageStore.loadImage(newImageId);

      // Check if Konva is initialized
      if (!konvaStage.value) {
        console.warn(
          '[Annotator DEBUG] Konva not initialized yet, waiting for stage initialization',
        );
        // Don't try to force initialization here - let the stage watcher handle it
        loadingState.value = LoadingState.ERROR;
        return;
      }

      await loadImageData();
    } catch (error) {
      console.error('[Annotator DEBUG] Error in imageId watcher:', error);
      notificationStore.error('Failed to load image');
      loadingState.value = LoadingState.ERROR;
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
  console.log('[Annotator DEBUG] Manual retry triggered');
  loadingStartTime.value = Date.now();
  debugState.value = 'retry';

  // Set loading state to initializing
  loadingState.value = LoadingState.INITIALIZING;

  // Clear any error state
  imageCanvas.loadError.value = null;

  // Wait for next tick to ensure Vue updates DOM
  await nextTick();

  // Attempt to get stage if not available
  if (!konvaStage.value && stage.value) {
    try {
      console.log('[Annotator DEBUG] Getting stage in retry');
      konvaStage.value = stage.value.getStage();
      if (konvaStage.value) {
        console.log('[Annotator DEBUG] Konva stage obtained in retry');
        konvaLayer.value = konvaStage.value.findOne('Layer') as Layer | null;
      }
    } catch (e) {
      console.error('[Annotator DEBUG] Error getting stage in retry:', e);
    }
  }

  // If still no stage, try reinitializing
  if (!konvaStage.value) {
    reinitializeCanvas();
  }

  // If we have image data, try loading it
  if (imageStore.image?.id && konvaStage.value) {
    try {
      await loadImageData();
    } catch (e) {
      console.error('[Annotator DEBUG] Retry loading failed:', e);
      loadingState.value = LoadingState.ERROR;
      notificationStore.error('Retry failed. Please refresh the page.');
    }
  } else if (props.imageId) {
    try {
      await imageStore.loadImage(props.imageId);
      if (konvaStage.value) {
        await loadImageData();
      }
    } catch (e) {
      console.error('[Annotator DEBUG] Retry image loading failed:', e);
      loadingState.value = LoadingState.ERROR;
      notificationStore.error('Retry failed. Please refresh the page.');
    }
  }
}

// Update forceHideLoadingOverlay function to use the new state
function forceHideLoadingOverlay() {
  console.log('[Annotator DEBUG] FORCE HIDING LOADING OVERLAY');
  // Set state to ready
  loadingState.value = LoadingState.READY;
  debugState.value = 'ready';

  // Try to access reactive property if it exists
  if (imageCanvas.isLoading && typeof imageCanvas.isLoading === 'object') {
    imageCanvas.isLoading.value = false;
  }

  // Force update the view if image is loaded
  if (imageCanvas.image.value && konvaStage.value) {
    try {
      imageCanvas.resetView();
      updateTransformer();
    } catch (e) {
      console.error(
        '[Annotator DEBUG] Error updating view during force hide:',
        e,
      );
    }
  }

  // Notify user the loading has been manually hidden
  notificationStore.info('Loading overlay manually hidden');
}

// Add a watch for image loaded events to update loading state
watch(
  () => imageCanvas.image.value,
  (newImage) => {
    if (newImage && isLoading.value) {
      console.log('[Annotator DEBUG] Image loaded in canvas, updating view...');
      // Give a small delay to ensure the canvas has time to render
      setTimeout(() => {
        try {
          if (konvaStage.value && konvaLayer.value) {
            imageCanvas.resetView();
            updateTransformer();
            console.log('[Annotator DEBUG] View reset after image load');
          }
        } catch (e) {
          console.error('[Annotator DEBUG] Error updating view:', e);
        }

        // If the image is loaded but we're still in loading state, force update
        if (
          debugState.value === 'loadingAnnotations' &&
          elapsedTime.value > 5
        ) {
          console.log('[Annotator DEBUG] Force completing load sequence');
          forceHideLoadingOverlay();
        }
      }, 200);
    }
  },
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

      <!-- Loading/Error Overlay -->
      <div
        v-if="
          loadingState !== LoadingState.READY &&
          loadingState !== LoadingState.IDLE
        "
        class="loading-overlay"
      >
        <q-spinner color="primary" size="3em" />
        <p>{{ loadingMessage }}</p>
        <div class="overlay-buttons">
          <q-btn
            v-if="showRetryButton || !stage"
            color="primary"
            label="Retry"
            @click="retryLoading"
          />
          <q-btn
            color="warning"
            label="Force Hide Loading"
            @click="forceHideLoadingOverlay"
          />
        </div>
        <p v-if="showRetryButton || !stage" class="help-text">
          Loading is taking longer than expected
        </p>

        <!-- Debug info for developers -->
        <div class="debug-info">
          <p>Current state: {{ debugState }}</p>
          <p>Stage ready: {{ stage !== null }}</p>
          <p>Konva stage: {{ konvaStage !== null }}</p>
          <p>Container: {{ annotatorBox !== null }}</p>
          <p>Image loaded: {{ imageCanvas.image.value !== null }}</p>
          <p>isLoading: {{ isLoading }}</p>
          <p>imageCanvas loading: {{ imageCanvas.isLoading }}</p>
          <p>Rendering blocked: {{ stageRenderingBlocked }}</p>
          <p>Image error: {{ imageCanvas.loadError.value }}</p>
          <p>Time since start: {{ elapsedTime }}s</p>
          <p>Loading state: {{ loadingState }}</p>
        </div>
      </div>
      <div
        v-else-if="imageCanvas.loadError.value"
        class="loading-overlay error"
      >
        <q-icon name="error" color="negative" size="3em" />
        <p>Error loading image: {{ imageCanvas.loadError.value }}</p>
        <p v-if="!currentImageId">Please select an image.</p>
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

      <!-- Move debug info outside the loading overlay so it's always visible -->
      <div
        v-if="
          loadingState === LoadingState.READY ||
          loadingState === LoadingState.IDLE
        "
        class="debug-info floating"
      >
        <p>Current state: {{ debugState }}</p>
        <p>Loading state: {{ loadingState }}</p>
        <p>Stage ready: {{ stage !== null }}</p>
        <p>Konva stage: {{ konvaStage !== null }}</p>
        <p>Container: {{ annotatorBox !== null }}</p>
        <p>Time: {{ elapsedTime }}s</p>
        <div class="debug-buttons">
          <q-btn color="primary" label="Force Retry" @click="retryLoading" />
          <q-btn
            color="warning"
            label="Hide Loading"
            @click="forceHideLoadingOverlay"
          />
        </div>
      </div>

      <!-- Add a direct button to immediately hide the loading overlay in the main interface -->
      <button
        v-if="
          loadingState !== LoadingState.READY &&
          loadingState !== LoadingState.IDLE
        "
        class="emergency-hide-button"
        @click="forceHideLoadingOverlay"
      >
        × FORCE HIDE LOADING
      </button>
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

  &.error p {
    color: var(--q-negative);
    margin-top: 1em;
  }
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

/* Add styles for debug info */
.debug-info {
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.75rem;
  text-align: left;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.debug-info p {
  margin: 2px 0;
}

/* Add style for floating debug info */
.debug-info.floating {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.8);
  z-index: 100;
  padding: 8px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

/* Add style for button container */
.overlay-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.debug-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Add styling for the emergency button */
.emergency-hide-button {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #f44336;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  z-index: 10000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}
</style>
