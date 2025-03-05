import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  DetectionState,
  DetectionStateToDa,
  ImageState,
  newImageState,
} from 'src/types';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { axios, axiosErrorHandler } from 'src/api';

export const useImageStore = defineStore('images', () => {
  const currentCollectionState = useCurrentCollectionState();

  const image = ref<ImageState>(newImageState());
  const detections = ref<DetectionState[]>([]);
  const loading = ref(false);

  const detectionsToDelete = ref<DetectionState[]>([]);

  const getSortedDetections = computed(() => {
    return detections.value.toSorted((a, b) => {
      return a.created_date > b.created_date ? -1 : 1;
    });
  });

  const init = () => {
    return;
  };
  const loadImage = async (imageId: string, collectionId: string) => {
    loading.value = true;
    if (!currentCollectionState.loaded) {
      await currentCollectionState.loadCollection(collectionId);
    }
    const currentImage = currentCollectionState.getImageById(imageId);
    if (currentImage) {
      image.value = currentImage;
    } else {
      console.error('Image not found');
    }
    loading.value = false;
  };

  const loadDetections = async (imageId: string) => {
    loading.value = true || imageId;
    try {
      detections.value = image.value?.detections;
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  const saveImage = async () => {
    await updateAllDetections();
    await deleteDetections();
    await reloadImage();
  };

  const updateAllDetections = async () => {
    const detectionsToUpdate = detections.value.filter(
      (detection) => detection.edited,
    );
    for (const detection of detectionsToUpdate) {
      await updateDetection(detection);
    }
  };

  const deleteDetections = async () => {
    for (const detection of detectionsToDelete.value) {
      await deleteDetection(detection);
    }
  };

  const updateDetection = async (detection: DetectionState) => {
    try {
      await axios.put('/detection', DetectionStateToDa(detection));
    } catch (e) {
      axiosErrorHandler(e);
    }
  };

  const deleteDetection = async (detection: DetectionState) => {
    try {
      await axios.delete(`/detection/${detection.id}`);
    } catch (e) {
      axiosErrorHandler(e);
    }
    detectionsToDelete.value = detectionsToDelete.value.filter(
      (d) => d.id !== detection.id,
    );
  };

  const reloadImage = async () => {
    await currentCollectionState.reloadCollection();
    const currentImage = currentCollectionState.getImageById(image.value.id);
    if (currentImage) {
      image.value = currentImage;
    } else {
      console.error('Image not found');
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
  };
});
