// @author Michael Polívka (xpoliv07)
import { ref } from 'vue';
import { useCollection } from 'src/stores/data/useCollection';

export function useImageSelection() {
  // Get the stores
  const collectionStore = useCollection();

  // Selection state
  const selectedImages = ref<string[]>([]);
  const selectMode = ref(false);
  const lastSelectedImageId = ref<string | null>(null);

  function toggleImageSelection(imageId: string, shiftKey = false) {
    // If not in select mode, don't handle selection
    if (!selectMode.value) {
      return;
    }

    // Handle shift+click for range selection
    if (shiftKey && lastSelectedImageId.value) {
      // Get all images from all sections in the hierarchical view
      const allImages = getAllImagesFromHierarchy();

      const currentIndex = allImages.findIndex((img) => img.id === imageId);
      const lastIndex = allImages.findIndex(
        (img) => img.id === lastSelectedImageId.value,
      );

      if (currentIndex >= 0 && lastIndex >= 0) {
        // Determine range start and end
        const startIdx = Math.min(currentIndex, lastIndex);
        const endIdx = Math.max(currentIndex, lastIndex);

        // Select all images in the range
        for (let i = startIdx; i <= endIdx; i++) {
          if (!selectedImages.value.includes(allImages[i].id)) {
            selectedImages.value.push(allImages[i].id);
          }
        }
      }
    } else {
      // Normal toggle selection logic
      const index = selectedImages.value.indexOf(imageId);
      if (index === -1) {
        selectedImages.value.push(imageId);
      } else {
        selectedImages.value.splice(index, 1);
      }
    }

    // Update the last selected image
    lastSelectedImageId.value = imageId;
  }

  // Helper function to get all images from hierarchical data structure
  function getAllImagesFromHierarchy() {
    return collectionStore.allImagesFlattened;
  }

  function toggleSelectMode() {
    selectMode.value = !selectMode.value;
    if (!selectMode.value) {
      selectedImages.value = [];
      lastSelectedImageId.value = null;
    }
  }

  function selectAll() {
    const allImages = getAllImagesFromHierarchy();
    selectedImages.value = allImages.map((img) => img.id);
  }

  function deselectAll() {
    selectedImages.value = [];
    lastSelectedImageId.value = null;
  }

  function markSelectedAsVerified() {
    // Implement this function to mark selected images as verified

    // After processing, you might want to:
    deselectAll();
    selectMode.value = false;
  }

  function downloadSelected() {
    // Implement this function to download selected images
  }

  return {
    selectedImages,
    selectMode,
    toggleImageSelection,
    toggleSelectMode,
    selectAll,
    deselectAll,
    markSelectedAsVerified,
    downloadSelected,
  };
}
