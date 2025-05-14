/**
 * @author Michael Polívka (xpoliv07)
 * Generic API factory that creates standardized API methods for any entity
 */
import { axios, axiosErrorHandler } from './index';

/**
 * Generic type for API responses
 */
export interface ApiResponse<T> {
  data: T | null;
  error: string;
}

/**
 * Basic CRUD API factory that creates standardized API methods for any entity
 */
export function createApiService<Entity, EntityNew, EntityUpdate>({
  basePath,
  entityName,
  customResponseHandler,
}: {
  basePath: string;
  entityName: string;
  customResponseHandler?: (data: unknown) => unknown;
}) {
  /**
   * Get all entities
   */
  const getAll = async (): Promise<ApiResponse<Entity[]>> => {
    try {
      const { data } = await axios.get<unknown>(`${basePath}`);

      // Process response if needed
      const processedData = customResponseHandler
        ? customResponseHandler(data)
        : data;

      return { data: processedData as Entity[], error: '' };
    } catch (error) {
      const errorMessage = axiosErrorHandler(error, undefined, true);
      return { data: [] as Entity[], error: errorMessage };
    }
  };

  /**
   * Get a specific entity by ID
   */
  const getById = async (id: string): Promise<ApiResponse<Entity>> => {
    if (!id) {
      return { data: null, error: `No ${entityName} ID provided` };
    }

    try {
      const { data } = await axios.get<unknown>(`${basePath}/${id}`);

      // Process response if needed
      const processedData = customResponseHandler
        ? customResponseHandler(data)
        : data;

      return { data: processedData as Entity, error: '' };
    } catch (e) {
      const errorMessage = axiosErrorHandler(e, undefined, true);
      return { data: null, error: errorMessage };
    }
  };

  /**
   * Create a new entity
   */
  const create = async (
    entity: EntityNew,
  ): Promise<{ id?: string; error: string }> => {
    try {
      const { data } = await axios.post<{ id: string }>(basePath, entity);
      return { id: data.id, error: '' };
    } catch (error) {
      return { error: axiosErrorHandler(error) };
    }
  };

  /**
   * Update an existing entity
   */
  const update = async (
    entity: EntityUpdate & { id: string },
  ): Promise<{ data: Entity | null; error: string }> => {
    try {
      const { data } = await axios.put<unknown>(
        `${basePath}/${entity.id}`,
        entity,
      );

      // Process response if needed
      const processedData = customResponseHandler
        ? customResponseHandler(data)
        : data;

      return { data: processedData as Entity, error: '' };
    } catch (error) {
      return { data: null, error: axiosErrorHandler(error) };
    }
  };

  /**
   * Delete an entity
   */
  const remove = async (
    id: string,
  ): Promise<{ success: boolean; error: string }> => {
    try {
      await axios.delete(`${basePath}/${id}`);
      return { success: true, error: '' };
    } catch (error) {
      return { success: false, error: axiosErrorHandler(error) };
    }
  };

  // Return all the CRUD operations
  return {
    getAll,
    getById,
    create,
    update,
    remove,
  };
}
