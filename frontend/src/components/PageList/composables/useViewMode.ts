import { computed, ref, watch } from 'vue';

type ViewMode = 'list-small' | 'list-large' | 'grid';

export function useViewMode(
  initialViewMode: ViewMode | undefined,
  updateViewMode: (mode: string) => void,
) {
  // Use a local ref to track the current view mode internally
  const viewModeRef = ref(initialViewMode || 'list-large');

  // Watch for external prop changes
  watch(
    () => initialViewMode,
    (newValue) => {
      if (newValue && newValue !== viewModeRef.value) {
        viewModeRef.value = newValue;
      }
    },
  );

  // View mode options
  const viewModeOptions = [
    { value: 'list-small', icon: 'view_list', label: 'Compact' },
    { value: 'list-large', icon: 'view_headline', label: 'Details' },
    { value: 'grid', icon: 'grid_view', label: 'Grid' },
  ];

  // Current view mode with two-way binding
  const currentViewMode = computed({
    get: () => viewModeRef.value,
    set: (value: string) => {
      viewModeRef.value = value as ViewMode;
      updateViewMode(value);
    },
  });

  // Check if grid view is active - now depends on viewModeRef for better reactivity
  const isGridView = computed(() => viewModeRef.value === 'grid');

  return {
    viewModeOptions,
    currentViewMode,
    isGridView,
  };
}
