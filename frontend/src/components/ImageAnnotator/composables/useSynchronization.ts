// @author Michael Polívka (xpoliv07)
import { ref, computed } from 'vue';
import { DetectionState } from 'src/types';
import { useImage } from 'src/stores';

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
  const annotatorRef = ref<ImageAnnotatorInstance | null>(null);
  const imageStore = useImage();

  const isSyncActive = ref(true);

  const hasAnnotator = computed(() => !!annotatorRef.value);

  /**
   * Set the annotator reference from the parent component
   */
  function setAnnotatorRef(ref: ImageAnnotatorInstance) {
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

    isSyncActive.value = false;

    imageStore.selectDetection(detection.id);

    annotatorRef.value.handleSelectAnnotation(detection.id);

    setTimeout(() => {
      isSyncActive.value = true;
    }, 50);
  }

  /**
   * Handle selection synchronization from ImageAnnotator to other components
   */
  function syncSelectionFromAnnotator(detectionId: string) {
    if (!isSyncActive.value) return;

    imageStore.selectDetection(detectionId);
  }

  return {
    annotatorRef,
    hasAnnotator,

    setAnnotatorRef,
    handleScrollToAnnotation,
    handleSelectAnnotation,
    syncSelectionFromAnnotator,
    isSyncActive,
  };
}
