import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { DetectionState, ImageState, newImageState } from 'src/types';
import { useCurrentCollectionState } from 'stores/frontend-state';
import {
  createDetection,
  updateDetection,
  deleteDetection as apiDeleteDetection,
  loadMetaRolesForDetection,
} from 'src/api/services';

export const useImageStore = defineStore('images', () => {
  const currentCollectionState = useCurrentCollectionState();

  const image = ref<ImageState>(newImageState());
  const detections = ref<DetectionState[]>([]);
  const detectionIdsBackup = ref<string[]>([]);
  const loading = ref(false);
  const error = ref('');

  const detectionsToDelete = ref<DetectionState[]>([]);
  const detectionsToAdd = ref<DetectionState[]>([]);

  // also the availableMetaRoles property to the detections
  const getSortedDetections = computed(() => {
    return detections.value
      .map((detection) => {
        // Ensure meta role properties are initialized
        detection.availableMetaRoles = detection.availableMetaRoles || [];
        detection.loadingMetaRoles = detection.loadingMetaRoles !== false;
        return detection;
      })
      .toSorted((a, b) => (a.created_date > b.created_date ? -1 : 1));
  });

  const init = () => {
    return;
  };

  const loadImage = async (imageId: string, collectionId: string) => {
    loading.value = true;
    error.value = '';
    try {
      if (!currentCollectionState.loaded) {
        await currentCollectionState.loadCollection(collectionId);
      }
      const currentImage = currentCollectionState.getImageById(imageId);
      if (currentImage) {
        image.value = currentImage;
      } else {
        error.value = 'Image not found';
        console.error('Image not found');
      }
    } catch (e) {
      error.value = 'Failed to load image';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  const loadDetections = async (imageId: string) => {
    loading.value = true;
    error.value = '';
    try {
      // Use imageId to validate that the current image matches
      if (imageId !== image.value.id) {
        error.value = 'Image ID mismatch';
        console.error(`Image ID mismatch: ${imageId} vs ${image.value.id}`);
        return;
      }

      if (!image.value?.detections) {
        error.value = 'No detections found';
        return;
      }

      detections.value = image.value.detections.map((detection) => ({
        ...detection,
        availableMetaRoles: [],
        loadingMetaRoles: true,
      }));
      detectionIdsBackup.value = detections.value.map((d) => d.id);

      // Load meta roles for all detections
      await Promise.all(
        detections.value.map(async (detection) => {
          const { data, error: metaRoleError } =
            await loadMetaRolesForDetection(detection.id);
          if (metaRoleError) {
            console.error(
              `Error loading meta roles for detection ${detection.id}:`,
              metaRoleError,
            );
          }

          const index = detections.value.findIndex(
            (d) => d.id === detection.id,
          );
          if (index !== -1) {
            detections.value[index].availableMetaRoles = data;
            detections.value[index].loadingMetaRoles = false;
          }
        }),
      );
    } catch (e) {
      error.value = 'Failed to load detections';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

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
    }
  };

  const updateAllDetections = async () => {
    error.value = '';
    const detectionsToUpdate = detections.value.filter(
      (detection) =>
        detection.edited && detectionIdsBackup.value.includes(detection.id),
    );

    const errors: string[] = [];
    for (const detection of detectionsToUpdate) {
      const err = await updateDetection(detection);
      if (err) {
        errors.push(`Failed to update detection: ${err}`);
      }
    }

    if (errors.length > 0) {
      error.value = errors.join('; ');
    }
  };

  const deleteDetections = async () => {
    error.value = '';
    const errors: string[] = [];
    for (const detection of detectionsToDelete.value) {
      const err = await deleteDetection(detection);
      if (err) {
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      error.value = errors.join('; ');
    }
  };

  const deleteDetection = async (
    detection: DetectionState,
  ): Promise<string> => {
    try {
      const err = await apiDeleteDetection(detection.id);
      if (err) {
        error.value = `Failed to delete detection: ${err}`;
        console.error(error.value);
        return err;
      }
      detectionsToDelete.value = detectionsToDelete.value.filter(
        (d) => d.id !== detection.id,
      );
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
      await currentCollectionState.reloadCollection();
      const currentImage = currentCollectionState.getImageById(image.value.id);
      if (currentImage) {
        image.value = currentImage;
      } else {
        error.value = 'Image not found';
        console.error('Image not found');
      }
    } catch (e) {
      error.value = 'Failed to reload image';
      console.error(e);
    }
  };

  // Add a method to update a detection's meta roles
  const updateDetectionMetaRoles = async (detectionId: string) => {
    const index = detections.value.findIndex((d) => d.id === detectionId);
    if (index !== -1) {
      try {
        detections.value[index].loadingMetaRoles = true;
        const { data, error: metaRoleError } =
          await loadMetaRolesForDetection(detectionId);

        if (metaRoleError) {
          error.value = `Failed to load meta roles: ${metaRoleError}`;
          console.error(error.value);
        } else {
          detections.value[index].availableMetaRoles = data;
        }
      } catch (e) {
        error.value = 'Failed to update meta roles';
        console.error(e);
      } finally {
        detections.value[index].loadingMetaRoles = false;
      }
    }
  };

  return {
    image,
    detections,
    init,
    loadImage,
    loadDetections,
    getSortedDetections,
    detectionsToDelete,
    saveImage,
    updateDetectionMetaRoles,
    loading,
    error,
  };
});
