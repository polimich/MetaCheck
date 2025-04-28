import { computed } from 'vue';

export type SortOption =
  | 'order'
  | 'name_asc'
  | 'name_desc'
  | 'date_desc'
  | 'date_asc'
  | 'confidence_asc'
  | 'confidence_desc';
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

export function useFilters(
  initialSortBy: string,
  initialFilterVerified: string,
  initialConfidenceFilters: Record<string, boolean>,
  updateSortBy: (sort: string) => void,
  updateFilterVerified: (filter: string) => void,
  updateConfidenceFilters: (filters: Record<string, boolean>) => void,
) {
  // Sort by with two-way binding
  const sortBy = computed({
    get: () => initialSortBy,
    set: (value: string) => updateSortBy(value),
  });

  // Verification filter with two-way binding
  const filterVerified = computed({
    get: () => initialFilterVerified,
    set: (value: string) => updateFilterVerified(value),
  });

  // Confidence filters with two-way binding
  const confidenceFilters = computed({
    get: () => initialConfidenceFilters,
    set: (value: Record<string, boolean>) => updateConfidenceFilters(value),
  });

  // Toggle a confidence filter
  const toggleConfidenceFilter = (level: string) => {
    const newFilters = { ...confidenceFilters.value };
    newFilters[level] = !newFilters[level];
    updateConfidenceFilters(newFilters);
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

  return {
    sortOptions,
    verificationOptions,
    confidenceOptions,
    sortBy,
    filterVerified,
    confidenceFilters,
    toggleConfidenceFilter,
    getColorValue,
  };
}
