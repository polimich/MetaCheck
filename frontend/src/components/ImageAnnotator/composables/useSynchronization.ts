import { ref, computed } from 'vue';
import { DetectionState } from 'src/types';
import { useImageStore } from 'src/stores';

/**
 * Interface for the ImageAnnotator component instance
 */
export interface ImageAnnotatorInstance {
  handleSelectAnnotation: (id: string, shift?: boolean) => void;
  scrollToAnnotation: (detection: DetectionState) => void;
}

/**
 * Composable for synchronizing interactions between ImageAnnotator and other components
 */
export function useSynchronization() {
  // Store for the annotator instance reference
  const annotatorRef = ref<ImageAnnotatorInstance | null>(null);
  const imageStore = useImageStore();

  // Track if synchronization is active
  const isSyncActive = ref(true);

  // Whether we have a valid annotator reference
  const hasAnnotator = computed(() => !!annotatorRef.value);

  /**
   * Set the annotator reference from the parent component
   */
  function setAnnotatorRef(ref: ImageAnnotatorInstance) {
    console.log('Synchronization: Annotator ref registered');
    annotatorRef.value = ref;
  }

  /**
   * Handle scroll to annotation event from AnnotationList
   */
  function handleScrollToAnnotation(detection: DetectionState) {
    if (!annotatorRef.value) {
      console.warn(
        'Synchronization: Cannot scroll to annotation - annotator not available',
      );
      return;
    }

    console.log(`Synchronization: Scrolling to annotation ${detection.id}`);
    annotatorRef.value.scrollToAnnotation(detection);
  }

  /**
   * Handle selection event from AnnotationList
   */
  function handleSelectAnnotation(detection: DetectionState) {
    if (!annotatorRef.value) {
      console.warn(
        'Synchronization: Cannot select annotation - annotator not available',
      );
      return;
    }

    console.log(`Synchronization: Selecting annotation ${detection.id}`);

    // Temporarily disable synchronization to prevent feedback loops
    isSyncActive.value = false;

    // First update the store
    imageStore.selectDetection(detection.id);

    // Then update the annotator
    annotatorRef.value.handleSelectAnnotation(detection.id);

    // Re-enable synchronization
    setTimeout(() => {
      isSyncActive.value = true;
    }, 50);
  }

  /**
   * Handle selection synchronization from ImageAnnotator to other components
   */
  function syncSelectionFromAnnotator(detectionId: string) {
    if (!isSyncActive.value) return;

    console.log(
      `Synchronization: Syncing selection from annotator: ${detectionId}`,
    );
    imageStore.selectDetection(detectionId);
  }

  return {
    // State
    annotatorRef,
    hasAnnotator,

    // Methods
    setAnnotatorRef,
    handleScrollToAnnotation,
    handleSelectAnnotation,
    syncSelectionFromAnnotator,
    isSyncActive,
  };
}
