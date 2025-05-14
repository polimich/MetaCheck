import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { HierarchicalImage, useCollection } from './useCollection';
import { DetectionType, DetectionNewType, ImageType } from './types';
import {
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
  const image = computed(() => {
    console.log('[useImage] image', collectionStore.selectedImage);
    return collectionStore.selectedImage?.image;
  });
  const imageLocation = computed(() => {
    console.log('[useImage] imageLocation', collectionStore.selectedImage);
    return collectionStore.selectedImage?.location;
  });

  // Transform the detections into UI-friendly format
  const detections = computed<DetectionWithUI[]>(() => {
    if (!image.value?.detections) {
      console.log('[useImage] No detections found in selectedImage');
      return [];
    }
    console.log(
      '[useImage] Converting detections',
      image.value.detections.length,
    );
    return convertDetectionsForUI(image.value.detections);
  });

  const selectedDetectionId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentImageId = ref<string | null>(null);
  const currentCollectionId = ref<string | null>(null);

  // Image statistics
  const annotatedDetectionCount = computed(
    () => detections.value.filter((d) => d.annotated).length || 0,
  );

  const totalDetectionCount = computed(() => detections.value.length || 0);

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
      detections.value.some((d) => d.edited) ||
      false
    );
  });

  // Methods
  const resetState = () => {
    // We don't need to reset detections as it's a computed property
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

    return detections.value.some(
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

    return detections.value.some(
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
    apiDetections: DetectionType[],
  ): DetectionWithUI[] => {
    console.log(
      '[useImage] Converting detections, count:',
      apiDetections.length,
    );
    return apiDetections.map((detection) => {
      // Make sure detection has a valid bbox
      if (!detection.bbox) {
        console.warn('[useImage] Detection missing bbox:', detection.id);
        // Default to empty values if bbox is missing
        return {
          ...detection,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          edited: false,
          loadingMetaRoles: false,
        };
      }

      try {
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
      } catch (error) {
        console.error(
          '[useImage] Error converting bbox for detection:',
          detection.id,
          error,
        );
        // Return default values on error
        return {
          ...detection,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          edited: false,
          loadingMetaRoles: false,
        };
      }
    });
  };

  // Select a detection
  const selectDetection = (detectionId: string | null) => {
    console.log(`[useImage] Selecting detection: ${detectionId}`);

    if (!detectionId) {
      console.log('[useImage] Clearing selected detection');
      selectedDetectionId.value = null;
      return;
    }

    // Check if the detection exists in our current list
    const detectionExists = detections.value.some((d) => d.id === detectionId);

    if (!detectionExists) {
      console.warn(
        `[useImage] Detection ${detectionId} not found in current image detections`,
      );
      // We'll still set it, in case the detection data hasn't loaded yet
    }

    selectedDetectionId.value = detectionId;
    console.log(`[useImage] Selected detection ${detectionId}`);

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

    // We can't directly push to the detections computed array
    // Instead, add it to detectionsToAdd, which we'll apply on save
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

      // We can't directly update the detections computed array
      // The changes will be tracked and saved on saveAllChanges

      console.log(`[useImage] Updated detection: ${detection.id}`);
    } else {
      console.error(
        `[useImage] Cannot update detection: ID ${detection.id} not found`,
      );
    }
  };

  // Delete a detection
  const deleteDetection = async (detectionId: string) => {
    // call api
    const response = await apiDeleteDetection(detectionId);
    if (response.error) {
      console.error(`[useImage] Error deleting detection: ${response.error}`);
    }

    // update state in  useCollection
    collectionStore.deleteDetectionFromImage(
      image.value?.id || '',
      detectionId,
      imageLocation.value,
    );
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

  // Load image by ID
  const loadImage = async (imageId: string, collectionId?: string) => {
    console.log('[useImage] loadImage', imageId, collectionId);

    // We need to handle both collectionId and imageId for backwards compatibility
    if (collectionId) {
      // Make sure the collection is loaded first if we have a collectionId
      const collectionReady =
        await collectionStore.waitForCollectionReady(collectionId);
      if (!collectionReady) {
        console.error(
          `[useImage] Collection ${collectionId} failed to load properly`,
        );
        return {
          success: false,
          error: `Collection ${collectionId} failed to load`,
        };
      }
    }

    // Select the image in the collection store
    collectionStore.selectImage(imageId);

    // Update local tracking variables for backward compatibility
    currentImageId.value = imageId;
    if (collectionId) {
      currentCollectionId.value = collectionId;
    }

    // Check if the image was actually selected successfully
    if (!image.value || image.value.id !== imageId) {
      console.error(`[useImage] Failed to select image ${imageId}`);
      return { success: false, error: `Failed to select image ${imageId}` };
    }

    // Return success
    return { success: true };
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
      // First make all API calls and collect results before updating local state

      // Process additions - make API calls for new detections
      const addResults = [];
      for (const detection of detectionsToAdd.value) {
        console.log(`[useImage] Creating detection ${detection.id} via API`);
        const apiDetection = prepareDetectionForAPI(detection);
        const response = await createDetection(apiDetection);

        if (response.error) {
          console.error(`[useImage] Error saving detection: ${response.error}`);
          error.value = `Error saving detection: ${response.error}`;
          isLoading.value = false;
          return { success: false, error: response.error };
        }

        addResults.push({
          detection,
          response,
        });
      }

      // Process deletions - make API calls for deleted detections
      const deleteResults = [];
      for (const detectionId of detectionsToDelete.value) {
        console.log(
          `[useImage] Deleting detection ${detectionId} via API at /detection/${detectionId}`,
        );

        try {
          // Call the API to delete the detection from the database
          const response = await apiDeleteDetection(detectionId);

          if (response.error) {
            console.error(
              `[useImage] Error deleting detection: ${response.error}`,
            );
            error.value = `Error deleting detection: ${response.error}`;
            isLoading.value = false;
            return { success: false, error: response.error };
          }

          deleteResults.push({
            detectionId,
            response,
          });
        } catch (deleteError) {
          console.error(
            `[useImage] Exception deleting detection: ${deleteError}`,
          );
          error.value = `Error deleting detection: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`;
          isLoading.value = false;
          return { success: false, error: error.value };
        }
      }

      // Process updates - make API calls for edited detections
      const updateResults = [];
      for (const detection of detections.value) {
        // Only process detections that have been edited
        if (!(detection as DetectionType & { edited?: boolean }).edited)
          continue;

        console.log(`[useImage] Updating detection ${detection.id} via API`);
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

        updateResults.push({
          detection,
          response,
        });
      }

      // All API calls were successful, clear the tracking arrays
      // but we won't update local state since ImageAnnotator will reload data
      detectionsToAdd.value = [];
      detectionsToDelete.value = [];

      // Reset edited flag for all detections
      for (const detection of detections.value) {
        (detection as DetectionType & { edited?: boolean }).edited = false;
      }

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
      // Create minimal data structure with only the properties needed by the API
      const imageData = {
        // Required base properties
        id: image.value.id,
        // Add minimal required fields with defaults - avoid 'any' type
        created_date:
          (image.value as { created_date?: string })?.created_date ||
          new Date().toISOString(),
        last_change:
          (image.value as { last_change?: string })?.last_change ||
          new Date().toISOString(),
        last_access:
          (image.value as { last_access?: string })?.last_access ||
          new Date().toISOString(),
        deleted: (image.value as { deleted?: boolean })?.deleted || false,
        // Copy other relevant properties
        name: image.value.name,
        detection_count: image.value.detection_count,
        annotated_detection_count: image.value.annotated_detection_count,
        confidence: image.value.confidence,
        width: image.value.width,
        height: image.value.height,
        page_index: image.value.page_index,
        page_type: image.value.page_type,
        order: image.value.order,
      };

      console.log('[useImage] Saving image with data:', imageData);

      // Use a more specific type instead of 'any'
      const response = await apiUpdateImage(imageData as ImageType);

      if (response.error) {
        console.error(`[useImage] Error saving image: ${response.error}`);
        error.value = `Error saving image: ${response.error}`;
        isLoading.value = false;
        return { success: false, error: response.error };
      }

      console.log('[useImage] Image saved successfully');

      // Update the image in the collection store
      collectionStore.modifyImageInStructure(
        response.data as HierarchicalImage,
      );

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

  // Diagnostic function for debugging
  const diagnosticInfo = () => {
    console.log('[useImage] Diagnostic information:');
    console.log('  currentImageId:', currentImageId.value);
    console.log('  currentCollectionId:', currentCollectionId.value);
    console.log('  image.value?.id:', image.value?.id);
    console.log('  image derived from collection:', !!image.value);
    console.log('  detections count:', detections.value?.length);
    console.log(
      '  collectionStore.selectedImage?.id:',
      collectionStore.selectedImage?.image.id,
    );
    console.log(
      '  collectionStore.selectedImageId:',
      collectionStore.selectedImageId,
    );

    return {
      imageId: image.value?.id,
      selectedImageId: collectionStore.selectedImageId,
      derived: !!image.value,
      detectionsCount: detections.value?.length || 0,
    };
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
    saveImage,
    updateDetectionWithMetaRole,
    diagnosticInfo,
  };
});
