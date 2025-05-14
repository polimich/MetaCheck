// @author Michael Polívka (xpoliv07)
import { computed } from 'vue';

/**
 * Composable for search functionality with two-way binding
 */
export function useSearch(
  initialQuery: string,
  updateQuery: (query: string) => void,
) {
  // Current search query with two-way binding
  const searchQuery = computed({
    get: () => initialQuery,
    set: (value: string) => updateQuery(value),
  });

  // Clear search query
  const clearSearch = () => updateQuery('');

  return {
    searchQuery,
    clearSearch,
  };
}
