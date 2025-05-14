/**
 * @author Michael Polívka (xpoliv07)
 */
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
    const { data } = await axios.get<MetaRoleState[]>('/meta_role');

    // Add edited property to match BaseState interface
    const processedData = data.map((role) => ({
      ...role,
      edited: false,
    }));

    return { data: processedData, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
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
    const { data } = await axios.get<MetaRoleState[]>(
      `/meta_role/available_for_detection/${detectionId}`,
    );

    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
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
    const { data } = await axios.get<MetaRoleState[]>(
      `/meta_role/available_for_collection/${collectionId}`,
    );

    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { data: [], error: errorMessage };
  }
};

export const findMetaRole = async (
  meta_attribute_name: string,
  meta_element_name: string,
): Promise<{
  data: string;
  error: string;
}> => {
  try {
    const { data } = await axios.get<string>(
      `/meta_role/find/${meta_attribute_name}/${meta_element_name}`,
    );
    return { data, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { data: '', error: errorMessage };
  }
};
