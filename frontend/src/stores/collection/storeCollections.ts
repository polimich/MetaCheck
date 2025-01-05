import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { axios, axiosErrorHandler } from 'src/api/index';
import { Collection, CollectionAddDto } from './types';
import { Image, ImageAddDto } from 'src/stores';

export const useCollectionStore = defineStore('collections', () => {
  // State
  const collections = ref<Collection[]>([]);
  const images = ref<Image[]>([]);
  const loading = ref(false);

  // Computed property to transform collections for table view
  const getCollectionTableView = computed(() =>
    collections.value.map(({ description, info, name }) => ({
      actions: 'actions', // Placeholder for actions, can be modified later
      description,
      info,
      name,
    })),
  );

  // Helper function to handle loading state
  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };

  // API Calls
  // Collection
  const init = () => {
    return;
  };

  const loadCollections = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('collection');
      collections.value = data;
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  const addCollection = async (collection: CollectionAddDto) => {
    setLoading(true);
    try {
      await axios.post('collection', collection);
      await loadCollections(); // Reload collections after adding
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  const editCollection = async (collection: Collection) => {
    setLoading(true);
    try {
      console.log('Editing collection', collection);
      await axios.put(`collection/${collection.id}`, collection);
      await loadCollections(); // Reload collections after editing
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCollection = async (id: string) => {
    setLoading(true);
    try {
      await axios.delete(`collection/${id}`);
      await loadCollections(); // Reload collections after deletion
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  const getCollectionImages = async (collectionId: string) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/collection/${collectionId}/images`);
      images.value = data; // Directly assign data to images
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  //Images

  const loadImagesInCollection = async (collectionId: string) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`collection/${collectionId}/images`);
      images.value = data;
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImageToCollection = async (imageToAdd: ImageAddDto) => {
    setLoading(true);
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
      await loadImagesInCollection(imageToAdd.collection_id);
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  const importCollection = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post('collection/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await loadCollections();
    } catch (error) {
      axiosErrorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  return {
    collections,
    images,
    loading,
    getCollectionTableView,
    init,
    loadCollections,
    loadImagesInCollection,
    addCollection,
    editCollection,
    deleteCollection,
    getCollectionImages,
    uploadImageToCollection,
    importCollection,
  };
});
