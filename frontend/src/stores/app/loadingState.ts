import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// Types for our loading state
interface LoadingState {
  isLoading: boolean;
  message: string;
  source: string;
  timestamp: number;
}

export const useLoadingState = defineStore('loadingState', () => {
  // State
  const loadingStates = ref<Record<string, LoadingState>>({});
  const loadingHistory = ref<LoadingState[]>([]);
  const maxHistorySize = 50;

  // Getters
  const isLoading = computed(() => {
    return Object.values(loadingStates.value).some((state) => state.isLoading);
  });

  const currentLoadingMessage = computed(() => {
    // Get the most recent loading message
    const loadingItems = Object.values(loadingStates.value)
      .filter((state) => state.isLoading)
      .sort((a, b) => b.timestamp - a.timestamp);

    return loadingItems.length > 0 ? loadingItems[0].message : '';
  });

  const loadingSources = computed(() => {
    return Object.values(loadingStates.value)
      .filter((state) => state.isLoading)
      .map((state) => state.source);
  });

  // Actions
  const startLoading = (source: string, message = 'Loading...') => {
    console.log(`Loading started: ${source} - ${message}`);

    const loadingEvent: LoadingState = {
      isLoading: true,
      message,
      source,
      timestamp: Date.now(),
    };

    // Update the state
    loadingStates.value = {
      ...loadingStates.value,
      [source]: loadingEvent,
    };

    // Add to history
    addToHistory(loadingEvent);

    return loadingEvent;
  };

  const stopLoading = (source: string) => {
    if (!loadingStates.value[source]) {
      console.warn(
        `Attempted to stop loading for ${source}, but it wasn't loading`,
      );
      return;
    }

    console.log(`Loading stopped: ${source}`);

    const loadingEvent: LoadingState = {
      ...loadingStates.value[source],
      isLoading: false,
      timestamp: Date.now(),
    };

    // Update the state
    loadingStates.value = {
      ...loadingStates.value,
      [source]: loadingEvent,
    };

    // Add to history
    addToHistory(loadingEvent);

    return loadingEvent;
  };

  const resetLoading = () => {
    console.log('Resetting all loading states');
    loadingStates.value = {};
  };

  // Helper to add to history and maintain max size
  const addToHistory = (state: LoadingState) => {
    loadingHistory.value.unshift(state);

    // Trim history if needed
    if (loadingHistory.value.length > maxHistorySize) {
      loadingHistory.value = loadingHistory.value.slice(0, maxHistorySize);
    }
  };

  // Check if a particular source is loading
  const isSourceLoading = (source: string) => {
    return loadingStates.value[source]?.isLoading || false;
  };

  return {
    // State
    loadingStates,
    loadingHistory,

    // Getters
    isLoading,
    currentLoadingMessage,
    loadingSources,

    // Actions
    startLoading,
    stopLoading,
    resetLoading,
    isSourceLoading,
  };
});
