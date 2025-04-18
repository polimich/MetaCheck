import { axios, axiosErrorHandler } from './index';
import { ImageAddDto } from 'src/stores';
import {
  DetectionState,
  DetectionStateToDa,
  MetaRoleDA,
  MetaRoleOption,
  ImageDA,
} from 'src/types';

/**
 * Upload an image to a collection
 * @returns Error message if there's an error, empty string if successful
 */
export const uploadImage = async (imageToAdd: ImageAddDto): Promise<string> => {
  try {
    const formData = new FormData();
    if (imageToAdd.file) {
      formData.append('file', imageToAdd.file);
    } else {
      return 'No file provided';
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
    return '';
  } catch (error) {
    return axiosErrorHandler(error);
  }
};

/**
 * Get available meta roles for a detection
 */
export const getDetectionAvailableMetaRoles = async (
  detectionId: string,
): Promise<{ data: MetaRoleDA[]; error: string }> => {
  try {
    const { data } = await axios.get<MetaRoleDA[]>(
      `/meta_role/available_for_detection/${detectionId}`,
    );
    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    return { data: [], error };
  }
};

/**
 * Load formatted meta roles for a detection
 */
export const loadMetaRolesForDetection = async (
  detectionId: string,
): Promise<{ data: MetaRoleOption[]; error: string }> => {
  const { data, error } = await getDetectionAvailableMetaRoles(detectionId);

  if (error) {
    return { data: [], error };
  }

  const formattedData = data.map((metaRole) => ({
    id: metaRole.id,
    label: metaRole.computed_display_name || metaRole.id,
    value: metaRole.computed_name || metaRole.id,
    color: metaRole.color || '#cccccc',
  }));

  return { data: formattedData, error: '' };
};

/**
 * Create a new detection
 * @returns Error message if there's an error, empty string if successful
 */
export const createDetection = async (
  detection: DetectionState,
): Promise<string> => {
  try {
    await axios.post('/detection', DetectionStateToDa(detection));
    return '';
  } catch (e) {
    return axiosErrorHandler(e);
  }
};

/**
 * Update an existing detection
 * @returns Error message if there's an error, empty string if successful
 */
export const updateDetection = async (
  detection: DetectionState,
): Promise<string> => {
  try {
    await axios.put('/detection', DetectionStateToDa(detection));
    return '';
  } catch (e) {
    return axiosErrorHandler(e);
  }
};

/**
 * Delete a detection
 * @returns Error message if there's an error, empty string if successful
 */
export const deleteDetection = async (detectionId: string): Promise<string> => {
  try {
    await axios.delete(`/detection/${detectionId}`);
    return '';
  } catch (e) {
    return axiosErrorHandler(e);
  }
};

/**
 * Get a single image by ID
 */
export const getImageById = async (
  imageId: string,
): Promise<{ data: ImageDA | null; error: string }> => {
  try {
    const { data } = await axios.get<ImageDA>(`/image/${imageId}`);

    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error fetching image ${imageId}:`, e);
    return { data: null, error };
  }
};
