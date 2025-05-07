import { CollectionHierarchical } from 'src/types/data-access';
import { axios, axiosErrorHandler } from '.';
import { ApiResponse } from 'src/types';

/**
 * Get a collection with its hierarchial structure
 */
export const apiGetCollectionHierarchical = async (
  collectionId: string,
): Promise<ApiResponse<CollectionHierarchical>> => {
  try {
    const { data } = await axios.get<CollectionHierarchical>(
      `/collection/${collectionId}/hierarchical`,
    );
    return { data, error: '' };
  } catch (error) {
    return { data: undefined, error: axiosErrorHandler(error) };
  }
};
