import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Collection, CollectionAddDto } from './types';
import { Image, ImageAddDto } from 'src/stores';
import { useCollectionDataAccess } from 'stores/data-access';
import {
  getCollections,
  addCollection as apiAddCollection,
  editCollection as apiEditCollection,
  deleteCollection as apiDeleteCollection,
  getCollectionImages,
  uploadImage,
  importCollection as apiImportCollection,
} from 'src/api/services';

export const useCollectionStore = defineStore('collections', () => {
  const collectionDA = useCollectionDataAccess();

  // State
  const collections = ref<Collection[]>([]);
  const images = ref<Image[]>([]);
  const loading = ref(false);
  const error = ref('');

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
    error.value = '';
    try {
      const response = await getCollections();
      if (response.error) {
        error.value = response.error;
        console.error(response.error);
      } else {
        collections.value = response.data;
      }
    } catch (e) {
      error.value = 'Failed to load collections';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addCollection = async (collection: CollectionAddDto) => {
    setLoading(true);
    error.value = '';
    try {
      const errorMsg = await apiAddCollection(collection);
      if (errorMsg) {
        error.value = errorMsg;
        console.error(errorMsg);
      } else {
        await loadCollections(); // Reload collections after adding
      }
    } catch (e) {
      error.value = 'Failed to add collection';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const editCollection = async (collection: Collection) => {
    setLoading(true);
    error.value = '';
    try {
      const errorMsg = await apiEditCollection(collection);
      if (errorMsg) {
        error.value = errorMsg;
        console.error(errorMsg);
      } else {
        await loadCollections(); // Reload collections after editing
      }
    } catch (e) {
      error.value = 'Failed to edit collection';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteCollection = async (id: string) => {
    setLoading(true);
    error.value = '';
    try {
      const errorMsg = await apiDeleteCollection(id);
      if (errorMsg) {
        error.value = errorMsg;
        console.error(errorMsg);
      } else {
        await loadCollections(); // Reload collections after deletion
      }
    } catch (e) {
      error.value = 'Failed to delete collection';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionImages = async (collectionId: string) => {
    setLoading(true);
    error.value = '';
    try {
      const response = await getCollectionImages(collectionId);
      if (response.error) {
        error.value = response.error;
        console.error(response.error);
      } else {
        images.value = response.data;
      }
    } catch (e) {
      error.value = 'Failed to load collection images';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  //Images

  const loadImagesInCollection = async (collectionId: string) => {
    setLoading(true);
    error.value = '';
    try {
      await collectionDA.loadCollection(collectionId);
      if (collectionDA?.collection?.images) {
        images.value = collectionDA.collection.images as Image[];
      } else {
        error.value = 'No images found in collection';
      }
    } catch (e) {
      error.value = 'Failed to load images from collection';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const uploadImageToCollectionStore = async (imageToAdd: ImageAddDto) => {
    setLoading(true);
    error.value = '';
    try {
      const errorMsg = await uploadImage(imageToAdd);
      if (errorMsg) {
        error.value = errorMsg;
        console.error(errorMsg);
      } else {
        await loadImagesInCollection(imageToAdd.collection_id);
      }
    } catch (e) {
      error.value = 'Failed to upload image to collection';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const importCollection = async (file: File) => {
    setLoading(true);
    error.value = '';
    try {
      const errorMsg = await apiImportCollection(file);
      if (errorMsg) {
        error.value = errorMsg;
        console.error(errorMsg);
      } else {
        await loadCollections();
      }
    } catch (e) {
      error.value = 'Failed to import collection';
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return {
    collections,
    images,
    loading,
    error,
    getCollectionTableView,
    init,
    loadCollections,
    loadImagesInCollection,
    addCollection,
    editCollection,
    deleteCollection,
    loadCollectionImages,
    uploadImageToCollection: uploadImageToCollectionStore,
    importCollection,
  };
});
