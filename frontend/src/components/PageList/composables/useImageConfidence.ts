// @author Michael Polívka (xpoliv07)
import { useCollection } from 'src/stores/data/useCollection';

export function useImageConfidence() {
  // Get the store
  const collectionStore = useCollection();

  // Constants for confidence thresholds
  const LOW_CONFIDENCE_THRESHOLD = 0.7; // 70% confidence
  const MEDIUM_CONFIDENCE_THRESHOLD = 0.9; // 90% confidence

  // Check if image has low confidence detections
  function hasLowConfidenceDetections(imageId: string): boolean {
    // Find the image in the collection
    if (!collectionStore.allImagesFlattened) return false;
    const image = collectionStore.allImagesFlattened.find(
      (img) => img.id === imageId,
    );
    if (!image) return false;

    // Check if any confidence value is below the low threshold
    return (
      (image.page_index_confidence !== undefined &&
        image.page_index_confidence < LOW_CONFIDENCE_THRESHOLD) ||
      (image.page_type_confidence !== undefined &&
        image.page_type_confidence < LOW_CONFIDENCE_THRESHOLD)
    );
  }

  // Check if image has medium confidence detections
  function hasMediumConfidenceDetections(imageId: string): boolean {
    // Find the image in the collection
    if (!collectionStore.allImagesFlattened) return false;
    const image = collectionStore.allImagesFlattened.find(
      (img) => img.id === imageId,
    );
    if (!image) return false;

    // If any confidence is low, we don't consider it medium
    if (
      (image.page_index_confidence !== undefined &&
        image.page_index_confidence < LOW_CONFIDENCE_THRESHOLD) ||
      (image.page_type_confidence !== undefined &&
        image.page_type_confidence < LOW_CONFIDENCE_THRESHOLD)
    ) {
      return false;
    }

    // Check if any confidence is between low and medium thresholds
    return (
      (image.page_index_confidence !== undefined &&
        image.page_index_confidence >= LOW_CONFIDENCE_THRESHOLD &&
        image.page_index_confidence < MEDIUM_CONFIDENCE_THRESHOLD) ||
      (image.page_type_confidence !== undefined &&
        image.page_type_confidence >= LOW_CONFIDENCE_THRESHOLD &&
        image.page_type_confidence < MEDIUM_CONFIDENCE_THRESHOLD)
    );
  }

  // Get confidence level label
  function getConfidenceLevel(imageId: string): string {
    if (hasLowConfidenceDetections(imageId)) {
      return 'low';
    } else if (hasMediumConfidenceDetections(imageId)) {
      return 'medium';
    }
    return 'high';
  }

  // Need attention if: has unverified detections OR has low confidence detections
  function needsAttention(
    imageId: string,
    hasUnverifiedDetections: (id: string) => boolean,
  ): boolean {
    return (
      hasUnverifiedDetections(imageId) || hasLowConfidenceDetections(imageId)
    );
  }

  // Get attention level for a page (0-10, higher means more urgent attention needed)
  function getAttentionLevel(
    imageId: string,
    hasUnverifiedDetections: (id: string) => boolean,
  ): number {
    // Find the image in the collection
    if (!collectionStore.allImagesFlattened) return 0;
    const image = collectionStore.allImagesFlattened.find(
      (img) => img.id === imageId,
    );
    if (!image) return 0;

    if (hasLowConfidenceDetections(imageId)) {
      return 10; // Highest priority - low confidence
    } else if (hasUnverifiedDetections(imageId)) {
      return 7; // High priority - unverified detections
    } else if (hasMediumConfidenceDetections(imageId)) {
      return 4; // Medium priority - medium confidence
    }
    return 0; // No attention needed
  }

  return {
    LOW_CONFIDENCE_THRESHOLD,
    MEDIUM_CONFIDENCE_THRESHOLD,
    hasLowConfidenceDetections,
    hasMediumConfidenceDetections,
    getConfidenceLevel,
    needsAttention,
    getAttentionLevel,
  };
}
