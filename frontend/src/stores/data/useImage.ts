import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useCollection } from './useCollection';
import { DetectionType, ImageType, DetectionNewType } from './types';
import {
  getImage,
  createDetection,
  updateDetection as apiUpdateDetection,
  deleteDetection as apiDeleteDetection,
} from 'src/api/imageApiNew';

// Helper function to convert between bbox string and object format
// This is needed because the API works with "x,y,width,height" strings
// but our UI components work with separate properties
const bboxToObject = (bbox: string) => {
  const [x, y, width, height] = bbox.split(',').map((v) => parseFloat(v));
  return { x, y, width, height };
};

const objectToBbox = (
  x: number,
  y: number,
  width: number,
  height: number,
): string => {
  return `${x},${y},${width},${height}`;
};

// Add UI-specific properties to detection type
type DetectionWithUI = DetectionType & {
  // Unpacked bbox for convenience with UI components
  x: number;
  y: number;
  width: number;
  height: number;
  // UI-specific states
  edited: boolean;
  loadingMetaRoles: boolean;
};

export const useImageStore = defineStore('image', () => {
  // Dependencies
  const collectionStore = useCollection();

  // State
  const image = ref<ImageType | null>(null);
  const detections = ref<DetectionWithUI[]>([]);
  const selectedDetectionId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentImageId = ref<string | null>(null);

  // Tracking changes for backend synchronization
  const detectionsToAdd = ref<DetectionWithUI[]>([]);
  const detectionsToDelete = ref<string[]>([]);

  // Computed properties
  const selectedDetection = computed(() => {
    if (!selectedDetectionId.value) return null;
    return (
      detections.value.find((d) => d.id === selectedDetectionId.value) || null
    );
  });

  const hasChanges = computed(() => {
    return (
      detectionsToAdd.value.length > 0 ||
      detectionsToDelete.value.length > 0 ||
      detections.value.some((d) => d.edited)
    );
  });

  // Methods
  const resetState = () => {
    image.value = null;
    detections.value = [];
    selectedDetectionId.value = null;
    detectionsToAdd.value = [];
    detectionsToDelete.value = [];
    isLoading.value = false;
    error.value = null;
    currentImageId.value = null;
  };

  // Convert detections from API format to UI format
  const convertDetectionsForUI = (
    detections: DetectionType[],
  ): DetectionWithUI[] => {
    return detections.map((detection) => {
      const { x, y, width, height } = bboxToObject(detection.bbox);
      return {
        ...detection,
        x,
        y,
        width,
        height,
        edited: false,
        loadingMetaRoles: false,
      };
    });
  };

  // Load image data from API
  const loadImage = async (imageId: string) => {
    if (!imageId) {
      console.error('[useImage] No image ID provided');
      return { success: false, error: 'No image ID provided' };
    }

    isLoading.value = true;
    error.value = null;

    try {
      // First check if the image exists in the collection store
      const imageInCollection = collectionStore.getImageById(imageId);

      if (!imageInCollection) {
        console.error(`[useImage] Image ${imageId} not found in collection`);
        error.value = 'Image not found in collection';
        isLoading.value = false;
        return { success: false, error: 'Image not found in collection' };
      }

      // Get full image data from the API
      const response = await getImage(imageId);

      if (response.error) {
        console.error(`[useImage] API error loading image: ${response.error}`);
        error.value = response.error;
        isLoading.value = false;
        return { success: false, error: response.error };
      }

      if (!response.data) {
        console.error('[useImage] No image data received from API');
        error.value = 'No image data received';
        isLoading.value = false;
        return { success: false, error: 'No image data received' };
      }

      // Update the store with the image data
      image.value = response.data;
      currentImageId.value = imageId;

      // Convert detections to UI format
      detections.value = convertDetectionsForUI(response.data.detections);

      console.log(
        `[useImage] Loaded image ${imageId} with ${detections.value.length} detections`,
      );

      // Reset change tracking
      detectionsToAdd.value = [];
      detectionsToDelete.value = [];

      isLoading.value = false;
      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error loading image';
      console.error(`[useImage] Error loading image: ${errorMessage}`);
      error.value = errorMessage;
      isLoading.value = false;
      return { success: false, error: errorMessage };
    }
  };

  // Select a detection
  const selectDetection = (detectionId: string | null) => {
    selectedDetectionId.value = detectionId;
    // Could emit an event or call a function to scroll to the detection in the ImageAnnotator
  };

  // Add a new detection
  const addDetection = (
    detection: Omit<
      DetectionWithUI,
      'id' | 'created_date' | 'last_change' | 'last_access' | 'deleted'
    >,
  ) => {
    // Generate a temporary ID - the backend will generate the final ID
    const tempId = `temp-${Date.now()}`;

    // Create new detection object with required fields
    const newDetection: DetectionWithUI = {
      id: tempId,
      image_id: image.value?.id || '',
      // Create bbox string from coordinate properties
      bbox: objectToBbox(
        detection.x,
        detection.y,
        detection.width,
        detection.height,
      ),
      value: detection.value || '',
      confidence: detection.confidence,
      annotated: detection.annotated || false,
      computed_color: detection.computed_color || '#ff0000',
      computed_type: detection.computed_type || '',
      computed_display_type: detection.computed_display_type || '',
      created_date: new Date().toISOString(),
      last_change: new Date().toISOString(),
      last_access: new Date().toISOString(),
      deleted: false,
      // Include UI-specific fields
      x: detection.x,
      y: detection.y,
      width: detection.width,
      height: detection.height,
      edited: true,
      loadingMetaRoles: false,
    };

    // Add to local state
    detections.value.push(newDetection);

    // Add to changes to sync with backend
    detectionsToAdd.value.push(newDetection);

    console.log(`[useImage] Added new detection: ${newDetection.id}`);
    return newDetection;
  };

  // Update an existing detection
  const updateDetection = (detection: DetectionWithUI) => {
    const index = detections.value.findIndex((d) => d.id === detection.id);

    if (index !== -1) {
      // Update bbox string from coordinate properties
      detection.bbox = objectToBbox(
        detection.x,
        detection.y,
        detection.width,
        detection.height,
      );

      // Mark as edited
      detection.edited = true;
      detection.last_change = new Date().toISOString();

      // Update in local state
      detections.value[index] = detection;

      console.log(`[useImage] Updated detection: ${detection.id}`);
    } else {
      console.error(
        `[useImage] Cannot update detection: ID ${detection.id} not found`,
      );
    }
  };

  // Delete a detection
  const deleteDetection = (detectionId: string) => {
    const index = detections.value.findIndex((d) => d.id === detectionId);

    if (index !== -1) {
      // Remove from local state
      detections.value.splice(index, 1);

      // If this was previously added but not saved, remove from additions
      const addIndex = detectionsToAdd.value.findIndex(
        (d) => d.id === detectionId,
      );
      if (addIndex !== -1) {
        detectionsToAdd.value.splice(addIndex, 1);
      } else {
        // Otherwise, add to deletions
        detectionsToDelete.value.push(detectionId);
      }

      // If the deleted detection was selected, clear selection
      if (selectedDetectionId.value === detectionId) {
        selectedDetectionId.value = null;
      }

      console.log(`[useImage] Deleted detection: ${detectionId}`);
    } else {
      console.error(
        `[useImage] Cannot delete detection: ID ${detectionId} not found`,
      );
    }
  };

  // Prepare detection for API - convert from UI format to API format
  const prepareDetectionForAPI = (
    detection: DetectionWithUI,
  ): DetectionNewType => {
    return {
      id: detection.id,
      image_id: detection.image_id,
      bbox: objectToBbox(
        detection.x,
        detection.y,
        detection.width,
        detection.height,
      ),
      value: detection.value,
      confidence: detection.confidence,
    };
  };

  // Save all changes to backend
  const saveAllChanges = async () => {
    if (!hasChanges.value) {
      console.log('[useImage] No changes to save');
      return { success: true };
    }

    isLoading.value = true;
    error.value = null;

    try {
      // Handle additions
      for (const detection of detectionsToAdd.value) {
        const apiDetection = prepareDetectionForAPI(detection);
        const response = await createDetection(apiDetection);

        if (response.error) {
          console.error(`[useImage] Error saving detection: ${response.error}`);
          error.value = `Error saving detection: ${response.error}`;
          isLoading.value = false;
          return { success: false, error: response.error };
        }

        // Update local detection with data from API (like the real ID)
        if (response.data) {
          const index = detections.value.findIndex(
            (d) => d.id === detection.id,
          );
          if (index !== -1) {
            // Update with new API data while preserving UI props
            const { x, y, width, height } = bboxToObject(response.data.bbox);
            detections.value[index] = {
              ...response.data,
              x,
              y,
              width,
              height,
              edited: false,
              loadingMetaRoles: false,
            };
          }
        }
      }

      // Handle deletions
      for (const detectionId of detectionsToDelete.value) {
        const response = await apiDeleteDetection(detectionId);

        if (response.error) {
          console.error(
            `[useImage] Error deleting detection: ${response.error}`,
          );
          error.value = `Error deleting detection: ${response.error}`;
          isLoading.value = false;
          return { success: false, error: response.error };
        }
      }

      // Handle updates to existing detections
      const detectionsToUpdate = detections.value.filter(
        (d) => d.edited && !detectionsToAdd.value.some((a) => a.id === d.id),
      );

      for (const detection of detectionsToUpdate) {
        const apiDetection = prepareDetectionForAPI(detection);

        // Create a proper update payload with the required fields
        const updatePayload = {
          ...apiDetection,
          annotated: detection.annotated,
          // Include these required fields for the API
          created_date: detection.created_date,
          last_change: detection.last_change,
          last_access: detection.last_access,
          deleted: detection.deleted,
          computed_color: detection.computed_color,
          computed_type: detection.computed_type,
          computed_display_type: detection.computed_display_type,
        };

        const response = await apiUpdateDetection(updatePayload);

        if (response.error) {
          console.error(
            `[useImage] Error updating detection: ${response.error}`,
          );
          error.value = `Error updating detection: ${response.error}`;
          isLoading.value = false;
          return { success: false, error: response.error };
        }

        // Update local detection with data from API if needed
        if (response.data) {
          const index = detections.value.findIndex(
            (d) => d.id === detection.id,
          );
          if (index !== -1) {
            // Preserve UI props while updating API data
            const { x, y, width, height } = bboxToObject(response.data.bbox);
            detections.value[index] = {
              ...response.data,
              x,
              y,
              width,
              height,
              edited: false,
              loadingMetaRoles: false,
            };
          }
        }
      }

      // Clear change tracking after successful save
      detectionsToAdd.value = [];
      detectionsToDelete.value = [];

      // Mark all detections as not edited
      detections.value.forEach((d) => {
        d.edited = false;
      });

      // Update the collection store to reflect changes
      updateCollectionStore();

      console.log('[useImage] All changes saved successfully');

      isLoading.value = false;
      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error saving changes';
      console.error(`[useImage] Error saving changes: ${errorMessage}`);
      error.value = errorMessage;
      isLoading.value = false;
      return { success: false, error: errorMessage };
    }
  };

  // Update collection store after changes
  const updateCollectionStore = () => {
    // This method would update the collection store with the latest detection data
    // Implementation depends on how the collection store organizes its data
    console.log(
      '[useImage] Updating collection store with latest detection data',
    );

    // Example implementation (modify based on actual collection store structure)
    if (collectionStore && image.value?.id) {
      // Logic to update detection counts or other metadata in the collection
      console.log('[useImage] Collection store updated');
    }
  };

  // Expose a getter to map detections to a simpler format for components that don't need all the properties
  const detectionsForUI = computed(() => {
    return detections.value.map((d) => ({
      id: d.id,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      value: d.value,
      annotated: d.annotated,
      computed_type: d.computed_type,
      computed_color: d.computed_color,
      computed_display_type: d.computed_display_type,
    }));
  });

  return {
    // State
    image,
    detections,
    selectedDetectionId,
    isLoading,
    error,
    currentImageId,
    detectionsToAdd,
    detectionsToDelete,

    // Computed
    selectedDetection,
    hasChanges,
    detectionsForUI,

    // Methods
    resetState,
    loadImage,
    selectDetection,
    addDetection,
    updateDetection,
    deleteDetection,
    saveAllChanges,
    updateCollectionStore,
  };
});
