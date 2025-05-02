import { defineStore } from 'pinia';
import { DAResponse } from '../data-access/types';
import { computed, ref } from 'vue';
import {
  getCollections as apiGetCollections,
  addCollection as apiAddCollection,
  importCollection as apiImportCollection,
} from 'src/api/services';
import { CollectionListType, CollectionNewType, CollectionType } from './types';
export const useCollections = defineStore('collections', () => {
  const collections = ref<CollectionType[]>([]);
  const loading = ref(false);

  const collectionsGetter = computed(() => {
    return collections.value satisfies CollectionListType[];
  });

  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };

  const init = async () => {};

  const loadCollections = async (): Promise<DAResponse<CollectionType[]>> => {
    setLoading(true);
    const requestPromise = new Promise<DAResponse<CollectionType[]>>(
      async (resolve) => {
        try {
          const response = await apiGetCollections();
          if (response.error) {
            resolve({ error: response.error });
          } else {
            collections.value = response.data;
            resolve({ data: response.data });
          }
        } catch (error) {
          resolve({ error: error as string });
        } finally {
          setLoading(false);
        }
      },
    );
    console.log('loadCollections', requestPromise);
    return requestPromise;
  };

  const addCollection = async (
    collection: CollectionNewType,
  ): Promise<DAResponse> => {
    setLoading(true);
    try {
      const errorMsg = await apiAddCollection(collection);
      if (errorMsg) {
        return { error: errorMsg };
      } else {
        await loadCollections();
        return { error: undefined, success: true };
      }
    } catch (e) {
      const errorMsg = 'Failed to add collection';
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const importCollection = async (file: File): Promise<DAResponse> => {
    setLoading(true);
    try {
      const errorMsg = await apiImportCollection(file);
      if (errorMsg) {
        return { error: errorMsg };
      } else {
        await loadCollections();
        return { error: undefined, success: true };
      }
    } catch (e) {
      const errorMsg = 'Failed to import collection';
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };
  return {
    collectionsGetter,
    loadCollections,
    addCollection,
    importCollection,
    loading,
    init,
  };
});
