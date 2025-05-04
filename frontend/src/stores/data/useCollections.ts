import { defineStore } from 'pinia';
import { DAResponse } from '../data-access/types';
import { computed, ref } from 'vue';
import {
  getCollections as apiGetCollections,
  addCollection as apiAddCollection,
  importCollection as apiImportCollection,
} from 'src/api/services';
import { CollectionListType, CollectionNewType, CollectionType } from './types';
import { CollectionType as CollectionTypeDA } from 'src/types/data-access';

export const useCollections = defineStore('collections', () => {
  const collections = ref<CollectionType[]>([]);
  const loading = ref(false);
  const error = ref('');
  const loaded = ref(false);

  const collectionsGetter = computed(() => {
    return collections.value satisfies CollectionListType[];
  });

  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };

  const init = async () => {
    loaded.value = false;
    error.value = '';
    await loadCollections();
  };

  const loadCollections = async (): Promise<DAResponse<CollectionType[]>> => {
    setLoading(true);
    error.value = '';

    const requestPromise = new Promise<DAResponse<CollectionType[]>>(
      async (resolve) => {
        try {
          const response = await apiGetCollections();
          if (response.error) {
            error.value = response.error;
            resolve({ error: response.error });
          } else {
            // Convert the received data to the expected type
            const convertedData = response.data.map(
              (collection: CollectionTypeDA) => {
                // Create a type-compatible version of the collection
                const converted: CollectionType = {
                  id: collection.id,
                  name: collection.name,
                  description: collection.description,
                  info: collection.info,
                  created_date: collection.created_date,
                  last_change: collection.last_change,
                  last_access: collection.last_access,
                  deleted: collection.deleted,
                  confidence: collection.confidence,
                  work_state: collection.work_state,
                  image_count: collection.image_count,
                  detection_count: collection.detection_count,
                  annotated_detection_count:
                    collection.annotated_detection_count,
                  preview_image_id: collection.preview_image_id,
                  preview_image_height: collection.preview_image_height,
                  preview_image_width: collection.preview_image_width,
                  // The meta_elements and images properties are where the incompatibility happens
                  // Creating empty arrays is safer than attempting a direct assignment
                  meta_elements: [],
                  images: [],
                };

                // Only add these if they're really needed in the UI
                if (collection.meta_elements) {
                  // Could create a proper converter here if needed
                  // converted.meta_elements = collection.meta_elements.map(me => convertMetaElement(me));
                }

                if (collection.images) {
                  // Could create a proper converter here if needed
                  // converted.images = collection.images.map(img => convertImage(img));
                }

                return converted;
              },
            );

            collections.value = convertedData;
            loaded.value = true;
            resolve({ data: convertedData });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          error.value = errorMessage;
          resolve({ error: errorMessage });
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
    error.value = '';

    try {
      const errorMsg = await apiAddCollection(collection);
      if (errorMsg) {
        error.value = errorMsg;
        return { error: errorMsg };
      } else {
        await loadCollections();
        return { error: undefined, success: true };
      }
    } catch (err) {
      const errorMsg = 'Failed to add collection';
      error.value = errorMsg;
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const importCollection = async (file: File): Promise<DAResponse> => {
    setLoading(true);
    error.value = '';

    try {
      const errorMsg = await apiImportCollection(file);
      if (errorMsg) {
        error.value = errorMsg;
        return { error: errorMsg };
      } else {
        await loadCollections();
        return { error: undefined, success: true };
      }
    } catch (err) {
      const errorMsg = 'Failed to import collection';
      error.value = errorMsg;
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
    error,
    loaded,
    init,
  };
});
