// @author Michael Polívka (xpoliv07)
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useLoadingState } from './loadingState';

// Constants
const STORAGE_KEY_PREFIX = 'metacheck-';
const COLLECTION_KEY = `${STORAGE_KEY_PREFIX}collection`;
const IMAGE_KEY = `${STORAGE_KEY_PREFIX}image`;

// Interface for stored state
interface StoredState {
  lastCollectionId: string | null;
  lastImageId: string | null;
  timestamp: number;
}

export const useStateManager = defineStore('stateManager', () => {
  // Dependencies
  const loadingState = useLoadingState();

  // State
  const lastCollectionId = ref<string | null>(null);
  const lastImageId = ref<string | null>(null);
  const stateValid = ref(true);
  const stateError = ref('');

  // Initialize from localStorage
  const init = (): StoredState => {
    console.log('Initializing state manager');
    try {
      const storedState = localStorage.getItem(COLLECTION_KEY);

      if (storedState) {
        const parsedState = JSON.parse(storedState) as StoredState;

        // Validate the stored state
        if (validateIds(parsedState)) {
          lastCollectionId.value = parsedState.lastCollectionId;
          lastImageId.value = parsedState.lastImageId;
          console.log(
            `Restored state: collection=${lastCollectionId.value}, image=${lastImageId.value}`,
          );
          stateValid.value = true;
        } else {
          console.warn('Invalid stored state, clearing');
          clearState();
        }
      } else {
        console.log('No stored state found');
      }
    } catch (error) {
      console.error('Error initializing state manager:', error);
      stateError.value = 'Failed to restore state';
      clearState();
    }

    return {
      lastCollectionId: lastCollectionId.value,
      lastImageId: lastImageId.value,
      timestamp: Date.now(),
    };
  };

  // Validate IDs
  const validateIds = (state: Partial<StoredState>): boolean => {
    if (!state) return false;

    // Validate collection ID (if present)
    if (
      state.lastCollectionId !== null &&
      state.lastCollectionId !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        state.lastCollectionId,
      )
    ) {
      console.error(`Invalid collection ID format: ${state.lastCollectionId}`);
      return false;
    }

    // Validate image ID (if present)
    if (
      state.lastImageId !== null &&
      state.lastImageId !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        state.lastImageId,
      )
    ) {
      console.error(`Invalid image ID format: ${state.lastImageId}`);
      return false;
    }

    // Check if image ID belongs to collection (if both present)
    if (state.lastCollectionId && state.lastImageId) {
      // Optionally check if IDs match expected relationship
      // In this case, we could check if image ID is from this collection
      // but we'll leave that to the collection/image stores
    }

    return true;
  };

  // Update state and persist
  const updateState = (
    collectionId?: string | null,
    imageId?: string | null,
  ) => {
    // Only update if values have changed
    let changed = false;

    if (collectionId !== undefined && collectionId !== lastCollectionId.value) {
      lastCollectionId.value = collectionId;
      changed = true;
    }

    if (imageId !== undefined && imageId !== lastImageId.value) {
      lastImageId.value = imageId;
      changed = true;
    }

    if (changed) {
      persistState();
    }
  };

  // Persist state to localStorage
  const persistState = () => {
    try {
      if (
        !validateIds({
          lastCollectionId: lastCollectionId.value,
          lastImageId: lastImageId.value,
        })
      ) {
        console.error('Invalid IDs, not persisting state');
        return;
      }

      const stateToSave: StoredState = {
        lastCollectionId: lastCollectionId.value,
        lastImageId: lastImageId.value,
        timestamp: Date.now(),
      };

      localStorage.setItem(COLLECTION_KEY, JSON.stringify(stateToSave));
      console.log('Persisted application state');
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  };

  // Clear all state
  const clearState = () => {
    lastCollectionId.value = null;
    lastImageId.value = null;
    stateValid.value = true;
    stateError.value = '';

    try {
      localStorage.removeItem(COLLECTION_KEY);
      localStorage.removeItem(IMAGE_KEY);
      console.log('Cleared persisted state');
    } catch (error) {
      console.error('Error clearing persisted state:', error);
    }
  };

  // Clear state on errors
  const handleError = (error: unknown, message = 'An error occurred') => {
    console.error(message, error);
    stateError.value = message;
    stateValid.value = false;

    // Show error using loadingState
    loadingState.startLoading('error', `Error: ${message}`);
    setTimeout(() => loadingState.stopLoading('error'), 3000);

    // Optionally clear state if it's a critical error
    // clearState();
  };

  return {
    // State
    lastCollectionId,
    lastImageId,
    stateValid,
    stateError,

    // Actions
    init,
    updateState,
    clearState,
    handleError,
    validateIds,
  };
});
