/**
 * @author Michael Polívka (xpoliv07)
 */
import { axios, axiosErrorHandler } from './index';
import { ImageNewType } from 'src/stores';
import { MetaRoleDA, MetaRoleOption, ImageDA } from 'src/types';

/**
 * Upload an image to a collection
 * @returns Error message if there's an error, empty string if successful
 */
export const uploadImage = async (
  imageToAdd: ImageNewType,
): Promise<string> => {
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
    return { data: null, error };
  }
};

/**
 * Update an image's page index
 * @returns Error message if there's an error, empty string if successful
 */
export const updateImagePageIndex = async (
  imageId: string,
  pageIndex: string,
): Promise<string> => {
  try {
    await axios.post(`/image/update_page_index/${imageId}/${pageIndex}`);
    return '';
  } catch (e) {
    return axiosErrorHandler(e);
  }
};

/**
 * Update an image's page type
 * @returns Error message if there's an error, empty string if successful
 */
export const updateImagePageType = async (
  imageId: string,
  pageType: string,
): Promise<string> => {
  try {
    await axios.post(`/image/update_page_type/${imageId}/${pageType}`);
    return '';
  } catch (e) {
    return axiosErrorHandler(e);
  }
};
