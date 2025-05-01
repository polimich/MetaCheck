import { defineStore } from 'pinia';
import { DetectionHierarchical } from 'src/types';
import { ref, computed, watchEffect } from 'vue';
import { useDataAccess } from '../data-access/data-access';
import { storeToRefs } from 'pinia';
import {
  CollectionHierarchical,
  MetaElementHierarchical,
} from 'src/types/data-access';

export const useHierarchicalTree = defineStore('hierarchicalTree', () => {
  const tree = ref<HierarchicalTree | undefined>(undefined);

  // Get data from the data-access store
  const dataAccessStore = useDataAccess();
  const { collection, loaded: collectionLoaded } = storeToRefs(dataAccessStore);
  // Create a computed property that builds the hierarchical tree from collection data
  const hierarchicalTree = computed<HierarchicalTree | undefined>(() => {
    if (!collectionLoaded.value || !collection.value) return undefined;

    // Extract data from the collection to build the hierarchical tree
    const collectionData = collection.value;

    let globalStructureHierarchicalTree: HierarchicalTree;

    // Determine the tree type based on the global structure
    const metaElementType =
      collectionData.global_structure?.meta_element_type?.name;
    const isPeriodical =
      collectionData.global_structure?.attributes?.periodical === 'true';

    console.log('metaElementType', metaElementType);
    console.log('isPeriodical', isPeriodical);
    // Use switch statement to handle different types
    switch (true) {
      // Case 1: Volume type (Monograph)
      case metaElementType === 'volume':
        globalStructureHierarchicalTree = {
          id: collectionData.global_structure.id,
          type: 'volume',
        } as HierarchialTreeMonograph;
        processVolumeAttributes(
          globalStructureHierarchicalTree,
          collectionData,
        );
        break;

      // Case 2: Title type with periodical=true (Periodical)
      case metaElementType === 'title' && isPeriodical:
        globalStructureHierarchicalTree = {
          id: collectionData.global_structure.id,
          type: 'title',
          periodical: true,
        } as HierarchialTreePeriodicalType;

        // Process periodical-specific attributes
        processPeriodicalAttributes(
          globalStructureHierarchicalTree as HierarchialTreePeriodicalType,
          collectionData,
        );
        break;

      // Case 3: Title type with periodical=false (MultiPartMonograph)
      case metaElementType === 'title' && !isPeriodical:
        globalStructureHierarchicalTree = {
          id: collectionData.global_structure.id,
          type: 'title',
        } as HierarchialTreeMultiPartMonograph;

        // Process multi-part monograph-specific attributes
        processMultiPartAttributes(
          globalStructureHierarchicalTree as HierarchialTreeMultiPartMonograph,
          collectionData,
        );
        break;

      // Default case: Unknown type
      default:
        return undefined;
    }

    return globalStructureHierarchicalTree;
  });

  // Helper function to convert snake_case to camelCase
  const snakeToCamel = (str: string): string => {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  };

  // Type-safe property assignment functions for each tree type
  const assignVolumeProperty = (
    tree: HierarchialTreeVolumeType,
    property: keyof HierarchialTreeVolumeType,
    value: DetectionHierarchical,
  ): void => {
    // Define which properties are arrays
    const arrayProperties = [
      'publisher',
      'manufacturePublisher',
      'manufacturePlaceTerm',
      'author',
      'illustrator',
      'translator',
      'editor',
      'seriesName',
      'seriesNumber',
    ] as const;

    // Define which properties are single values
    const singleValueProperties = [
      'title',
      'subTitle',
      'partNumber',
      'partName',
      'dateIssued',
      'edition',
      'placeTerm',
    ] as const;

    // Handle array properties
    if (
      arrayProperties.includes(property as (typeof arrayProperties)[number])
    ) {
      const arrayProp = property as keyof typeof tree;
      if (!tree[arrayProp]) {
        (tree[arrayProp] as unknown as DetectionHierarchical[]) = [];
      }
      (tree[arrayProp] as unknown as DetectionHierarchical[]).push(value);
    }
    // Handle single value properties
    else if (
      singleValueProperties.includes(
        property as (typeof singleValueProperties)[number],
      )
    ) {
      const singleProp = property as keyof typeof tree;
      (tree[singleProp] as unknown as DetectionHierarchical) = value;
    }
  };

  const assignIssueProperty = (
    issue: HierarchialTreeIssueType,
    property: keyof HierarchialTreeIssueType,
    value: DetectionHierarchical,
  ): void => {
    // Handle array properties
    if (property === 'publisher' && issue.publisher) {
      issue.publisher.push(value);
    } else if (
      property === 'manufacturePublisher' &&
      issue.manufacturePublisher
    ) {
      issue.manufacturePublisher.push(value);
    } else if (
      property === 'manufacturePlaceTerm' &&
      issue.manufacturePlaceTerm
    ) {
      issue.manufacturePlaceTerm.push(value);
    } else if (property === 'redaktor' && issue.redaktor) {
      issue.redaktor.push(value);
    }
    // Handle non-array properties
    else if (property !== 'id' && property !== 'type') {
      // Initialize array properties if needed
      if (property === 'publisher' && !issue.publisher) {
        issue.publisher = [value];
      } else if (
        property === 'manufacturePublisher' &&
        !issue.manufacturePublisher
      ) {
        issue.manufacturePublisher = [value];
      } else if (
        property === 'manufacturePlaceTerm' &&
        !issue.manufacturePlaceTerm
      ) {
        issue.manufacturePlaceTerm = [value];
      } else if (property === 'redaktor' && !issue.redaktor) {
        issue.redaktor = [value];
      } else {
        // Safe properties to assign directly
        const singleValueProps = [
          'title',
          'subTitle',
          'partNumber',
          'dateIssued',
          'placeTerm',
        ];
        if (singleValueProps.includes(property as string)) {
          (issue[property] as DetectionHierarchical) = value;
        }
      }
    }
  };

  // Define mappings between role names and tree properties
  const volumeRoleMappings: Record<string, keyof HierarchialTreeVolumeType> = {
    title: 'title',
    subTitle: 'subTitle',
    publisher: 'publisher',
    manufacturePublisher: 'manufacturePublisher',
    author: 'author',
    illustrator: 'illustrator',
    translator: 'translator',
    editor: 'editor',
    placeTerm: 'placeTerm',
    manufacturePlaceTerm: 'manufacturePlaceTerm',
    partNumber: 'partNumber',
    partName: 'partName',
    dateIssued: 'dateIssued',
    edition: 'edition',
    seriesName: 'seriesName',
    seriesNumber: 'seriesNumber',
  };

  const issueRoleMappings: Record<string, keyof HierarchialTreeIssueType> = {
    title: 'title',
    subTitle: 'subTitle',
    publisher: 'publisher',
    manufacturePublisher: 'manufacturePublisher',
    placeTerm: 'placeTerm',
    manufacturePlaceTerm: 'manufacturePlaceTerm',
    partNumber: 'partNumber',
    dateIssued: 'dateIssued',
    redaktor: 'redaktor',
  };

  // Helper functions to process each type of hierarchical tree
  const processVolumeAttributes = (
    volumeTree: HierarchialTreeMonograph,
    collectionData: CollectionHierarchical,
  ) => {
    // Extract detections related to volume attributes
    const detections = collectionData.global_structure?.detections || [];
    console.log('detections', detections);
    // Process detections to extract relevant metadata
    detections.forEach((detection: DetectionHierarchical) => {
      const roleName = detection.computed_type.split('.')[1];
      if (roleName) {
        // Convert snake_case to camelCase if needed
        const camelRoleName = snakeToCamel(roleName);
        console.log('camelRoleName', camelRoleName);
        // Use the mapping to find the correct property name
        if (camelRoleName in volumeRoleMappings) {
          const propertyName = volumeRoleMappings[camelRoleName];
          assignVolumeProperty(volumeTree, propertyName, detection);
        }
      }
    });
  };

  const processPeriodicalAttributes = (
    periodicalTree: HierarchialTreePeriodicalType,
    collectionData: CollectionHierarchical,
  ) => {
    // Extract detections and process title data
    processVolumeAttributes(periodicalTree, collectionData);

    // Process volumes if they exist
    const volumeElements = collectionData.global_structure?.children || [];
    periodicalTree.volumes = volumeElements
      .filter(
        (child: MetaElementHierarchical) =>
          child.meta_element_type?.name === 'volume',
      )
      .map((volumeElement: MetaElementHierarchical) => {
        const volumeTree: HierarchialTreeVolumeType = {
          id: volumeElement.id,
          type: 'volume',
        };

        // Process volume attributes programmatically
        const detections = volumeElement.detections || [];
        detections.forEach((detection: DetectionHierarchical) => {
          const roleName = detection.computed_type.split('.')[1];
          if (roleName) {
            const camelRoleName = snakeToCamel(roleName);
            if (camelRoleName in volumeRoleMappings) {
              const propertyName = volumeRoleMappings[camelRoleName];
              assignVolumeProperty(volumeTree, propertyName, detection);
            }
          }
        });

        // Process issues if they exist
        const issueElements = volumeElement.children || [];
        volumeTree.issues = issueElements
          .filter(
            (child: MetaElementHierarchical) =>
              child.meta_element_type?.name === 'issue',
          )
          .map((issueElement: MetaElementHierarchical) => {
            const issueTree: HierarchialTreeIssueType = {
              id: issueElement.id,
              type: 'issue',
            };

            // Process issue attributes programmatically
            const issueDetections = issueElement.detections || [];
            issueDetections.forEach((detection: DetectionHierarchical) => {
              const roleName = detection.computed_type.split('.')[1];
              if (roleName) {
                const camelRoleName = snakeToCamel(roleName);
                if (camelRoleName in issueRoleMappings) {
                  const propertyName = issueRoleMappings[camelRoleName];
                  assignIssueProperty(issueTree, propertyName, detection);
                }
              }
            });

            return issueTree;
          });

        return volumeTree;
      });
  };

  const processMultiPartAttributes = (
    multiPartTree: HierarchialTreeMultiPartMonograph,
    collectionData: CollectionHierarchical,
  ) => {
    // Process title-level attributes similar to periodical
    processVolumeAttributes(multiPartTree, collectionData);

    // Process parts/volumes
    const volumeElements = collectionData.global_structure?.children || [];
    multiPartTree.volumes = volumeElements
      .filter(
        (child: MetaElementHierarchical) =>
          child.meta_element_type?.name === 'volume',
      )
      .map((volumeElement: MetaElementHierarchical) => {
        const volumeTree: HierarchialTreeVolumeType = {
          id: volumeElement.id,
          type: 'volume',
        };

        // Process volume attributes programmatically
        const detections = volumeElement.detections || [];
        detections.forEach((detection: DetectionHierarchical) => {
          const roleName = detection.computed_type.split('.')[1];
          if (roleName) {
            const camelRoleName = snakeToCamel(roleName);
            if (camelRoleName in volumeRoleMappings) {
              const propertyName = volumeRoleMappings[camelRoleName];
              assignVolumeProperty(volumeTree, propertyName, detection);
            }
          }
        });

        return volumeTree;
      });
  };

  // Set the tree ref whenever the computed property changes
  watchEffect(() => {
    tree.value = hierarchicalTree.value;
  });

  return {
    tree: hierarchicalTree,
  };
});

