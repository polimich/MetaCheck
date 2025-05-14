import { defineStore, storeToRefs } from 'pinia';
import { ref, computed, watchEffect } from 'vue';
import { DetectionHierarchical } from 'src/types';
import { useCollection } from './useCollection';
import {
  findMetaRole,
  getHierarchicalTree,
  metaRoleDetectionApi,
} from 'src/api';
import { detectionApi } from 'src/api/detectionApiService';
import { DetectionNewType, MetaRoleDetectionNew } from '..';
import { v4 as uuidv4 } from 'uuid';

export const useHierarchicalTree = defineStore('hierarchicalTree', () => {
  const tree = ref<HierarchicalTree | undefined>(undefined);
  const loading = ref(false);
  const error = ref('');

  // Get data from the data-access store
  const collectionStore = useCollection();
  const { collection, loaded: collectionLoaded } = storeToRefs(collectionStore);

  // Create a computed property that builds the hierarchical tree from collection data
  // or fetches it directly from the API if available
  const hierarchicalTree = computed<HierarchicalTree | undefined>(() => {
    if (!collectionLoaded.value || !collection.value) return undefined;

    return tree.value;
  });

  // Determine tree type based on the data structure
  const determineTreeType = (
    data: Record<string, unknown>,
  ): HierarchicalTree => {
    console.log('Determining tree type from data:', data);

    // If the top element is a volume, it's a monograph
    if (data.type === 'volume') {
      console.log('Detected monograph (volume type)');
      return data as HierarchialTreeMonograph;
    }

    // If the top element is a title, check if it's a periodical
    if (data.type === 'title') {
      // Check if it's a periodical based on the periodical flag
      if (data.periodical === true) {
        console.log('Detected periodical (title type with periodical flag)');
        return data as HierarchialTreePeriodical;
      } else {
        console.log(
          'Detected multi-part monograph (title type without periodical flag)',
        );
        return data as HierarchialTreeMultiPartMonograph;
      }
    }

    // Default case - return as is and let the component handle unknown types
    console.warn('Unknown tree type detected:', data.type);
    return data as HierarchicalTree;
  };

  // Load the hierarchical tree directly from the API
  const loadHierarchicalTree = async (collectionId: string) => {
    if (!collectionId) return;

    loading.value = true;
    error.value = '';

    try {
      console.log(`Loading hierarchical tree for collection: ${collectionId}`);
      const response = await getHierarchicalTree(collectionId);
      console.log('Hierarchical tree response', response);
      if (response.error) {
        console.error(`Error loading hierarchical tree: ${response.error}`);
        error.value = response.error;
        return;
      }

      if (response.data) {
        // Determine the tree type and set it
        tree.value = determineTreeType(response.data);
      } else {
        console.warn('No hierarchical tree data received');
      }
      console.log('Hierarchical tree', tree.value);
    } catch (err) {
      console.error('Error loading hierarchical tree:', err);
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }

    console.log('Hierarchical tree', tree.value);
  };

  // Watch for changes in the collection ID and reload the tree
  watchEffect(() => {
    if (collection.value?.id) {
      loadHierarchicalTree(collection.value.id);
    } else {
      tree.value = undefined;
    }
  });

  const addDetection = async (
    detection: DetectionNewType,
    meta_element_id: string,
    meta_attribute_name: string,
    meta_element_name: string,
  ) => {
    try {
      console.log(
        `Adding detection with meta role ${meta_attribute_name} for meta element ${meta_element_name}`,
      );

      const meta_role_id = await findMetaRole(
        meta_attribute_name,
        meta_element_name,
      );
      if (meta_role_id.error) {
        console.error(`Error finding meta role: ${meta_role_id.error}`);
        return false;
      }
      console.log(
        'addDetectionWithMetaRole: ',
        detection,
        meta_element_id,
        meta_role_id.data,
      );
      const response = await detectionApi.create(detection);
      if (response.error) {
        console.error(`Error adding detection: ${response.error}`);
        return false;
      }

      const meta_role_detection_new: MetaRoleDetectionNew = {
        id: uuidv4(),
        meta_element_id,
        meta_role_id: meta_role_id.data,
        detection_id: detection.id,
      };

      const meta_role_detection = await metaRoleDetectionApi.create(
        meta_role_detection_new,
      );

      if (meta_role_detection.error) {
        console.error(
          `Error adding meta role detection: ${meta_role_detection.error}`,
        );
        return false;
      }

      // Get the current collection ID before reload
      const currentCollectionId = collection.value?.id;
      if (!currentCollectionId) {
        console.error('No collection ID available for reload');
        return false;
      }

      // Reload collection and wait for it to be ready
      await collectionStore.reloadCollection();
      await collectionStore.waitForCollectionReady(currentCollectionId);

      // Reload hierarchical tree after collection is ready
      await loadHierarchicalTree(currentCollectionId);

      return true;
    } catch (error) {
      console.error('Error in addDetection:', error);
      return false;
    }
  };

  return {
    tree: hierarchicalTree,
    loading,
    error,
    loadHierarchicalTree,
    addDetection,
  };
});

