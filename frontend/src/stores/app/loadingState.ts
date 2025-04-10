import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useLoadingState = defineStore('loadingState', () => {
  // Store all active loading operations by ID
  const loadingOperations = ref<Record<string, { message: string }>>({});

  // Store component-specific loading states
  const componentLoadingStates = ref<Record<string, boolean>>({});

  // Track current operation (most recent operation started)
  const currentOperation = ref<string>('');

  // Computed property to check if ANY loading operation is active
  const isLoading = computed(
    () => Object.keys(loadingOperations.value).length > 0,
  );

  // Get the message of the most recent loading operation
  const currentLoadingMessage = computed(() => {
    const operations = Object.values(loadingOperations.value);
    return operations.length > 0
      ? operations[operations.length - 1].message
      : '';
  });

  // Check if a specific component is loading
  const isComponentLoading = (componentId: string): boolean => {
    return componentLoadingStates.value[componentId] || false;
  };

  // Check if a particular source is loading (backward compatibility method)
  const isSourceLoading = (source: string): boolean => {
    return !!loadingOperations.value[source];
  };

  // Start a global loading operation
  const startLoading = (id: string, message: string): void => {
    loadingOperations.value[id] = { message };
    currentOperation.value = id;
  };

  // Stop a global loading operation
  const stopLoading = (id: string): void => {
    delete loadingOperations.value[id];
    // Update current operation to the most recent one or empty if none left
    const operations = Object.keys(loadingOperations.value);
    currentOperation.value =
      operations.length > 0 ? operations[operations.length - 1] : '';
  };

  // Set loading state for a specific component
  const setComponentLoading = (
    componentId: string,
    isLoading: boolean,
  ): void => {
    componentLoadingStates.value[componentId] = isLoading;
  };

  return {
    loadingOperations,
    componentLoadingStates,
    currentOperation,
    isLoading,
    currentLoadingMessage,
    isComponentLoading,
    isSourceLoading,
    startLoading,
    stopLoading,
    setComponentLoading,
  };
});
