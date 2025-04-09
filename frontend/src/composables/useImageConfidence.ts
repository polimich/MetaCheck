import { useCurrentCollectionState } from 'stores/frontend-state';

export function useImageConfidence() {
  // Get the store
  const currentCollection = useCurrentCollectionState();

  // Constants for confidence thresholds
  const LOW_CONFIDENCE_THRESHOLD = 0.7; // 70% confidence
  const MEDIUM_CONFIDENCE_THRESHOLD = 0.9; // 90% confidence

  // Check if image has low confidence detections
  function hasLowConfidenceDetections(imageId: string): boolean {
    // Find the image in the collection
    if (!currentCollection.collection?.images) return false;
    const image = currentCollection.collection.images.find(
      (img) => img.id === imageId,
    );
    if (!image) return false;

    // Only consider images with detections as potentially low confidence
    if (!image.detection_count || image.detection_count === 0) {
      return false; // No detections means it's fine
    }

    // Check if confidence is below the low threshold
    return (
      image.confidence !== undefined &&
      image.confidence < LOW_CONFIDENCE_THRESHOLD
    );
  }

  // Check if image has medium confidence detections
  function hasMediumConfidenceDetections(imageId: string): boolean {
    // Find the image in the collection
    if (!currentCollection.collection?.images) return false;
    const image = currentCollection.collection.images.find(
      (img) => img.id === imageId,
    );
    if (!image) return false;

    // Only consider images with detections
    if (!image.detection_count || image.detection_count === 0) {
      return false;
    }

    // Check if confidence is between low and medium thresholds
    return (
      image.confidence !== undefined &&
      image.confidence >= LOW_CONFIDENCE_THRESHOLD &&
      image.confidence < MEDIUM_CONFIDENCE_THRESHOLD
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
    if (!currentCollection.collection?.images) return 0;
    const image = currentCollection.collection.images.find(
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
