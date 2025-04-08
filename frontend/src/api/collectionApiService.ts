import { axios, axiosErrorHandler } from './index';
import { Collection, CollectionAddDto } from 'src/stores/collection/types';
import { Image } from 'src/stores';
import { CollectionDA } from 'src/types';

/**
 * Get all collections
 */
export const getCollections = async (): Promise<{
  data: Collection[];
  error: string;
}> => {
  try {
    const { data } = await axios.get<Collection[]>('collection');
    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { data: [], error: errorMessage };
  }
};

/**
 * Get a specific collection
 */
export const getCollection = async (
  collectionId: string,
): Promise<{ data: CollectionDA | null; error: string }> => {
  try {
    const { data } = await axios.get<CollectionDA>(
      `/collection/${collectionId}`,
    );
    return { data, error: '' };
  } catch (e) {
    const errorMessage = axiosErrorHandler(e);
    return { data: null, error: errorMessage };
  }
};

/**
 * Add a new collection
 * @returns Error message if there's an error, empty string if successful
 */
export const addCollection = async (
  collection: CollectionAddDto,
): Promise<string> => {
  try {
    await axios.post('collection', collection);
    return '';
  } catch (error) {
    return axiosErrorHandler(error);
  }
};

/**
 * Edit an existing collection
 * @returns Error message if there's an error, empty string if successful
 */
export const editCollection = async (
  collection: Collection,
): Promise<string> => {
  try {
    await axios.put(`collection/${collection.id}`, collection);
    return '';
  } catch (error) {
    return axiosErrorHandler(error);
  }
};

/**
 * Delete a collection
 * @returns Error message if there's an error, empty string if successful
 */
export const deleteCollection = async (id: string): Promise<string> => {
  try {
    await axios.delete(`collection/${id}`);
    return '';
  } catch (error) {
    return axiosErrorHandler(error);
  }
};

/**
 * Get images for a collection
 */
export const getCollectionImages = async (
  collectionId: string,
): Promise<{ data: Image[]; error: string }> => {
  try {
    const { data } = await axios.get<Image[]>(
      `/collection/${collectionId}/images`,
    );
    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { data: [], error: errorMessage };
  }
};

/**
 * Import a collection from a YOLO format file
 * @returns Error message if there's an error, empty string if successful
 */
export const importCollection = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    await axios.post('collection/import_yolo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return '';
  } catch (error) {
    return axiosErrorHandler(error);
  }
};
