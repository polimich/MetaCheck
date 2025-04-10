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
    console.log('API: Fetching all collections');
    const { data } = await axios.get<Collection[]>('collection');
    return { data, error: '' };
  } catch (error) {
    // Show notification for this error since it's a critical operation
    const errorMessage = axiosErrorHandler(error, undefined, true);
    return { data: [], error: errorMessage };
  }
};

/**
 * Get a specific collection
 */
export const getCollection = async (
  collectionId: string,
): Promise<{ data: CollectionDA | null; error: string }> => {
  if (!collectionId) {
    console.error('No collection ID provided');
    return { data: null, error: 'No collection ID provided' };
  }

  // Validate UUID format
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      collectionId,
    )
  ) {
    console.error(`Invalid collection ID format: ${collectionId}`);
    return { data: null, error: 'Invalid collection ID format' };
  }

  try {
    console.log(`API: Fetching collection ${collectionId}`);
    const { data } = await axios.get<CollectionDA>(
      `/collection/${collectionId}`,
    );
    console.log(`API: Successfully fetched collection ${collectionId}`);
    return { data, error: '' };
  } catch (e) {
    // Show notification for this error since it's a critical operation
    const errorMessage = axiosErrorHandler(e, undefined, true);
    return { data: null, error: errorMessage };
  }
};

/**
 * Create a new collection
 */
export const addCollection = async (
  collection: CollectionAddDto,
): Promise<string> => {
  try {
    const { data } = await axios.post<{ id: string }>(
      '/collection',
      collection,
    );
    console.log(`API: Created collection with ID ${data.id}`);
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
export const deleteCollection = async (
  collectionId: string,
): Promise<string> => {
  try {
    await axios.delete(`/collection/${collectionId}`);
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
