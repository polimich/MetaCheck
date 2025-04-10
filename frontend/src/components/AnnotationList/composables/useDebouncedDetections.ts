import { ref, watch, Ref } from 'vue';
import { DetectionState } from 'src/types/frontend-state';

export function useDebouncedDetections(detections: Ref<DetectionState[]>) {
  // Create a debounced copy of the detections array
  const debouncedDetections = ref<DetectionState[]>([]);

  // Keep track of timeout
  let debounceTimeout: number | null = null;

  // Update the debounced detections with a delay
  const updateDebouncedDetections = (newDetections: DetectionState[]) => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    // Only update if there's a significant change
    if (Math.abs(debouncedDetections.value.length - newDetections.length) > 2) {
      // Immediate update for large changes
      debouncedDetections.value = [...newDetections];
      console.log(
        `Immediate update: ${debouncedDetections.value.length} detections`,
      );
    } else {
      // Debounced update for small changes
      debounceTimeout = window.setTimeout(() => {
        debouncedDetections.value = [...newDetections];
        console.log(
          `Debounced update: ${debouncedDetections.value.length} detections`,
        );
        debounceTimeout = null;
      }, 300); // 300ms debounce
    }
  };

  // Watch for changes in the detections prop
  watch(
    detections,
    (newDetections) => {
      updateDebouncedDetections(newDetections);
    },
    { immediate: true, deep: true },
  );

  return {
    debouncedDetections,
    updateDebouncedDetections,
  };
}
