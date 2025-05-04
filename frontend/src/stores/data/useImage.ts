import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useCollection } from './useCollection';
import { DetectionType, ImageType, DetectionNewType } from './types';
import {
  getImage,
  createDetection,
  updateDetection as apiUpdateDetection,
  deleteDetection as apiDeleteDetection,
  updateImage as apiUpdateImage,
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

export const useImage = defineStore('image', () => {
  // Dependencies
  const collectionStore = useCollection();

  // State
  const image = ref<ImageType | null>(null);
  const detections = ref<DetectionWithUI[]>([]);
  const selectedDetectionId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentImageId = ref<string | null>(null);
  const currentCollectionId = ref<string | null>(null);

  // Image statistics
  const annotatedDetectionCount = computed(
    () => detections.value.filter((d) => d.annotated).length,
  );

  const totalDetectionCount = computed(() => detections.value.length);

  const verificationStatus = computed(() => {
    if (totalDetectionCount.value === 0) return 'unverified';
    if (annotatedDetectionCount.value === totalDetectionCount.value)
      return 'verified';
    if (annotatedDetectionCount.value > 0) return 'partial';
    return 'unverified';
  });

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
    currentCollectionId.value = null;
  };

  // Meta roles options getter for UI components
  const metaRolesOptions = computed(() => {
    return collectionStore.collectionMetaRoles.map((role) => ({
      label: role.computed_display_name || role.id,
      value: role.computed_name || role.id,
      color: role.color || '#cccccc',
      id: role.id,
    }));
  });

  // Check if image has low confidence detections
  const hasLowConfidenceDetections = computed(() => {
    if (!image.value) return false;

    // Define low confidence threshold
    const LOW_CONFIDENCE_THRESHOLD = 0.7;

    return !!detections.value.find(
      (d) =>
        d.confidence !== undefined && d.confidence < LOW_CONFIDENCE_THRESHOLD,
    );
  });

  // Check if image has medium confidence detections
  const hasMediumConfidenceDetections = computed(() => {
    if (!image.value) return false;

    // Define confidence thresholds
    const LOW_CONFIDENCE_THRESHOLD = 0.7;
    const MEDIUM_CONFIDENCE_THRESHOLD = 0.9;

    // If any detection has low confidence, we don't consider the image to have "medium" confidence
    if (hasLowConfidenceDetections.value) return false;

    return !!detections.value.find(
      (d) =>
        d.confidence !== undefined &&
        d.confidence >= LOW_CONFIDENCE_THRESHOLD &&
        d.confidence < MEDIUM_CONFIDENCE_THRESHOLD,
    );
  });

  // Determine if image needs attention
  const needsAttention = computed(() => {
    return (
      hasLowConfidenceDetections.value ||
      verificationStatus.value !== 'verified'
    );
  });

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
  const loadImage = async (imageId: string, collectionId?: string) => {
    if (!imageId) {
      console.error('[useImage] No image ID provided');
      return { success: false, error: 'No image ID provided' };
    }

    isLoading.value = true;
    error.value = null;

    try {
      // Store the collection ID
      if (collectionId) {
        currentCollectionId.value = collectionId;

        // Ensure collection is loaded to get meta roles and image data
        console.log(
          '[useImage] Ensuring collection data is ready before loading image',
        );
        const isReady =
          await collectionStore.waitForCollectionReady(collectionId);

        if (!isReady) {
          error.value = 'Failed to fully load collection data';
          isLoading.value = false;
          return {
            success: false,
            error: 'Failed to fully load collection data',
          };
        }
      } else if (currentCollectionId.value) {
        // Use stored collection ID if not provided
        collectionId = currentCollectionId.value;
        console.log(`[useImage] Using stored collection ID: ${collectionId}`);

        // Ensure the stored collection is ready
        await collectionStore.waitForCollectionReady(collectionId);
      } else {
        // Try to extract collection ID from image ID (often formatted as "collectionId_imageId")
        const possibleCollectionId = imageId.split('_')[0];
        if (possibleCollectionId) {
          console.log(
            `[useImage] Extracted possible collection ID: ${possibleCollectionId} from image ID`,
          );
          collectionId = possibleCollectionId;
          currentCollectionId.value = possibleCollectionId;

          // Ensure the extracted collection is ready
          const isReady =
            await collectionStore.waitForCollectionReady(possibleCollectionId);
          if (!isReady) {
            console.warn(
              '[useImage] Collection not fully ready, but proceeding with image load',
            );
          }
        } else {
          error.value = 'No collection ID provided or stored';
          isLoading.value = false;
          return {
            success: false,
            error: 'No collection ID provided or stored',
          };
        }
      }

      // Check if the collection store is ready to use
      if (
        !collectionStore.allImagesFlattened ||
        collectionStore.allImagesFlattened.length === 0
      ) {
        console.log(
          '[useImage] Waiting for collection images to be available...',
        );
        // Wait a short time for the collection data to be processed
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // First check if the image exists in the collection store
      const imageInCollection = collectionStore.allImagesFlattened.find(
        (img) => img.id === imageId,
      );

      if (!imageInCollection) {
        console.warn(
          `[useImage] Image ${imageId} not found in collection store's flattened images`,
        );
        // The image might not be in allImagesFlattened yet, proceed anyway
        console.log(
          '[useImage] Proceeding with image load without collection verification',
        );
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

      // Set the selected image in the collection store as well
      if (collectionId && collectionStore.selectImage) {
        collectionStore.selectImage(imageId);
      }

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
    // Ensure bbox exists, generate it if missing
    let bbox = detection.bbox;
    if (!bbox) {
      console.log(
        `[useImage] Generating missing bbox for detection ${detection.id}`,
      );
      bbox = objectToBbox(
        detection.x,
        detection.y,
        detection.width,
        detection.height,
      );
    }

    return {
      id: detection.id,
      image_id: detection.image_id,
      bbox: bbox,
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

  // Save just the image reference to the database
  const saveImage = async () => {
    if (!image.value || !image.value.id) {
      console.error('[useImage] No image data to save');
      return { success: false, error: 'No image data to save' };
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiUpdateImage(image.value);

      if (response.error) {
        console.error(`[useImage] Error saving image: ${response.error}`);
        error.value = `Error saving image: ${response.error}`;
        isLoading.value = false;
        return { success: false, error: response.error };
      }

      // Update local image with data from API if needed
      if (response.data) {
        image.value = response.data;
      }

      console.log('[useImage] Image saved successfully');

      isLoading.value = false;
      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error saving image';
      console.error(`[useImage] Error saving image: ${errorMessage}`);
      error.value = errorMessage;
      isLoading.value = false;
      return { success: false, error: errorMessage };
    }
  };

  // Update a detection with meta role information
  const updateDetectionWithMetaRole = async (
    detectionId: string,
    metaRoleId: string,
    value: string,
  ) => {
    try {
      isLoading.value = true;
      error.value = null;

      // Find the detection in our local state
      const detection = detections.value.find((d) => d.id === detectionId);
      if (!detection) {
        console.error(
          `[useImage] Cannot find detection ${detectionId} to update meta role`,
        );
        error.value = 'Detection not found';
        isLoading.value = false;
        return { success: false, error: 'Detection not found' };
      }

      // Mark the detection as loading
      detection.loadingMetaRoles = true;

      // Call the collection store's implementation which interfaces with the API
      const result = await collectionStore.updateDetectionWithMetaRole(
        detectionId,
        metaRoleId,
        value,
      );

      if (!result.success) {
        console.error(
          `[useImage] Error updating detection with meta role: ${result.error}`,
        );
        error.value = result.error;
        detection.loadingMetaRoles = false;
        isLoading.value = false;
        return result;
      }

      // If successful, update our local detection object
      // Mark the detection as annotated, update the type and value
      detection.annotated = true;
      detection.computed_type = metaRoleId;
      detection.value = value;
      detection.confidence = 1.0; // Set to full confidence as it's manually verified
      detection.edited = true;
      detection.last_change = new Date().toISOString();

      // Find appropriate meta role to get display name and color
      const metaRole = collectionStore.collectionMetaRoles.find(
        (role) => role.id === metaRoleId,
      );
      if (metaRole) {
        detection.computed_display_type =
          metaRole.computed_display_name || metaRoleId;
        detection.computed_color = metaRole.color || '#cccccc';
      }

      // Update API with our local changes
      const apiDetection = prepareDetectionForAPI(detection);
      const updatePayload = {
        ...apiDetection,
        annotated: detection.annotated,
        created_date: detection.created_date,
        last_change: detection.last_change,
        last_access: detection.last_access,
        deleted: detection.deleted,
        computed_color: detection.computed_color,
        computed_type: detection.computed_type,
        computed_display_type: detection.computed_display_type,
      };

      // Use the apiUpdateDetection function with our payload to update detection
      await apiUpdateDetection(updatePayload);

      // Update local store's stats
      detection.loadingMetaRoles = false;
      detection.edited = false;

      console.log(
        `[useImage] Successfully updated detection ${detectionId} with meta role ${metaRoleId}`,
      );
      isLoading.value = false;

      // Return success
      return { success: true, error: '' };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error updating detection';
      console.error(
        `[useImage] Error in updateDetectionWithMetaRole: ${errorMessage}`,
      );
      error.value = errorMessage;
      isLoading.value = false;

      // Reset loading state for the detection if it exists
      const detection = detections.value.find((d) => d.id === detectionId);
      if (detection) {
        detection.loadingMetaRoles = false;
      }

      return { success: false, error: errorMessage };
    }
  };

  return {
    // State
    image,
    detections,
    selectedDetectionId,
    isLoading,
    error,
    currentImageId,
    currentCollectionId,
    detectionsToAdd,
    detectionsToDelete,

    // Computed
    selectedDetection,
    hasChanges,
    detectionsForUI,
    metaRolesOptions,
    verificationStatus,
    annotatedDetectionCount,
    totalDetectionCount,
    hasLowConfidenceDetections,
    hasMediumConfidenceDetections,
    needsAttention,

    // Methods
    resetState,
    loadImage,
    selectDetection,
    addDetection,
    updateDetection,
    deleteDetection,
    saveAllChanges,
    updateCollectionStore,
    saveImage,
    updateDetectionWithMetaRole,
  };
});
