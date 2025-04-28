import { computed, ref, watch } from 'vue';

export function useGridColumns(
  initialColumns: number | undefined,
  updateColumns: (columns: number) => void,
) {
  // Create a local ref to track changes
  const columnsRef = ref(initialColumns || 4);

  // Watch for external changes
  watch(
    () => initialColumns,
    (newColumns) => {
      if (newColumns && newColumns !== columnsRef.value) {
        columnsRef.value = newColumns;
      }
    },
  );

  // Available column options
  const gridColumnOptions = [2, 3, 4, 6, 8, 10];

  // Current grid columns with two-way binding
  const currentGridColumns = computed({
    get: () => columnsRef.value,
    set: (value: number) => {
      columnsRef.value = value;
      updateColumns(value);
    },
  });

  return {
    gridColumnOptions,
    currentGridColumns,
  };
}
