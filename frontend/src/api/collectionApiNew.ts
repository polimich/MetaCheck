import { DAResponse } from 'src/stores/data-access/types';
import { CollectionHierarchical } from 'src/types/data-access';
import { axios, axiosErrorHandler } from '.';

/**
 * Get a collection with its hierarchial structure
 */
export const apiGetCollectionHierarchical = async (
  collectionId: string,
): Promise<DAResponse<CollectionHierarchical>> => {
  try {
    const { data } = await axios.get<CollectionHierarchical>(
      `/collection/${collectionId}/hierarchical`,
    );
    return { data, error: '' };
  } catch (error) {
    return { data: undefined, error: axiosErrorHandler(error) };
  }
};
