// @author Michael Polívka (xpoliv07)
import { useCollection } from 'src/stores/data/useCollection';
import { computed } from 'vue';

export function useImageVerification() {
  // Get the store
  const collectionStore = useCollection();

  // Check if image has unverified detections
  function hasUnverifiedDetections(imageId: string): boolean {
    // Find the image in the collection
    if (!collectionStore.allImagesFlattened) return false;
    const image = collectionStore.allImagesFlattened.find(
      (img) => img.id === imageId,
    );
    if (!image) return false;

    // Check if detection count doesn't match annotated detection count
    return (
      image.detection_count !== undefined &&
      image.annotated_detection_count !== undefined &&
      image.detection_count !== image.annotated_detection_count
    );
  }

  // Get image verification status (based on detection matching)
  function getImageVerificationStatus(imageId: string): string {
    // Find the image in the collection
    if (!collectionStore.allImagesFlattened) return 'unverified';
    const image = collectionStore.allImagesFlattened.find(
      (img) => img.id === imageId,
    );
    if (!image) return 'unverified';

    // If there are no detections, consider it unverified
    if (!image.detection_count) return 'unverified';

    // If all detections are annotated, it's verified
    if (
      image.detection_count !== undefined &&
      image.annotated_detection_count !== undefined
    ) {
      if (image.annotated_detection_count === image.detection_count) {
        return 'verified';
      } else if (image.annotated_detection_count > 0) {
        // Some but not all detections annotated
        return 'partial';
      }
    }

    return 'unverified';
  }

  // Get statistics for the current collection
  const verificationStatistics = computed(() => {
    if (!collectionStore.allImagesFlattened) {
      return {
        total: 0,
        verified: 0,
        partial: 0,
        unverified: 0,
      };
    }

    const images = collectionStore.allImagesFlattened;
    const verified = images.filter(
      (img) => getImageVerificationStatus(img.id) === 'verified',
    ).length;
    const partial = images.filter(
      (img) => getImageVerificationStatus(img.id) === 'partial',
    ).length;
    const unverified = images.filter(
      (img) => getImageVerificationStatus(img.id) === 'unverified',
    ).length;

    return {
      total: images.length,
      verified,
      partial,
      unverified,
    };
  });

  return {
    hasUnverifiedDetections,
    getImageVerificationStatus,
    verificationStatistics,
  };
}
