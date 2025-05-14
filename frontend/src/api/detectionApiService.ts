import { axios, axiosErrorHandler } from './index';
import { DetectionState } from 'src/types/frontend-state/detection.state';
import {
  DetectionNewType,
  DetectionType,
  DetectionUpdateType,
} from 'src/stores/data/types';
import { createApiService } from './apiFactory';

const crudDetectionApi = createApiService<
  DetectionState,
  DetectionNewType,
  DetectionUpdateType
>({
  basePath: '/detection',
  entityName: 'detection',
});

export const detectionApi = {
  ...crudDetectionApi,
};

/**
 * Get a single detection by ID
 * @param detectionId The ID of the detection to get
 * @returns The detection data and any error message
 */
export const getDetectionById = async (
  detectionId: string,
): Promise<{ data: DetectionState | null; error: string }> => {
  try {
    console.log(`API: Fetching detection ${detectionId}`);
    const { data } = await axios.get(`/detection/${detectionId}`);

    // The mapper function would need to be imported if implemented
    // const detectionState = DetectionDAtoState(data);

    console.log(`API: Successfully fetched detection ${detectionId}`);
    return { data: data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error(
      `API Error in getDetectionById for ${detectionId}:`,
      errorMessage,
    );
    return { data: null, error: errorMessage };
  }
};

export const updateDetectionWithMetaRole = async (
  detectionId: string,
  metaRoleId: string,
  value: string,
): Promise<{ error: string; success: boolean }> => {
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
    return { error: '', success: true };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error(
      `API Error in updateDetectionWithMetaRole for detection ${detectionId}, meta role ${metaRoleId}:`,
      errorMessage,
    );
    return { error: errorMessage, success: false };
  }
};

/**
 * Confirm a detection by marking it as annotated and setting confidence to 1
 * without changing its value or meta role
 */
export const confirmDetection = async (
  detection: DetectionState,
): Promise<{ error: string; success: boolean }> => {
  try {
    console.log(`API: Confirming detection ${detection.id}`);

    // Send the update request
    await axios.post(`detection/confirm/${detection.id}`);

    console.log(`API: Successfully confirmed detection ${detection.id}`);
    return { error: '', success: true };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error(
      `API Error in confirmDetection for ${detection.id}:`,
      errorMessage,
    );
    return { error: errorMessage, success: false };
  }
};

/**
 * Get all detections for an image
 * @param imageId The ID of the image to get detections for
 * @returns The detections data and any error message
 */
export const getDetectionsForImage = async (
  imageId: string,
): Promise<{ data: DetectionType[] | null; error: string }> => {
  try {
    console.log(`API: Fetching detections for image ${imageId}`);
    const { data } = await axios.get(`/image/${imageId}/detections`);

    console.log(`API: Successfully fetched detections for image ${imageId}`);
    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error(
      `API Error in getDetectionsForImage for image ${imageId}:`,
      errorMessage,
    );
    return { data: null, error: errorMessage };
  }
};
