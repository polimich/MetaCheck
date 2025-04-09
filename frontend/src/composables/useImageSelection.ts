import { ref } from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';

export function useImageSelection() {
  // Get the store
  const currentCollection = useCurrentCollectionState();

  // Selection state
  const selectedImages = ref<string[]>([]);
  const selectMode = ref(false);

  function toggleImageSelection(imageId: string) {
    const index = selectedImages.value.indexOf(imageId);
    if (index === -1) {
      selectedImages.value.push(imageId);
    } else {
      selectedImages.value.splice(index, 1);
    }
  }

  function toggleSelectMode() {
    selectMode.value = !selectMode.value;
    if (!selectMode.value) {
      selectedImages.value = [];
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
