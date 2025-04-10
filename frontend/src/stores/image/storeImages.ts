import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { DetectionState, ImageState, newImageState } from 'src/types';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useStateManager } from 'src/stores/app/stateManager';
import {
  createDetection,
  updateDetection,
  deleteDetection as apiDeleteDetection,
  loadMetaRolesForDetection,
} from 'src/api/services';

// Constants
const STORAGE_KEY = 'image-store';

export const useImageStore = defineStore('images', () => {
  // Dependencies
  const currentCollectionState = useCurrentCollectionState();
  const stateManager = useStateManager();

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
    loading.value = true;
    error.value = '';

    try {
      // Verify we have the right image
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
          return loadMetaRolesForDetection(detection.id)
            .then(({ data, error: metaRoleError }) => {
              if (metaRoleError) {
                console.error(
                  `Error loading meta roles for detection ${detection.id}:`,
                  metaRoleError,
                );
                return;
              }

              // Find and update the detection in our array
              const index = detections.value.findIndex(
                (d) => d.id === detection.id,
              );
              if (index !== -1) {
                detections.value[index].availableMetaRoles = data;
                detections.value[index].loadingMetaRoles = false;
              }
            })
            .catch((e) => {
              console.error(
                `Exception loading meta roles for detection ${detection.id}:`,
                e,
              );
            });
        }),
      );

      console.log('Finished loading detections and meta roles');
    } catch (e) {
      error.value = 'Failed to load detections';
      console.error(e);
      detections.value = [];
      stateManager.handleError(e, 'Failed to load detections');
    } finally {
      loading.value = false;
    }
  };

  // CRUD operations for detections
  const saveImage = async () => {
    loading.value = true;
    error.value = '';
    try {
      await createNewDetections();
      await updateAllDetections();
      await deleteDetections();
      await reloadImage();
    } catch (e) {
      error.value = 'Failed to save image';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  const createNewDetections = async () => {
    error.value = '';
    detectionsToAdd.value = detections.value.filter(
      (detection) => detectionIdsBackup.value.indexOf(detection.id) === -1,
    );

    if (detectionsToAdd.value.length === 0) {
      console.log('No new detections to create');
      return;
    }

    console.log(`Creating ${detectionsToAdd.value.length} new detections`);

    const errors: string[] = [];
    for (const detection of detectionsToAdd.value) {
      console.log('Creating detection', detection);
      const err = await createDetection(detection);
      if (err) {
        errors.push(`Failed to create detection: ${err}`);
      }
    }

    if (errors.length > 0) {
      error.value = errors.join('; ');
      console.error('Errors creating detections:', error.value);
    } else {
      console.log('All new detections created successfully');
    }
  };

  const updateAllDetections = async () => {
    error.value = '';
    const detectionsToUpdate = detections.value.filter(
      (detection) =>
        detection.edited && detectionIdsBackup.value.includes(detection.id),
    );

    if (detectionsToUpdate.length === 0) {
      console.log('No detections to update');
      return;
    }

    console.log(`Updating ${detectionsToUpdate.length} detections`);

    const errors: string[] = [];
    for (const detection of detectionsToUpdate) {
      const err = await updateDetection(detection);
      if (err) {
        errors.push(`Failed to update detection: ${err}`);
      }
    }

    if (errors.length > 0) {
      error.value = errors.join('; ');
      console.error('Errors updating detections:', error.value);
    } else {
      console.log('All detections updated successfully');
    }
  };

  const deleteDetections = async () => {
    error.value = '';

    if (detectionsToDelete.value.length === 0) {
      console.log('No detections to delete');
      return;
    }

    console.log(`Deleting ${detectionsToDelete.value.length} detections`);

    const errors: string[] = [];
    for (const detection of detectionsToDelete.value) {
      const err = await deleteDetection(detection);
      if (err) {
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      error.value = errors.join('; ');
      console.error('Errors deleting detections:', error.value);
    } else {
      console.log('All detections deleted successfully');
    }
  };

  const deleteDetection = async (
    detection: DetectionState,
  ): Promise<string> => {
    try {
      console.log(`Deleting detection ${detection.id}`);
      const err = await apiDeleteDetection(detection.id);
      if (err) {
        error.value = `Failed to delete detection: ${err}`;
        console.error(error.value);
        return err;
      }
      detectionsToDelete.value = detectionsToDelete.value.filter(
        (d) => d.id !== detection.id,
      );
      console.log(`Detection ${detection.id} deleted successfully`);
      return '';
    } catch (e) {
      const errorMsg = 'Failed to delete detection';
      error.value = errorMsg;
      console.error(e);
      return errorMsg;
    }
  };

  const reloadImage = async () => {
    error.value = '';
    try {
      console.log('Reloading image after changes');
      // Prevent infinite loading loop - only reload if we're not already loading
      if (!loading.value && !currentCollectionState.loading) {
        await currentCollectionState.reloadCollection();
        const currentImage = currentCollectionState.getImageById(
          image.value.id,
        );
        if (currentImage) {
          image.value = currentImage;
          console.log('Image reloaded successfully');
        } else {
          error.value = 'Image not found';
          console.error('Image not found after reload');
        }
      } else {
        console.log('Skipping reload - already loading');
      }
    } catch (e) {
      error.value = 'Failed to reload image';
      console.error('Error reloading image:', e);
    }
  };

  // Add a method to update a detection's meta roles
  const updateDetectionMetaRoles = async (detectionId: string) => {
    const index = detections.value.findIndex((d) => d.id === detectionId);
    if (index === -1) {
      console.error(
        `Detection ${detectionId} not found, cannot update meta roles`,
      );
      return;
    }

    console.log(`Updating meta roles for detection ${detectionId}`);

    try {
      detections.value[index].loadingMetaRoles = true;
      const { data, error: metaRoleError } =
        await loadMetaRolesForDetection(detectionId);

      if (metaRoleError) {
        error.value = `Failed to load meta roles: ${metaRoleError}`;
        console.error(error.value);
      } else {
        detections.value[index].availableMetaRoles = data;
        console.log(`Meta roles updated for detection ${detectionId}`);
      }
    } catch (e) {
      error.value = 'Failed to update meta roles';
      console.error('Error updating meta roles:', e);
    } finally {
      detections.value[index].loadingMetaRoles = false;
    }
  };

  return {
    // State
    image,
    detections,
    loading,
    error,
    detectionsToDelete,
    lastImageId,
    lastCollectionId,

    // Getters
    isLoaded,

    // Actions
    init,
    resetState,
    loadImage,
    loadDetections,
    saveImage,
    updateDetectionMetaRoles,
  };
});
