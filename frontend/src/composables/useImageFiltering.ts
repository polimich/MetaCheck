import { ref, computed } from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { ImageState } from 'src/types';

export function useImageFiltering(
  getVerificationStatus: (id: string) => string,
  getAttentionLevel: (id: string) => number,
  needsAttention: (id: string) => boolean,
  hasLowConfidence?: (id: string) => boolean,
  hasMediumConfidence?: (id: string) => boolean,
) {
  // Get the store
  const currentCollection = useCurrentCollectionState();

  // Filter and sort refs
  const sortBy = ref('order'); // 'order', 'name', 'date', 'criticalFirst'
  const filterVerified = ref('all'); // 'all', 'verified', 'unverified', 'partial'
  const filterNeedsAttention = ref(false); // Filter for images with low confidence or unverified detections
  const searchQuery = ref('');
  const attentionLevel = ref('all'); // 'all', 'low', 'medium'

  // Confidence filter refs
  const confidenceFilters = ref({
    low: false,
    medium: false,
    high: false,
  });

  // Filtered images based on current filters
  const filteredImages = computed(() => {
    if (!currentCollection.collection || !currentCollection.collection.images)
      return [];

    let images = [...currentCollection.collection.images];

    // Apply search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      images = images.filter(
        (img) =>
          img.name.toLowerCase().includes(query) ||
          img.id.toLowerCase().includes(query),
      );
    }

    // Apply verification filter
    if (filterVerified.value !== 'all') {
      images = images.filter((img) => {
        const verificationStatus = getVerificationStatus(img.id);
        return verificationStatus === filterVerified.value;
      });
    }

    // Filter for images that need attention
    if (filterNeedsAttention.value) {
      images = images.filter((img) => needsAttention(img.id));

      // Apply attention level filter if provided
      if (
        attentionLevel.value !== 'all' &&
        hasLowConfidence &&
        hasMediumConfidence
      ) {
        if (attentionLevel.value === 'low') {
          images = images.filter((img) => hasLowConfidence(img.id));
        } else if (attentionLevel.value === 'medium') {
          images = images.filter((img) => hasMediumConfidence(img.id));
        }
      }
    }

    // Apply confidence filters
    const hasAnyConfidenceFilter =
      confidenceFilters.value.low ||
      confidenceFilters.value.medium ||
      confidenceFilters.value.high;

    if (hasAnyConfidenceFilter && hasLowConfidence && hasMediumConfidence) {
      images = images.filter((img) => {
        const hasLow = hasLowConfidence(img.id);
        const hasMedium = hasMediumConfidence(img.id);
        const hasHigh = !hasLow && !hasMedium;

        if (confidenceFilters.value.low && hasLow) {
          return true;
        }
        if (confidenceFilters.value.medium && hasMedium) {
          return true;
        }
        if (confidenceFilters.value.high && hasHigh) {
          return true;
        }
        return false;
      });
    }

    // Sort images
    return sortImages(images);
  });

  // Sort images based on the current sort option
  function sortImages(images: ImageState[]): ImageState[] {
    switch (sortBy.value) {
      case 'name_asc':
        return images.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return images.sort((a, b) => b.name.localeCompare(a.name));
      case 'date_desc':
      case 'date_asc':
        // Fallback to comparison by ID if dates aren't available
        return images.sort(
          (a, b) =>
            a.id.localeCompare(b.id) * (sortBy.value === 'date_asc' ? 1 : -1),
        );
      case 'confidence_asc':
        return images.sort((a, b) => (a.confidence || 0) - (b.confidence || 0));
      case 'confidence_desc':
        return images.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      case 'criticalFirst':
        // Sort by attention needed (low confidence or unverified detections)
        return images.sort((a, b) => {
          const aNeeds = getAttentionLevel(a.id);
          const bNeeds = getAttentionLevel(b.id);
          return bNeeds - aNeeds; // Highest needs attention first
        });
      case 'order':
        return images.sort((a, b) => a.order - b.order);
      default:
        // Sort by ID as a stable default sort
        return images.sort((a, b) => a.id.localeCompare(b.id));
    }
  }

  // Reset all filters
  function resetFilters() {
    sortBy.value = 'order';
    filterVerified.value = 'all';
    filterNeedsAttention.value = false;
    searchQuery.value = '';
    attentionLevel.value = 'all';
    confidenceFilters.value = {
      low: false,
      medium: false,
      high: false,
    };
  }

  return {
    sortBy,
    filterVerified,
    filterNeedsAttention,
    searchQuery,
    attentionLevel,
    confidenceFilters,
    filteredImages,
    resetFilters,
  };
}
