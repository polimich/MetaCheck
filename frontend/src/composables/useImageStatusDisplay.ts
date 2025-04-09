import { computed } from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';

export function useImageStatusDisplay(
  getConfidenceLevel: (imageId: string) => string,
  getVerificationStatus: (imageId: string) => string,
  hasLowConfidenceDetections: (imageId: string) => boolean,
  hasMediumConfidenceDetections: (imageId: string) => boolean,
  hasUnverifiedDetections: (imageId: string) => boolean,
) {
  // Get the store
  const currentCollection = useCurrentCollectionState();

  // Get color for verification status badge
  function getVerificationStatusColor(imageId: string): string {
    const status = getVerificationStatus(imageId);
    const confidenceLevel = getConfidenceLevel(imageId);

    // If low confidence, always show red regardless of verification status
    if (confidenceLevel === 'low') {
      return 'red-8';
    }

    // Otherwise, color based on verification status
    if (status === 'verified') return 'green-8';
    if (status === 'partial') return 'orange-8';
    return 'grey-7';
  }

  // Get tooltip text for verification status
  function getVerificationTooltip(imageId: string): string {
    const status = getVerificationStatus(imageId);
    const confidenceLevel = getConfidenceLevel(imageId);

    let tooltip = '';

    // Add verification status
    if (status === 'verified') tooltip += 'All annotations verified';
    else if (status === 'partial') tooltip += 'Some annotations verified';
    else tooltip += 'No annotations verified';

    // Add confidence level if not high
    if (confidenceLevel === 'low') {
      tooltip += '\nLow confidence (&lt; 70%)';
    } else if (confidenceLevel === 'medium') {
      tooltip += '\nMedium confidence (70-90%)';
    }

    return tooltip;
  }

  // Generate statistics for the current collection
  const statistics = computed(() => {
    if (!currentCollection.collection || !currentCollection.collection.images) {
      return {
        total: 0,
        needsAttention: 0,
        lowConfidence: 0,
        mediumConfidence: 0,
        unverified: 0,
      };
    }

    const images = currentCollection.collection.images;
    const needsAttentionCount = images.filter(
      (img) =>
        hasLowConfidenceDetections(img.id) || hasUnverifiedDetections(img.id),
    ).length;
    const lowConfidence = images.filter((img) =>
      hasLowConfidenceDetections(img.id),
    ).length;
    const mediumConfidence = images.filter((img) =>
      hasMediumConfidenceDetections(img.id),
    ).length;
    const unverified = images.filter((img) =>
      hasUnverifiedDetections(img.id),
    ).length;

    return {
      total: images.length,
      needsAttention: needsAttentionCount,
      lowConfidence,
      mediumConfidence,
      unverified,
    };
  });

  return {
    getVerificationStatusColor,
    getVerificationTooltip,
    statistics,
  };
}