// Type guard functions for tree types
export function isMonograph(
  tree?: HierarchicalTree,
): tree is HierarchialTreeMonograph {
  return (
    !!tree &&
    tree.type === 'volume' &&
    !('volumes' in tree) &&
    !('issues' in tree)
  );
}

export function isMultiPartMonograph(
  tree?: HierarchicalTree,
): tree is HierarchialTreeMultiPartMonograph {
  if (!tree || tree.type !== 'title') return false;
  // Check if it's not a periodical
  const treeWithPeriodical = tree as Partial<HierarchialTreeTitleType>;
  return treeWithPeriodical.periodical !== true;
}

export function isPeriodical(
  tree?: HierarchicalTree,
): tree is HierarchialTreePeriodical {
  if (!tree || tree.type !== 'title') return false;
  // Check if it's a periodical
  const treeWithPeriodical = tree as Partial<HierarchialTreeTitleType>;
  return treeWithPeriodical.periodical === true;
}

export type HierarchicalTree =
  | HierarchialTreeMonograph
  | HierarchialTreeMultiPartMonograph
  | HierarchialTreePeriodical;

export type HierarchialTreeMonograph = HierarchialTreeVolumeType;

export type HierarchialTreeMultiPartMonograph = HierarchialTreeTitleType;

export type HierarchialTreePeriodical = HierarchialTreeTitleType & {
  periodical: boolean;
  issues?: HierarchialTreeIssueType[];
};

export type HierarchialTreeBaseType = {
  id: string;
  type: string;
};

export type HierarchialTreeVolumeType = HierarchialTreeBaseType & {
  partNumber?: DetectionHierarchical;
  partName?: DetectionHierarchical;
  dateIssued?: DetectionHierarchical;
  title?: DetectionHierarchical;
  subTitle?: DetectionHierarchical;
  edition?: DetectionHierarchical;
  placeTerm?: DetectionHierarchical;
  publisher?: DetectionHierarchical[];
  manufacturePublisher?: DetectionHierarchical[];
  manufacturePlaceTerm?: DetectionHierarchical[];
  author?: DetectionHierarchical[];
  illustrator?: DetectionHierarchical[];
  translator?: DetectionHierarchical[];
  editor?: DetectionHierarchical[];
  seriesName?: DetectionHierarchical[];
  seriesNumber?: DetectionHierarchical[];

  issues?: HierarchialTreeIssueType[];
};

export type HierarchialTreeIssueType = HierarchialTreeBaseType & {
  parent_id: string; // Volume UUID
  partNumber?: DetectionHierarchical; // Issue number
  dateIssued?: DetectionHierarchical; // Issue date
  title?: DetectionHierarchical; // Title
  subTitle?: DetectionHierarchical; // Subtitle
  placeTerm?: DetectionHierarchical; // Publication place
  publisher?: DetectionHierarchical[]; // Publisher
  manufacturePublisher?: DetectionHierarchical[]; // Printer
  manufacturePlaceTerm?: DetectionHierarchical[]; // Printing place
  redaktor?: DetectionHierarchical[]; // Editor's name
};

export type HierarchialTreeTitleType = HierarchialTreeVolumeType & {
  volumes?: HierarchialTreeVolumeType[];
  periodical?: boolean;
};
