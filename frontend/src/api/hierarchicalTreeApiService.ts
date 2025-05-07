import { axios } from 'src/api';
import { HierarchicalTree } from 'src/stores';
import { ApiResponse } from 'src/types';

/**
 * Fetches the hierarchical tree for a collection
 * @param collectionId The collection ID
 * @returns Promise with the hierarchical tree data
 */
export const getHierarchicalTree = async (
  collectionId: string,
): Promise<ApiResponse<HierarchicalTree>> => {
  try {
    const response = await axios.get(
      `/collection/${collectionId}/hierarchical_tree`,
    );
    return { data: response.data, error: undefined };
  } catch (error) {
    console.error('Error fetching hierarchical tree:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      data: undefined,
    };
  }
};
