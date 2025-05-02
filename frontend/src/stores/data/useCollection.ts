import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { CollectionHierarchical, MetaRole } from 'src/types/data-access';
import { getMetaRolesForCollection } from 'src/api/metaRoleApiService';
import { apiGetCollectionHierarchical } from 'src/api/collectionApiService';
import { DAResponse } from '../data-access/types';

export const useCollection = defineStore('collection', () => {
  const collection = ref<CollectionHierarchical>();
  const collectionMetaRoles = ref<MetaRole[]>([]);

  const loaded = ref(false);
  const error = ref('');
  const loading = ref(false);

  const route = useRoute();

  // computed properties

  // Helper functions
  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };
  const init = async () => {};

  const resetState = () => {
    collection.value = undefined;
    collectionMetaRoles.value = [];
    loaded.value = false;
    error.value = '';
    loading.value = false;
  };

  const loadCollection = async (collectionId: string) => {
    if (collection.value?.id !== collectionId) {
      resetState();
    }
    setLoading(true);
    error.value = '';

    const requestPromise = new Promise<DAResponse<CollectionHierarchical>>(
      async (resolve) => {
        try {
          const response = await apiGetCollectionHierarchical(collectionId);
          if (response.error) {
            error.value = response.error;
            console.error(response.error);
            resolve({ error: response.error });
          } else if (response.data) {
            collection.value = response.data;
            console.log('collection', collection.value);
            loaded.value = true;

            const metaRolesResponse =
              await getMetaRolesForCollection(collectionId);
            if (metaRolesResponse.data && metaRolesResponse.data.length > 0) {
              collectionMetaRoles.value = metaRolesResponse.data;
              console.log(
                `Loaded ${collectionMetaRoles.value.length} meta roles for collection ${collectionId}`,
              );
            } else if (metaRolesResponse.error) {
              console.error(
                `Failed to load meta roles for collection: ${metaRolesResponse.error}`,
              );
            }
            resolve({ data: response.data, error: undefined });
          } else {
            const errorMsg = 'No collection data received';
            error.value = errorMsg;
            console.error(errorMsg);
            resolve({ error: errorMsg });
          }
        } catch (e) {
          const errorMsg = 'Failed to load collection';
          error.value = errorMsg;
          console.error(e);
          resolve({ error: errorMsg });
        } finally {
          setLoading(false);
        }
      },
    );

    return requestPromise;
  };

  return {
    collection,
    collectionMetaRoles,
    loaded,
    error,
    loading,
    init,
    loadCollection,
  };
});
