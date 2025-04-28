import { ref } from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';

export function useImageSelection() {
  // Get the store
  const currentCollection = useCurrentCollectionState();

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
    if (
      shiftKey &&
      lastSelectedImageId.value &&
      currentCollection.collection?.images
    ) {
      const images = currentCollection.collection.images;
      const currentIndex = images.findIndex((img) => img.id === imageId);
      const lastIndex = images.findIndex(
        (img) => img.id === lastSelectedImageId.value,
      );

      if (currentIndex >= 0 && lastIndex >= 0) {
        // Determine range start and end
        const startIdx = Math.min(currentIndex, lastIndex);
        const endIdx = Math.max(currentIndex, lastIndex);

        // Select all images in the range
        for (let i = startIdx; i <= endIdx; i++) {
          if (!selectedImages.value.includes(images[i].id)) {
            selectedImages.value.push(images[i].id);
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

  function toggleSelectMode() {
    selectMode.value = !selectMode.value;
    if (!selectMode.value) {
      selectedImages.value = [];
      lastSelectedImageId.value = null;
    }
  }

  function selectAll() {
    if (!currentCollection.collection?.images) return;

    selectedImages.value = currentCollection.collection.images.map(
      (img) => img.id,
    );
  }

  function deselectAll() {
    selectedImages.value = [];
    lastSelectedImageId.value = null;
  }

  function markSelectedAsVerified() {
    // Implement this function to mark selected images as verified
    console.log('Mark as verified:', selectedImages.value);
    // After processing, you might want to:
    deselectAll();
    selectMode.value = false;
  }

  function downloadSelected() {
    // Implement this function to download selected images
    console.log('Download:', selectedImages.value);
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
