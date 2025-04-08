import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useCollectionDataAccess } from 'stores/data-access';
import { CollectionDAtoState, CollectionState } from 'src/types';
import { ImageAddDto } from 'src/stores';
import { uploadImage } from 'src/api/services';

export const useCurrentCollectionState = defineStore(
  'currentCollectionState',
  () => {
    // Store
    const collectionDA = useCollectionDataAccess();

    // State
    const collection = ref<CollectionState>();
    const loading = ref(false);
    const edited = ref(false);
    const loaded = ref(false);
    const error = ref('');

    //
    const imagesGetter = computed(() => {
      if (collection?.value?.images) {
        return collection.value.images;
      } else {
        console.error('Images not found');
        return [];
      }
    });

    const setLoading = (isLoading: boolean) => {
      loading.value = isLoading;
    };

    // API Calls

    const init = () => {
      return;
    };

    const resetState = () => {
      collection.value = undefined;
      loaded.value = false;
      edited.value = false;
      error.value = '';
    };

    const loadCollection = async (collectionId: string) => {
      setLoading(true);
      // Reset the current state to ensure we don't show stale data
      resetState();

      try {
        // Always load fresh data from the API, don't rely on cached data
        await collectionDA.loadCollection(collectionId);

        if (collectionDA.collection) {
          collection.value = CollectionDAtoState(collectionDA.collection);
          loaded.value = true;
          console.log('loaded collection', collection.value.id);
        } else {
          error.value = collectionDA.error || 'Failed to load collection';
          console.error('Failed to load collection:', error.value);
        }
      } catch (e) {
        error.value = 'Error loading collection';
        console.error('Error in loadCollection:', e);
      } finally {
        setLoading(false);
      }
    };

    const uploadImageToCollection = async (imageToAdd: ImageAddDto) => {
      console.log('uploadImageToCollection');
      setLoading(true);
      console.log(imageToAdd);
      try {
        await uploadImage(imageToAdd);
        await loadCollection(imageToAdd.collection_id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const getImageById = (imageId: string) => {
      setLoading(true);
      if (collection.value && collection.value.images) {
        const image = collection.value.images.find((i) => i.id === imageId);
        if (image) {
          setLoading(false);

          return image;
        } else {
          setLoading(false);

          console.error('Image not found');
          return null;
        }
      } else {
        setLoading(false);
        console.error('Collection not loaded');
        return null;
      }
    };

    const reloadCollection = async () => {
      if (collection.value) {
        await loadCollection(collection.value.id);
      } else {
        console.error('No collection loaded to reload');
      }
    };

    return {
      collection,
      loading,
      edited,
      loaded,
      error,
      setLoading,
      init,
      loadCollection,
      uploadImageToCollection,
      getImageById,
      imagesGetter,
      reloadCollection,
      resetState,
    };
  },
);
