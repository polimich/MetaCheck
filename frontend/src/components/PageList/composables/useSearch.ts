import { computed } from 'vue';

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
