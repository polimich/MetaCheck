// Export all services by API endpoint
export * from './imageApiService';
export * from './collectionApiService';
export * from './metaRoleApiService';
export * from './detectionApiService';

// Health check service - using meta roles endpoint as it's lightweight and needed anyway
import { axios, axiosErrorHandler } from './index';

export const checkApiHealth = async (): Promise<{
  isHealthy: boolean;
  error: string;
}> => {
  try {
    // Use meta roles endpoint as a health check since we need this data anyway
    await axios.get('/meta_role');
    return { isHealthy: true, error: '' };
  } catch (error) {
    const errorMessage = axiosErrorHandler(error);
    return { isHealthy: false, error: errorMessage };
  }
};
