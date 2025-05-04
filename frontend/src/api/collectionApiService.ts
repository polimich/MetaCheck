import { axios, axiosErrorHandler } from './index';
import {
  CollectionType,
  CollectionNewType,
  CollectionUpdateDA,
  ImageDA,
} from 'src/types/data-access';
import {
  CollectionListSchema,
  CollectionSchema,
  CollectionNewSchema,
  CollectionUpdateSchema,
  ImageSchema,
} from 'src/types/validation';
import { z } from 'zod';
import { normalizeBbox } from 'src/utils/bboxUtils';

/**
 * Handle Zod validation errors
 */
const handleZodError = (error: unknown, entityName: string): string => {
  if (error instanceof z.ZodError) {
    console.error(`Invalid ${entityName} data received:`, error.errors);
    return `Invalid ${entityName} data received from server`;
  }
  return '';
};

/**
 * Normalize bounding box formats in collection data
 */
const normalizeBboxInCollection = (
  collection: Partial<CollectionType>,
): Partial<CollectionType> => {
  if (!collection || !collection.images) return collection;

  // Deep clone to avoid mutating the original
  const normalizedCollection = JSON.parse(JSON.stringify(collection));

  // Normalize all detection bboxes
  for (const image of normalizedCollection.images) {
    if (image.detections) {
      for (const detection of image.detections) {
        // Empty, null, or undefined bboxes are valid for page number detections
        // normalizeBbox handles these cases and returns null
        detection.bbox = normalizeBbox(detection.bbox);
      }
    }
  }

  return normalizedCollection;
};

/**
 * Get all collections
 */
export const getCollections = async (): Promise<{
  data: CollectionType[];
  error: string;
}> => {
  try {
    console.log('API: Fetching all collections');
    const { data } = await axios.get<CollectionType[]>('collection');
    console.log('API: Collections:', data);

    // Validate the response data
    try {
      const validatedData = CollectionListSchema.parse(data);
      return { data: validatedData as unknown as CollectionType[], error: '' };
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'collections');
      console.error('Validation error:', validationError);
      return { data: [], error: errorMessage || 'Data validation failed' };
    }
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
): Promise<{ data: CollectionType | null; error: string }> => {
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
    const { data } = await axios.get<CollectionType>(
      `/collection/${collectionId}`,
    );

    // Normalize bbox formats before validation
    const normalizedData = normalizeBboxInCollection(data);
    console.log('normalizedData', normalizedData);
    // Validate the response data
    try {
      const validatedData = CollectionSchema.parse(normalizedData);
      console.log(`API: Successfully fetched collection ${collectionId}`);
      return { data: validatedData as unknown as CollectionType, error: '' };
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'collection');
      console.error('Validation error:', validationError);
      return { data: null, error: errorMessage || 'Data validation failed' };
    }
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
  collection: CollectionNewType,
): Promise<string> => {
  try {
    // Validate the request data
    try {
      CollectionNewSchema.parse(collection);
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'collection');
      return errorMessage || 'Invalid collection data';
    }

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
  collection: CollectionUpdateDA,
): Promise<string> => {
  try {
    // Validate the request data
    try {
      CollectionUpdateSchema.parse(collection);
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'collection update');
      return errorMessage || 'Invalid collection update data';
    }

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
): Promise<{ data: ImageDA[]; error: string }> => {
  try {
    const { data } = await axios.get<ImageDA[]>(
      `/collection/${collectionId}/images`,
    );

    // Validate the response data
    try {
      const validatedData = z.array(ImageSchema).parse(data);
      return { data: validatedData as unknown as ImageDA[], error: '' };
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'images');
      console.error('Validation error:', validationError);
      return { data: [], error: errorMessage || 'Data validation failed' };
    }
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
