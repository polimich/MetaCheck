import { computed, ref, watch } from 'vue';
import { useImageStore } from 'src/stores';

/**
 * Composable for managing annotation selection state across components
 * This centralizes the selection logic and provides a consistent API
 */
export function useSelectionManagement() {
  // Get store for state management
  const imageStore = useImageStore();

  // Local selected IDs for multi-select support
  const selectedIds = ref<Set<string>>(new Set());

  // Computed property for the currently selected detection
  const selectedDetection = computed(() => {
    if (!imageStore.selectedDetectionId) return null;
    return (
      imageStore.detections.find(
        (d) => d.id === imageStore.selectedDetectionId,
      ) || null
    );
  });

  // Computed property for all selected detections (for multi-select support)
  const selectedDetections = computed(() => {
    return imageStore.detections.filter((d) => selectedIds.value.has(d.id));
  });

  // Sync local selection with store
  watch(
    () => imageStore.selectedDetectionId,
    (newId) => {
      if (newId) {
        // Single selection mode - clear other selections and add this one
        selectedIds.value = new Set([newId]);
      } else {
        // Clear selection
        selectedIds.value.clear();
      }
    },
  );

  /**
   * Select a detection by ID
   * @param id - Detection ID to select
   * @param multiSelect - Whether to add to existing selection (shift key behavior)
   */
  function selectDetection(id: string, multiSelect = false) {
    if (!id) return;

    if (multiSelect) {
      // Toggle selection in multi-select mode
      if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
      } else {
        selectedIds.value.add(id);
      }

      // When in multi-select, the store's selectedDetectionId should be null
      // as it can only represent a single selection
      imageStore.selectDetection(null);
    } else {
      // Single selection - update both local and store state
      selectedIds.value = new Set([id]);
      imageStore.selectDetection(id);
    }
  }

  /**
   * Deselect all annotations
   */
  function deselectAll() {
    selectedIds.value.clear();
    imageStore.selectDetection(null);
  }

  /**
   * Check if a detection is selected
   * @param id - Detection ID to check
   */
  function isSelected(id: string) {
    return selectedIds.value.has(id);
  }

  return {
    // State
    selectedIds,
    selectedDetection,
    selectedDetections,

    // Methods
    selectDetection,
    deselectAll,
    isSelected,
  };
}
