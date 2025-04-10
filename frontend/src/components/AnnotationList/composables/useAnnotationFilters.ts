import { ref, computed, watch, Ref } from 'vue';
import { DetectionState } from 'src/types/frontend-state';

export type SortOption =
  | 'confidence-asc'
  | 'confidence-desc'
  | 'position'
  | 'default';
export type VerificationFilter = 'all' | 'unverified' | 'verified';
export type ConfidenceFilter = 'all' | 'low' | 'medium' | 'high';

export function useAnnotationFilters(detections: Ref<DetectionState[]>) {
  // Filter/sort state
  const sortBy = ref('default');
  const filterVerification = ref('all');
  const filterType = ref('');
  const filterConfidence = ref('all');
  const filterEdited = ref(false);

  // Get unique detection types for dropdown with computed display names
  const uniqueTypes = computed(() => {
    const types = new Map<string, { label: string; value: string }>();

    detections.value.forEach((detection) => {
      if (detection.computed_type && !types.has(detection.computed_type)) {
        types.set(detection.computed_type, {
          label: detection.computed_display_type || detection.computed_type,
          value: detection.computed_type,
        });
      }
    });

    return Array.from(types.values());
  });

  // Computed property for filtered and sorted detections
  const filteredDetections = computed(() => {
    // Start with all detections
    let result = [...detections.value];

    // Skip filtering if no detections
    if (result.length === 0) return [];

    console.log(`Filtering ${result.length} detections`);

    // Filter by verification status
    if (filterVerification.value !== 'all') {
      const verified = filterVerification.value === 'verified';
      result = result.filter((detection) => detection.annotated === verified);
    }

    // Filter by type
    if (filterType.value) {
      result = result.filter(
        (detection) => detection.computed_type === filterType.value,
      );
    }

    // Filter by confidence
    if (filterConfidence.value !== 'all') {
      const confidenceRanges = {
        low: [0, 0.5],
        medium: [0.5, 0.8],
        high: [0.8, 1.01], // Slightly above 1 to include exactly 1
      };

      const range =
        confidenceRanges[
          filterConfidence.value as keyof typeof confidenceRanges
        ];

      result = result.filter((detection) => {
        const confidence = detection.confidence ?? 0;
        return confidence >= range[0] && confidence < range[1];
      });
    }

    // Filter edited
    if (filterEdited.value) {
      result = result.filter((detection) => detection.edited);
    }

    // Sort the results
    switch (sortBy.value) {
      case 'confidence-asc':
        // Low confidence first (high priority)
        result.sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
        break;
      case 'confidence-desc':
        // High confidence first
        result.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
        break;
      case 'position':
        // Sort by position (x then y)
        result.sort((a, b) => {
          if (a.y !== b.y) return a.y - b.y;
          return a.x - b.x;
        });
        break;
      default:
        // Default order - no additional sorting
        break;
    }

    console.log(`Filtered to ${result.length} detections`);
    return result;
  });

  // Reset filters to defaults
  const resetFilters = () => {
    sortBy.value = 'default';
    filterVerification.value = 'all';
    filterType.value = '';
    filterConfidence.value = 'all';
    filterEdited.value = false;
  };

  // Watch for empty detections and reset filters
  watch(
    () => detections.value.length,
    (newLength) => {
      if (newLength === 0) {
        resetFilters();
      }
    },
  );

  return {
    // State
    sortBy,
    filterVerification,
    filterType,
    filterConfidence,
    filterEdited,

    // Computed
    uniqueTypes,
    filteredDetections,

    // Actions
    resetFilters,
  };
}
