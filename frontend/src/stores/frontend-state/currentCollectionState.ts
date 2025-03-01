import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useCollectionDataAccess } from 'stores/data-access';
import { CollectionDAtoState, CollectionState } from 'src/types';
import { ImageAddDto } from 'src/stores';
import { axios, axiosErrorHandler } from 'src/api';

export const useCurrentCollectionState = defineStore(
  'currentCollectionState',
  () => {
    // Store
    const collectionDA = useCollectionDataAccess();

    // State
    const collection = ref<CollectionState>();
    const loading = ref(false);
    const edited = ref(false);

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

    const loadCollection = async (collectionId: string) => {
      setLoading(true);
      await collectionDA.loadCollection(collectionId);
      if (collectionDA?.collection) {
        collection.value = CollectionDAtoState(collectionDA.collection);
        console.log(collection.value);
      } else {
      }
      setLoading(false);
    };

    const uploadImageToCollection = async (imageToAdd: ImageAddDto) => {
      console.log('uploadImageToCollection');
      setLoading(true);
      console.log(imageToAdd);
      try {
        const formData = new FormData();
        if (imageToAdd.file) {
          formData.append('file', imageToAdd.file);
        } else {
          return;
        }
        await axios.post(
          `image/upload/${imageToAdd.collection_id}/${imageToAdd.order}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );
        await loadCollection(imageToAdd.collection_id);
      } catch (error) {
        axiosErrorHandler(error);
      } finally {
        setLoading(false);
      }
    };

    return {
      collection,
      loading,
      edited,
      setLoading,
      init,
      loadCollection,
      uploadImageToCollection,
      imagesGetter,
    };
  },
);
