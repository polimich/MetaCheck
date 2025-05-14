/**
 * @author Michael Polívka (xpoliv07)
 */
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
    const { data } = await axios.get<CollectionType[]>('collection');

    // Validate the response data
    try {
      const validatedData = CollectionListSchema.parse(data);
      return { data: validatedData as unknown as CollectionType[], error: '' };
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'collections');
      return { data: [], error: errorMessage || 'Data validation failed' };
    }
  } catch (error) {
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
    return { data: null, error: 'No collection ID provided' };
  }

  // Validate UUID format
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      collectionId,
    )
  ) {
    return { data: null, error: 'Invalid collection ID format' };
  }

  try {
    const { data } = await axios.get<CollectionType>(
      `/collection/${collectionId}`,
    );

    // Normalize bbox formats before validation
    const normalizedData = normalizeBboxInCollection(data);

    // Validate the response data
    try {
      const validatedData = CollectionSchema.parse(normalizedData);
      return { data: validatedData as unknown as CollectionType, error: '' };
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'collection');
      return { data: null, error: errorMessage || 'Data validation failed' };
    }
  } catch (e) {
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

    await axios.post<{ id: string }>('/collection', collection);
    return '';
  } catch (error) {
    return axiosErrorHandler(error);
  }
};

/**
 * Edit an existing collection
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
      return { data: [], error: errorMessage || 'Data validation failed' };
    }
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { data: [], error: errorMessage };
  }
};

/**
 * Import a collection from a YOLO format file
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

/**
 * Get collection hierarchical tree data
 */
export const getCollectionHierarchical = async (
  collectionId: string,
): Promise<{ data: CollectionType | null; error: string }> => {
  try {
    const { data } = await axios.get<CollectionType>(
      `/collection/${collectionId}/hierarchical`,
    );
    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { data: null, error: errorMessage };
  }
};

export const apiGetCollectionHierarchical = getCollectionHierarchical;

/**
 * Get collections that are available for processing
 */
export const getCollectionAvailable = async (): Promise<{
  data: CollectionType[];
  error: string;
}> => {
  try {
    const { data } = await axios.get<CollectionType[]>('collection/available');

    // Validate the response data
    try {
      const validatedData = CollectionListSchema.parse(data);
      return { data: validatedData as unknown as CollectionType[], error: '' };
    } catch (validationError) {
      const errorMessage = handleZodError(validationError, 'collections');
      return { data: [], error: errorMessage || 'Data validation failed' };
    }
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { data: [], error: errorMessage };
  }
};
