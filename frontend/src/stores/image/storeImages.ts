import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { DetectionState, ImageState, newImageState } from 'src/types';
import { useCollection } from 'src/stores/data/useCollection';
import { useStateManager } from 'src/stores/app/stateManager';
import { useCollectionDataAccess } from 'stores/data-access';
import { useNotificationStore } from 'src/stores/app/notificationService';
import { getImageById } from 'src/api/imageApiService';
import { ImageDAtoState } from 'src/types/mapper';

// Constants
const STORAGE_KEY = 'image-store';

export const useImageStore = defineStore('images', () => {
  // Dependencies

  const stateManager = useStateManager();
  const collectionDA = useCollectionDataAccess();
  const notificationStore = useNotificationStore();

  // State
  const image = ref<ImageState>(newImageState());
  const detections = ref<DetectionState[]>([]);
  const loading = ref(false);
  const error = ref('');
  const lastImageId = ref<string | null>(null);
  const lastCollectionId = ref<string | null>(null);

  const detectionsToDelete = ref<DetectionState[]>([]);
  const detectionsToAdd = ref<DetectionState[]>([]);

  // Selected detection state
  const selectedDetectionId = ref<string | null>(null);

  // Getters
  const isLoaded = computed(() => {
    return image.value.id !== '' && detections.value.length > 0;
  });

  const availableMetaRolesOptions = computed(() => {
    try {
      const collectionStore = useCollection();
      if (collectionStore.collectionMetaRoles.length > 0) {
        return collectionStore.collectionMetaRoles.map((role) => ({
          id: role.id,
          label: role.computed_display_name || role.id,
          value: role.computed_name || role.id,
          color: role.color || '#cccccc',
        }));
      }
    } catch (e) {
      console.error('Error getting meta roles from collection state:', e);
    }
    return []; // Default empty array return
  });

  // Get the currently selected detection
  const selectedDetection = computed(() => {
    if (!selectedDetectionId.value) return null;
    return (
      detections.value.find((d) => d.id === selectedDetectionId.value) || null
    );
  });

  // Get all detections with isSelected flag
  const detectionsGetter = computed(() => {
    return detections.value.map((detection) => ({
      ...detection,
      isSelected: detection.id === selectedDetectionId.value,
    }));
  });

  // Proper initialization
  const init = () => {
    console.log('Initializing image store');
    // Try to restore state from local storage
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        lastImageId.value = parsed.lastImageId || null;
        lastCollectionId.value = parsed.lastCollectionId || null;
        selectedDetectionId.value = parsed.selectedDetectionId || null;
        console.log(
          `Restored image store state: lastImageId=${lastImageId.value}, lastCollectionId=${lastCollectionId.value}`,
        );
      } catch (e) {
        console.error('Error restoring image store state:', e);
        clearPersistedState();
      }
    }
    return {
      lastImageId: lastImageId.value,
      lastCollectionId: lastCollectionId.value,
      selectedDetectionId: selectedDetectionId.value,
    };
  };

  // Persistence helper
  const persistState = () => {
    const stateToSave = {
      lastImageId: image.value.id,
      lastCollectionId: image.value.id.split('_')[0], // Assuming format collectionId_imageId
      selectedDetectionId: selectedDetectionId.value,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    console.log('Persisted image store state');
  };

  const clearPersistedState = () => {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Cleared persisted image store state');
  };

  // Reset state completely
  const resetState = () => {
    image.value = newImageState();
    detections.value = [];
    error.value = '';
    detectionsToDelete.value = [];
    detectionsToAdd.value = [];
    selectedDetectionId.value = null;
    console.log('Reset image store state');
  };

  // Methods for managing selected detection
  const selectDetection = (detectionId: string | null) => {
    if (detectionId === null) {
      selectedDetectionId.value = null;
      console.log('Detection deselected');
      persistState();
      return;
    }

    // Verify the detection exists in our list
    const detectionExists = detections.value.some((d) => d.id === detectionId);
    if (!detectionExists) {
      console.error(
        `Cannot select detection ${detectionId}: Not found in current detections`,
      );
      return;
    }

    selectedDetectionId.value = detectionId;
    console.log(`Selected detection: ${detectionId}`);
    persistState();
  };

  // Load image directly from API
  const loadImage = async (imageId: string, collectionId: string) => {
    loading.value = true;
    error.value = '';
    // Clear selected detection when loading a new image
    selectedDetectionId.value = null;

    try {
      console.log(`Loading image ${imageId} from collection ${collectionId}`);

      // Validate IDs
      if (
        !stateManager.validateIds({
          lastCollectionId: collectionId,
          lastImageId: imageId,
        })
      ) {
        error.value = 'Invalid image or collection ID';
        console.error('Invalid image or collection ID');
        return;
      }

      // Directly fetch the image from the API
      const imageResponse = await getImageById(imageId);

      if (imageResponse.error) {
        error.value = `Failed to load image: ${imageResponse.error}`;
        console.error(error.value);
        return;
      }

      if (imageResponse.data) {
        // Convert from ImageDA to ImageState using the mapper
        image.value = ImageDAtoState(imageResponse.data);

        // Update state manager
        stateManager.updateState(collectionId, imageId);

        // Persist the state now that we have loaded successfully
        persistState();

        console.log('Image loaded successfully');
      } else {
        error.value = 'Image not found';
        console.error('Image not found');
      }
    } catch (e) {
      error.value = 'Failed to load image';
      console.error(e);
      stateManager.handleError(e, 'Failed to load image');
    } finally {
      loading.value = false;
    }
  };

  // Load detections for the current image
  const loadDetections = async (imageId: string) => {
    // Ensure we have a valid image ID in the store that matches the requested ID
    if (!image.value.id || image.value.id !== imageId) {
      error.value = `Cannot load detections: Image ID mismatch or not loaded (requested: ${imageId}, current: ${image.value.id})`;
      console.error(error.value);
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      // Verify we have the right image (redundant check now, but safe to keep)
      if (imageId !== image.value.id) {
        error.value = 'Image ID mismatch';
        console.error(`Image ID mismatch: ${imageId} vs ${image.value.id}`);
        return;
      }

      // Check if the image has detections
      if (!image.value?.detections) {
        error.value = 'No detections found';
        console.error('No detections found in image');
        detections.value = [];
        return;
      }

      console.log(
        `Loading ${image.value.detections.length} detections from image`,
      );

      // Initialize detections with meta role properties
      detections.value = image.value.detections.filter(
        (detection) => detection.page_index_for === undefined,
      );

      console.log('Detections loaded successfully');
    } catch (e) {
      error.value = 'Failed to load detections';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  // CRUD operations for detections
  const saveImage = async () => {
    console.log('Saving image and all associated detections');
    loading.value = true;
    error.value = '';

    try {
      // Use the existing saveAllChanges method to perform the actual saving
      const result = await saveAllChanges();

      if (result.success) {
        notificationStore.success('Changes saved successfully');
        return { success: true };
      } else {
        notificationStore.error(`Failed to save changes: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : 'Unknown error occurred';
      error.value = `Failed to save image: ${errorMessage}`;
      notificationStore.error(error.value);
      console.error('Error saving image:', e);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  const createNewDetections = async () => {
    if (detectionsToAdd.value.length === 0) {
      console.log('No new detections to create');
      return { success: true };
    }

    loading.value = true;
    error.value = '';

    try {
      console.log(`Creating ${detectionsToAdd.value.length} new detections`);

      // Create all new detections in parallel
      await Promise.all(
        detectionsToAdd.value.map(async (detection) => {
          const result = await collectionDA.createNewDetection(detection);
          if (result.error) {
            console.error(`Failed to create detection: ${result.error}`);
          } else {
            console.log(`Created detection: ${result.data?.id}`);
          }
        }),
      );

      // Clear the list of detections to add
      detectionsToAdd.value = [];

      return { success: true };
    } catch (e) {
      error.value = 'Failed to create new detections';
      console.error(e);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  const updateAllDetections = async () => {
    if (detections.value.length === 0) {
      console.log('No detections to update');
      return { success: true };
    }

    loading.value = true;
    error.value = '';

    try {
      console.log(`Updating ${detections.value.length} detections`);

      // Update all detections in parallel
      await Promise.all(
        detections.value.map(async (detection) => {
          const result = await collectionDA.updateExistingDetection(detection);
          if (result.error) {
            console.error(
              `Failed to update detection ${detection.id}: ${result.error}`,
            );
          } else {
            console.log(`Updated detection: ${detection.id}`);
          }
        }),
      );

      return { success: true };
    } catch (e) {
      error.value = 'Failed to update detections';
      console.error(e);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  const deleteDetections = async () => {
    if (detectionsToDelete.value.length === 0) {
      console.log('No detections to delete');
      return { success: true };
    }

    loading.value = true;
    error.value = '';

    try {
      console.log(`Deleting ${detectionsToDelete.value.length} detections`);

      // Delete all marked detections in parallel
      await Promise.all(
        detectionsToDelete.value.map(async (detection) => {
          const result = await collectionDA.deleteDetection(detection.id);
          if (result.error) {
            console.error(
              `Failed to delete detection ${detection.id}: ${result.error}`,
            );
          } else {
            console.log(`Deleted detection: ${detection.id}`);
          }
        }),
      );

      // Clear the list of detections to delete
      detectionsToDelete.value = [];

      return { success: true };
    } catch (e) {
      error.value = 'Failed to delete detections';
      console.error(e);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  const deleteDetection = async (
    detection: DetectionState,
  ): Promise<string> => {
    loading.value = true;
    error.value = '';

    try {
      console.log(`Deleting detection ${detection.id}`);

      const result = await collectionDA.deleteDetection(detection.id);

      if (result.error) {
        error.value = result.error;
        console.error(`Failed to delete detection: ${result.error}`);
        return error.value;
      }

      // Remove from our local array too
      const index = detections.value.findIndex((d) => d.id === detection.id);
      if (index !== -1) {
        detections.value.splice(index, 1);
      }

      // If this was the selected detection, deselect it
      if (selectedDetectionId.value === detection.id) {
        selectedDetectionId.value = null;
        persistState();
      }

      console.log(`Deleted detection: ${detection.id}`);
      return '';
    } catch (e) {
      error.value = 'Failed to delete detection';
      console.error(e);
      return error.value;
    } finally {
      loading.value = false;
    }
  };

  // New method to handle immediate local deletion
  const deleteDetectionLocally = (detectionId: string) => {
    const index = detections.value.findIndex((d) => d.id === detectionId);
    if (index !== -1) {
      const deletedDetection = detections.value[index];
      // Add to the deletion queue for backend
      if (!detectionsToDelete.value.some((d) => d.id === detectionId)) {
        detectionsToDelete.value.push(deletedDetection);
      }
      // Remove from the main detections list
      detections.value.splice(index, 1);
      console.log(
        `Locally deleted detection ${detectionId} and queued for backend deletion.`,
      );

      // Deselect if it was the selected one
      if (selectedDetectionId.value === detectionId) {
        selectDetection(null); // This already persists
      }
    } else {
      console.warn(
        `Could not find detection ${detectionId} to delete locally.`,
      );
    }
  };

  const reloadImage = async () => {
    if (!image.value?.id || !lastCollectionId.value) {
      console.error('Cannot reload image: no image or collection ID');
      return;
    }

    loading.value = true;
    error.value = '';

    // Store current image ID and state before reload
    const currentImageId = image.value.id;

    try {
      console.log(`Reloading image ${image.value.id}`);

      // Directly reload the image using the API
      await loadImage(currentImageId, lastCollectionId.value);

      // Then reload the detections for the image
      await loadDetections(currentImageId);

      console.log('Image reloaded successfully');
    } catch (e) {
      error.value = 'Failed to reload image';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  // Combine all operations in a single save method
  const saveAllChanges = async () => {
    loading.value = true;
    error.value = '';

    try {
      // Execute all operations in sequence
      const createResult = await createNewDetections();
      if (!createResult.success) {
        return createResult;
      }

      const updateResult = await updateAllDetections();
      if (!updateResult.success) {
        return updateResult;
      }

      const deleteResult = await deleteDetections();
      if (!deleteResult.success) {
        return deleteResult;
      }

      // Reload image to refresh state after all changes
      await reloadImage();

      return { success: true };
    } catch (e) {
      error.value = 'Failed to save all changes';
      console.error(e);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  const ensureMetaRolesLoaded = async (collectionId: string) => {
    const collectionStore = useCollection();
    if (collectionStore.collectionMetaRoles.length === 0) {
      console.log('Meta roles not loaded, loading from collection state...');
      await collectionStore.loadCollection(collectionId);
    }
    return availableMetaRolesOptions.value.length > 0;
  };

  return {
    // State
    image,
    detections,
    loading,
    error,
    lastImageId,
    lastCollectionId,
    detectionsToAdd,
    detectionsToDelete,
    selectedDetectionId,

    // Computed
    isLoaded,
    availableMetaRolesOptions,
    selectedDetection,
    detectionsGetter,

    // Methods
    init,
    loadImage,
    loadDetections,
    saveImage,
    createNewDetections,
    updateAllDetections,
    deleteDetections,
    deleteDetection,
    reloadImage,
    saveAllChanges,
    resetState,
    persistState,
    clearPersistedState,
    ensureMetaRolesLoaded,
    selectDetection,
    deleteDetectionLocally,
  };
});
