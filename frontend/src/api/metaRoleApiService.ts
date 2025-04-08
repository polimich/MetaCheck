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
