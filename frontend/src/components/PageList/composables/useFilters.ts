// @author Michael Polívka (xpoliv07)
import { ref, computed } from 'vue';
import {
  HierarchicalImage,
  useCollection,
} from 'src/stores/data/useCollection';

// Types from original useFilters
export type SortOption =
  | 'order'
  | 'name_asc'
  | 'name_desc'
  | 'date_desc'
  | 'date_asc'
  | 'confidence_asc'
  | 'confidence_desc'
  | 'detection_count_desc';
export type VerificationFilter = 'all' | 'verified' | 'unverified';

export interface ConfidenceFilter {
  low: boolean;
  medium: boolean;
  high: boolean;
}

export interface ConfidenceOption {
  label: string;
  value: keyof ConfidenceFilter;
  color: string;
}

// Sort options
const sortOptions = [
  { label: 'Order', value: 'order' },
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
  { label: 'Newest first', value: 'date_desc' },
  { label: 'Oldest first', value: 'date_asc' },
  { label: 'Confidence (Low to High)', value: 'confidence_asc' },
  { label: 'Confidence (High to Low)', value: 'confidence_desc' },
  { label: 'Most Detections', value: 'detection_count_desc' },
];

// Verification filter options
const verificationOptions = [
  { label: 'All verification', value: 'all' },
  { label: 'Verified only', value: 'verified' },
  { label: 'Unverified only', value: 'unverified' },
];

// Confidence options
const confidenceOptions = [
  { label: 'Low', value: 'low', color: 'red' },
  { label: 'Medium', value: 'medium', color: 'orange' },
  { label: 'High', value: 'high', color: 'green' },
];

/**
 * Combined filters composable that merges useFilters and useImageFiltering
 * Provides UI-level filter controls as well as actual image filtering logic
 */
export function useFilters(
  initialSortBy?: string,
  initialFilterVerified?: string,
  initialConfidenceFilters?: Record<string, boolean>,
  updateSortBy?: (sort: string) => void,
  updateFilterVerified?: (filter: string) => void,
  updateConfidenceFilters?: (filters: Record<string, boolean>) => void,
  getVerificationStatus?: (id: string) => string,
  getAttentionLevel?: (id: string) => number,
  needsAttention?: (id: string) => boolean,
  hasLowConfidence?: (id: string) => boolean,
  hasMediumConfidence?: (id: string) => boolean,
) {
  // Get the store
  const collectionStore = useCollection();

  // Filter and sort refs - initialize from props if provided
  const sortBy = ref(initialSortBy || 'order');
  const filterVerified = ref(initialFilterVerified || 'all');
  const searchQuery = ref('');
  const filterNeedsAttention = ref(false);
  const attentionLevel = ref('all');

  // Confidence filter refs
  const confidenceFilters = ref(
    initialConfidenceFilters || {
      low: false,
      medium: false,
      high: false,
    },
  );

  // Setup computed properties for two-way binding if update functions are provided
  const sortByComputed = computed({
    get: () => sortBy.value,
    set: (value: string) => {
      sortBy.value = value;
      if (updateSortBy) updateSortBy(value);
    },
  });

  const filterVerifiedComputed = computed({
    get: () => filterVerified.value,
    set: (value: string) => {
      filterVerified.value = value;
      if (updateFilterVerified) updateFilterVerified(value);
    },
  });

  const confidenceFiltersComputed = computed({
    get: () => confidenceFilters.value,
    set: (value: Record<string, boolean>) => {
      confidenceFilters.value = value;
      if (updateConfidenceFilters) updateConfidenceFilters(value);
    },
  });

  // Toggle a confidence filter
  const toggleConfidenceFilter = (level: string) => {
    const newFilters = { ...confidenceFilters.value };
    newFilters[level] = !newFilters[level];
    confidenceFilters.value = newFilters;
    if (updateConfidenceFilters) updateConfidenceFilters(newFilters);
  };

  // Map color names to hex values
  const getColorValue = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      red: '#F44336',
      orange: '#FF9800',
      green: '#4CAF50',
      'grey-5': '#9E9E9E',
    };

    return colorMap[colorName] || '#9E9E9E';
  };

  // Filtered images based on current filters
  const filteredImages = computed(() => {
    if (!collectionStore.allImagesFlattened) return [];

    if (!getVerificationStatus || !needsAttention) {
      // If filtering functions aren't provided, just return all images
      return collectionStore.allImagesFlattened;
    }

    let images = [...collectionStore.allImagesFlattened];

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
  function sortImages(images: HierarchicalImage[]): HierarchicalImage[] {
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
      case 'detection_count_desc':
        return images.sort(
          (a, b) => (b.detection_count || 0) - (a.detection_count || 0),
        );
      case 'criticalFirst':
        // Sort by attention needed (low confidence or unverified detections)
        if (getAttentionLevel) {
          return images.sort((a, b) => {
            const aNeeds = getAttentionLevel(a.id);
            const bNeeds = getAttentionLevel(b.id);
            return bNeeds - aNeeds; // Highest needs attention first
          });
        }
        return images;
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

    // Update external values if callbacks provided
    if (updateSortBy) updateSortBy(sortBy.value);
    if (updateFilterVerified) updateFilterVerified(filterVerified.value);
    if (updateConfidenceFilters)
      updateConfidenceFilters(confidenceFilters.value);
  }

  return {
    // Return all the refs and computed properties
    sortOptions,
    verificationOptions,
    confidenceOptions,
    // Return the computed properties for two-way binding if update functions were provided
    sortBy: updateSortBy ? sortByComputed : sortBy,
    filterVerified: updateFilterVerified
      ? filterVerifiedComputed
      : filterVerified,
    confidenceFilters: updateConfidenceFilters
      ? confidenceFiltersComputed
      : confidenceFilters,
    // Regular refs
    searchQuery,
    filterNeedsAttention,
    attentionLevel,
    // Methods
    toggleConfidenceFilter,
    getColorValue,
    filteredImages,
    resetFilters,
  };
}
