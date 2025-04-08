import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CollectionDA } from 'src/types';
import { getCollection } from 'src/api/services';

export const useCollectionDataAccess = defineStore(
  'collectionDataAccessStore',
  () => {
    const collection = ref<CollectionDA>();
    const loading = ref(false);
    const loaded = ref(false);
    const error = ref('');
    const currentCollectionId = ref('');

    const setLoading = (isLoading: boolean) => {
      loading.value = isLoading;
    };

    const resetState = () => {
      collection.value = undefined;
      loaded.value = false;
      error.value = '';
    };

    const init = () => {
      return;
    };

    const loadCollection = async (collectionId: string) => {
      // If we're loading a different collection, reset the state
      if (currentCollectionId.value !== collectionId) {
        resetState();
        currentCollectionId.value = collectionId;
      }

      setLoading(true);
      error.value = '';

      try {
        const response = await getCollection(collectionId);
        if (response.error) {
          error.value = response.error;
          console.error(response.error);
        } else if (response.data) {
          collection.value = response.data;
          loaded.value = true;
        } else {
          error.value = 'No collection data received';
          console.error('No collection data received');
        }
      } catch (e) {
        error.value = 'Failed to load collection';
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    return {
      collection,
      loading,
      loaded,
      error,
      currentCollectionId,
      setLoading,
      init,
      loadCollection,
      resetState,
    };
  },
);
