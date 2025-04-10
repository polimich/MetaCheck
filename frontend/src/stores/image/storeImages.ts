import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { DetectionState, ImageState, newImageState } from 'src/types';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useStateManager } from 'src/stores/app/stateManager';
import { useCollectionDataAccess } from 'stores/data-access';

// Constants
const STORAGE_KEY = 'image-store';

export const useImageStore = defineStore('images', () => {
  // Dependencies
  const currentCollectionState = useCurrentCollectionState();
  const stateManager = useStateManager();
  const collectionDA = useCollectionDataAccess();

  // State
  const image = ref<ImageState>(newImageState());
  const detections = ref<DetectionState[]>([]);
  const detectionIdsBackup = ref<string[]>([]);
  const loading = ref(false);
  const error = ref('');
  const lastImageId = ref<string | null>(null);
  const lastCollectionId = ref<string | null>(null);

  const detectionsToDelete = ref<DetectionState[]>([]);
  const detectionsToAdd = ref<DetectionState[]>([]);

  // Getters
  const isLoaded = computed(() => {
    return image.value.id !== '' && detections.value.length > 0;
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

        console.log(
          `Restored image store state: lastImageId=${lastImageId.value}, lastCollectionId=${lastCollectionId.value}`,
        );

        // We don't restore the full state to avoid stale data
        // Just the references to know what we were working on
      } catch (e) {
        console.error('Error restoring image store state:', e);
        clearPersistedState();
      }
    }
    return {
      lastImageId: lastImageId.value,
      lastCollectionId: lastCollectionId.value,
    };
  };

  // Persistence helper
  const persistState = () => {
    const stateToSave = {
      lastImageId: image.value.id,
      lastCollectionId: image.value.id.split('_')[0], // Assuming format collectionId_imageId
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
    detectionIdsBackup.value = [];
    error.value = '';
    detectionsToDelete.value = [];
    detectionsToAdd.value = [];
    console.log('Reset image store state');
  };

  // Load image from collection state
  const loadImage = async (imageId: string, collectionId: string) => {
    loading.value = true;
    error.value = '';

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

      // First ensure the collection is loaded
      if (!currentCollectionState.loaded && !currentCollectionState.loading) {
        console.log('Collection not loaded, loading it first');
        await currentCollectionState.loadCollection(collectionId);
      } else if (currentCollectionState.loading) {
        console.log(
          'Collection is currently loading, waiting for it to complete',
        );
        // Wait for loading to complete but don't trigger another load
      }

      // Get the image from collection state
      const currentImage = currentCollectionState.getImageById(imageId);

      if (currentImage) {
        // Set the image in our local state
        image.value = currentImage;

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
      detections.value = image.value.detections.map((detection) => ({
        ...detection,
        availableMetaRoles: [],
        loadingMetaRoles: true,
      }));

      // Backup the IDs for later comparison
      detectionIdsBackup.value = detections.value.map((d) => d.id);

      // Load meta roles for all detections in parallel
      await Promise.all(
        detections.value.map(async (detection) => {
          const result = await collectionDA.getMetaRolesForDetection(
            detection.id,
          );

          if (result.error) {
            console.error(
              `Error loading meta roles for detection ${detection.id}:`,
              result.error,
            );
            return;
          }

          // Find and update the detection in our array
          const index = detections.value.findIndex(
            (d) => d.id === detection.id,
          );
          if (index !== -1) {
            detections.value[index].loadingMetaRoles = false;
          }
        }),
      );

      console.log('All detection meta roles loaded');
    } catch (e) {
      error.value = 'Failed to load detections';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  // CRUD operations for detections
  const saveImage = async () => {
    // This is a placeholder for any future functionality needed to save the image itself
    // Currently, we only save detections, not the image
    console.log('Save image operation placeholder');
    return { success: true };
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

  const reloadImage = async () => {
    if (!image.value?.id || !lastCollectionId.value) {
      console.error('Cannot reload image: no image or collection ID');
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      console.log(`Reloading image ${image.value.id}`);

      // First reload the collection to get fresh data
      await currentCollectionState.reloadCollection();

      // Then reload the image from the updated collection
      await loadImage(image.value.id, lastCollectionId.value);

      // Finally reload the detections for the image
      await loadDetections(image.value.id);

      console.log('Image reloaded successfully');
    } catch (e) {
      error.value = 'Failed to reload image';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  // Add a method to update a detection's meta roles
  const updateDetectionMetaRoles = async (detectionId: string) => {
    loading.value = true;
    error.value = '';

    try {
      console.log(`Updating meta roles for detection ${detectionId}`);

      const result = await collectionDA.getMetaRolesForDetection(detectionId);

      if (result.error) {
        error.value = result.error;
        console.error(`Failed to load meta roles: ${result.error}`);
        return;
      }

      // Find and update the detection in our array
      const index = detections.value.findIndex((d) => d.id === detectionId);
      if (index !== -1) {
        detections.value[index].loadingMetaRoles = false;
        console.log(`Updated meta roles for detection ${detectionId}`);
      } else {
        console.error(`Detection ${detectionId} not found in local state`);
      }
    } catch (e) {
      error.value = 'Failed to update detection meta roles';
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

    // Computed
    isLoaded,

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
    updateDetectionMetaRoles,
    saveAllChanges,
    resetState,
    persistState,
    clearPersistedState,
  };
});
