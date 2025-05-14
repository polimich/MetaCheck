/**
 * @author Michael Polívka (xpoliv07)
 */
import { createApiService } from './apiFactory';
import { axios, axiosErrorHandler } from './index';
import {
  CollectionType,
  CollectionNewType,
  CollectionUpdateDA,
  CollectionHierarchical,
} from 'src/types/data-access';

// Standard CRUD operations
const crudCollectionApi = createApiService<
  CollectionType,
  CollectionNewType,
  CollectionUpdateDA
>({
  basePath: '/collection',
  entityName: 'collection',
});

export const collectionApi = {
  ...crudCollectionApi,

  // Import a collection from YOLO format
  importFromYolo: async (
    file: File,
  ): Promise<{ success: boolean; error: string }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.post('/collection/import_yolo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return { success: true, error: '' };
    } catch (error) {
      return { success: false, error: axiosErrorHandler(error) };
    }
  },

  // Get hierarchical tree for a collection
  getHierarchicalTree: async (
    collectionId: string,
  ): Promise<{ data: CollectionHierarchical | null; error: string }> => {
    try {
      const { data } = await axios.get<CollectionHierarchical>(
        `/collection/${collectionId}/hierarchical`,
      );
      return { data, error: '' };
    } catch (error) {
      return { data: null, error: axiosErrorHandler(error) };
    }
  },

  // Get collection images
  getImages: async (
    collectionId: string,
  ): Promise<{ data: unknown[]; error: string }> => {
    try {
      const { data } = await axios.get<unknown[]>(
        `/collection/${collectionId}/images`,
      );
      return { data, error: '' };
    } catch (error) {
      return { data: [], error: axiosErrorHandler(error) };
    }
  },
};
