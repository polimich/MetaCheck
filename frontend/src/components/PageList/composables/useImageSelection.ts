import { ref } from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useCollection } from 'src/stores/data/useCollection';

export function useImageSelection() {
  // Get the stores
  const currentCollection = useCurrentCollectionState();
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
    const allImages: { id: string }[] = [];

    if (
      collectionStore.metaElementSections &&
      collectionStore.metaElementSections.length > 0
    ) {
      // Use hierarchical data
      collectionStore.metaElementSections.forEach((section) => {
        if (section.images && Array.isArray(section.images)) {
          allImages.push(...section.images);
        }
      });
    } else if (currentCollection.collection?.images) {
      // Fallback to flat data if hierarchical is not available
      allImages.push(...currentCollection.collection.images);
    }

    return allImages;
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