// Type guard functions for tree types
export function isMonograph(
  tree?: HierarchicalTree,
): tree is HierarchialTreeMonograph {
  return tree?.type === 'volume' && !('volumes' in tree);
}
export function isPeriodical(
  tree?: HierarchicalTree,
): tree is HierarchialTreePeriodicalType {
  return tree?.type === 'title' && tree?.periodical === true;
}

export function isMultiPartMonograph(
  tree?: HierarchicalTree,
): tree is HierarchialTreeMultiPartMonograph {
  return tree?.type === 'title' && !tree?.periodical;
}

export type HierarchicalTree =
  | HierarchialTreeMonograph
  | HierarchialTreeMultiPartMonograph
  | HierarchialTreePeriodicalType;

export type HierarchialTreeMonograph = HierarchialTreeVolumeType;

export type HierarchialTreeMultiPartMonograph = HierarchialTreeTitleType;

export type HierarchialTreePeriodicalType = HierarchialTreeTitleType;

export type HierarchialTreeBaseType = {
  id: string;
  type: string;
};

export type HierarchialTreeVolumeType = HierarchialTreeBaseType & {
  periodical?: boolean;
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

export type HierarchialTreeTitleType = HierarchialTreeVolumeType & {
  volumes?: HierarchialTreeVolumeType[];
};

export type HierarchialTreeIssueType = HierarchialTreeBaseType & {
  partNumber?: DetectionHierarchical;
  dateIssued?: DetectionHierarchical;
  title?: DetectionHierarchical;
  subTitle?: DetectionHierarchical;
  placeTerm?: DetectionHierarchical;
  publisher?: DetectionHierarchical[];
  manufacturePublisher?: DetectionHierarchical[];
  manufacturePlaceTerm?: DetectionHierarchical[];
  redaktor?: DetectionHierarchical[];
};
