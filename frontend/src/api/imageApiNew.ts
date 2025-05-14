import { axios, axiosErrorHandler } from './index';
import {
  DetectionType,
  ImageType,
  DetectionNewType,
  DetectionUpdateType,
} from 'src/stores/data/types';

/**
 * Get a single image by ID
 */
export const getImage = async (
  imageId: string,
): Promise<{ data: ImageType | null; error: string }> => {
  try {
    const { data } = await axios.get<ImageType>(`/image/${imageId}`);
    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error fetching image ${imageId}:`, e);
    return { data: null, error };
  }
};

/**
 * Get all images for a collection
 */
export const getImagesForCollection = async (
  collectionId: string,
): Promise<{ data: ImageType[] | null; error: string }> => {
  try {
    const { data } = await axios.get<ImageType[]>(
      `/collection/${collectionId}/images`,
    );
    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error fetching images for collection ${collectionId}:`, e);
    return { data: null, error };
  }
};

/**
 * Create a new detection
 */
export const createDetection = async (
  detection: DetectionNewType,
): Promise<{ data: DetectionType | null; error: string }> => {
  try {
    const { data } = await axios.post<DetectionType>('/detection', detection);
    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error('Error creating detection:', e);
    return { data: null, error };
  }
};

/**
 * Update an existing detection
 */
export const updateDetection = async (
  detection: DetectionUpdateType & { id: string },
): Promise<{ data: DetectionType | null; error: string }> => {
  try {
    const { data } = await axios.put<DetectionType>('/detection', detection);
    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error updating detection ${detection.id}:`, e);
    return { data: null, error };
  }
};

/**
 * Delete a detection
 */
export const deleteDetection = async (
  detectionId: string,
): Promise<{ success: boolean; error: string }> => {
  try {
    await axios.delete(
      `/detection/meta_element_detection_delete/${detectionId}`,
    );
    return { success: true, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error deleting detection ${detectionId}:`, e);
    return { success: false, error };
  }
};

/**
 * Update an image's page index
 */
export const updateImagePageIndex = async (
  imageId: string,
  pageIndex: string,
): Promise<{ success: boolean; error: string }> => {
  try {
    console.log(
      `[DEBUG-API] Updating page index for image ${imageId} to "${pageIndex}"`,
    );
    await axios.post(`/image/update_page_index/${imageId}/${pageIndex}`);
    console.log(
      `[DEBUG-API] Successfully sent page index update for image ${imageId}`,
    );
    return { success: true, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(
      `[DEBUG-API] Error updating page index for image ${imageId}:`,
      e,
    );
    return { success: false, error };
  }
};

/**
 * Update an image's page type
 */
export const updateImagePageType = async (
  imageId: string,
  pageType: string,
): Promise<{ success: boolean; error: string }> => {
  try {
    await axios.post(`/image/update_page_type/${imageId}/${pageType}`);
    return { success: true, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error updating page type for image ${imageId}:`, e);
    return { success: false, error };
  }
};

/**
 * Update an image
 */
export const updateImage = async (
  image: ImageType,
): Promise<{ data: ImageType | null; error: string }> => {
  try {
    const { data } = await axios.put<ImageType>(`/image/${image.id}`, image);
    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error updating image ${image.id}:`, e);
    return { data: null, error };
  }
};

/**
 * Update a detection with a meta role
 */
export const updateDetectionWithMetaRole = async (
  detectionId: string,
  metaRoleId: string,
  value: string,
): Promise<{ success: boolean; error: string }> => {
  try {
    console.log(
      `API: Updating detection ${detectionId} with meta role ${metaRoleId}`,
    );

    await axios.post(
      `/detection/update_detection_meta_role/${detectionId}/${metaRoleId}/${value}`,
    );

    console.log(
      `API: Successfully updated detection ${detectionId} with meta role`,
    );
    return { success: true, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(
      `API Error in updateDetectionWithMetaRole for detection ${detectionId}, meta role ${metaRoleId}:`,
      error,
    );
    return { success: false, error };
  }
};

/**
 * Get all detections for an image
 */
export const getDetectionsForImage = async (
  imageId: string,
): Promise<{ data: DetectionType[] | null; error: string }> => {
  try {
    const { data } = await axios.get<DetectionType[]>(
      `/image/detections/${imageId}`,
    );
    return { data, error: '' };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(`Error fetching detections for image ${imageId}:`, e);
    return { data: null, error };
  }
};

/**
 * Verify page index update by fetching the image data
 */
export const verifyPageIndexUpdate = async (
  imageId: string,
  expectedPageIndex: string,
): Promise<{
  success: boolean;
  actualPageIndex: string | null;
  error: string;
}> => {
  try {
    console.log(`[DEBUG-API] Verifying page index update for image ${imageId}`);
    const imageResponse = await getImage(imageId);

    if (imageResponse.error || !imageResponse.data) {
      console.error(
        `[DEBUG-API] Error fetching image ${imageId} to verify update:`,
        imageResponse.error,
      );
      return {
        success: false,
        actualPageIndex: null,
        error: imageResponse.error || 'Image not found',
      };
    }

    const actualPageIndex = imageResponse.data.page_index || null;
    const success = actualPageIndex === expectedPageIndex;

    console.log(`[DEBUG-API] Page index verification for image ${imageId}:
      - Expected: ${expectedPageIndex}
      - Actual: ${actualPageIndex}
      - Match: ${success ? 'YES' : 'NO'}`);

    return {
      success,
      actualPageIndex,
      error: success
        ? ''
        : `Page index mismatch: expected ${expectedPageIndex}, got ${actualPageIndex}`,
    };
  } catch (e) {
    const error = axiosErrorHandler(e);
    console.error(
      `[DEBUG-API] Exception verifying page index for image ${imageId}:`,
      e,
    );
    return { success: false, actualPageIndex: null, error };
  }
};
