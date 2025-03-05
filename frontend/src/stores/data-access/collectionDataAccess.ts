import { defineStore } from 'pinia';
import { ref } from 'vue';
import { axios, axiosErrorHandler } from 'src/api';
import { CollectionDA } from 'src/types';

export const useCollectionDataAccess = defineStore(
  'collectionDataAccessStore',
  () => {
    const collection = ref<CollectionDA>();

    const loading = ref(false);
    const loaded = ref(false);

    const setLoading = (isLoading: boolean) => {
      loading.value = isLoading;
    };

    const init = () => {
      return;
    };

    const loadCollection = async (collectionId: string) => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/collection/eager/${collectionId}`);
        collection.value = data;
        loaded.value = true;
      } catch (e) {
        axiosErrorHandler(e);
      } finally {
        setLoading(false);
      }
    };

    return {
      collection,
      loading,
      loaded,
      setLoading,
      init,
      loadCollection,
    };
  },
);
