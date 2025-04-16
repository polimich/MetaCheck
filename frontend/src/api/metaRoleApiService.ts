import { axios, axiosErrorHandler } from './index';
import { MetaRoleState } from 'src/types/frontend-state/meta_role.state';

/**
 * Get all meta roles
 */
export const getMetaRoles = async (): Promise<{
  data: MetaRoleState[];
  error: string;
}> => {
  try {
    console.log('API: Fetching all meta roles');
    const { data } = await axios.get<MetaRoleState[]>('/meta_role');

    // Add edited property to match BaseState interface
    const processedData = data.map((role) => ({
      ...role,
      edited: false,
    }));

    console.log(`API: Fetched ${processedData.length} meta roles`);
    return { data: processedData, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error('API Error in getMetaRoles:', errorMessage);
    return { data: [], error: errorMessage };
  }
};

/**
 * Get meta roles available for a specific detection
 */
export const getMetaRolesForAnnotation = async (
  detectionId: string,
): Promise<{
  data: MetaRoleState[];
  error: string;
}> => {
  try {
    console.log(`API: Fetching meta roles for detection ${detectionId}`);
    const { data } = await axios.get<MetaRoleState[]>(
      `/meta_role/available_for_detection/${detectionId}`,
    );

    console.log(
      `API: Fetched ${data.length} meta roles for detection ${detectionId}`,
    );
    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error(
      `API Error in getMetaRolesForAnnotation for ${detectionId}:`,
      errorMessage,
    );
    return { data: [], error: errorMessage };
  }
};

/**
 * Get all meta roles for a collection
 */
export const getMetaRolesForCollection = async (
  collectionId: string,
): Promise<{
  data: MetaRoleState[];
  error: string;
}> => {
  try {
    console.log(`API: Fetching meta roles for collection ${collectionId}`);
    const { data } = await axios.get<MetaRoleState[]>(
      `/meta_role/available_for_collection/${collectionId}`,
    );

    console.log(
      `API: Fetched ${data.length} meta roles for collection ${collectionId}`,
    );
    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    console.error(
      `API Error in getMetaRolesForCollection for ${collectionId}:`,
      errorMessage,
    );
    return { data: [], error: errorMessage };
  }
};
