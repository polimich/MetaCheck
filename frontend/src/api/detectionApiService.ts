import { axios, axiosErrorHandler } from './index';
import { DetectionState } from 'src/types/frontend-state/detection.state';
import { DetectionStateToUpdateDA } from 'src/types/mapper/mapper';

/**
 * Update a single detection
 * @param detection The detection to update
 * @returns Error message if there's an error, empty string if successful
 */
export const updateSingleDetection = async (
  detection: DetectionState,
): Promise<{ error: string; success: boolean }> => {
  try {
    console.log(`API: Updating detection ${detection.id}`);

    // Convert frontend state to data access format
    const detectionDA = DetectionStateToUpdateDA(detection);

    // Send the update request
    await axios.put('/detection', detectionDA);

    console.log(`API: Successfully updated detection ${detection.id}`);
    return { error: '', success: true };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error(
      `API Error in updateSingleDetection for ${detection.id}:`,
      errorMessage,
    );
    return { error: errorMessage, success: false };
  }
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
