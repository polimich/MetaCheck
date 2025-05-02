import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  CollectionHierarchical,
  MetaRole,
  MetaElementHierarchical,
} from 'src/types/data-access';
import { getMetaRolesForCollection } from 'src/api/metaRoleApiService';
import { apiGetCollectionHierarchical } from 'src/api/collectionApiService';
import { DAResponse } from '../data-access/types';

// Sort options type
export type SortOption =
  | 'order'
  | 'name_asc'
  | 'name_desc'
  | 'date_desc'
  | 'date_asc'
  | 'confidence_asc'
  | 'confidence_desc'
  | 'detection_count_desc';

// Image interface for better typing
export interface HierarchicalImage {
  id: string;
  name: string;
  confidence?: number;
  order: number;
  annotated?: boolean;
  detection_count?: number;
  annotated_detection_count?: number;
}

// Interface for hierarchical section item with its parent info
export interface HierarchicalSection {
  section: MetaElementHierarchical;
  path: string[];
  level: number;
  parentId: string | null;
}

export const useCollection = defineStore('collection', () => {
  const collection = ref<CollectionHierarchical>();
  const collectionMetaRoles = ref<MetaRole[]>([]);

  const loaded = ref(false);
  const error = ref('');
  const loading = ref(false);
  const expandedSections = ref<string[]>([]);

  // Sorting and filtering state
  const currentSortOption = ref<SortOption>('order');

  // Helper function to flatten the meta element structure into a list of sections with path information
  const flattenMetaElements = (
    elements: MetaElementHierarchical[],
    parentPath: string[] = [],
    parentId: string | null = null,
    level: number = 0,
  ): HierarchicalSection[] => {
    let result: HierarchicalSection[] = [];

    elements.forEach((element) => {
      const currentPath = [...parentPath, element.id];

      // Add current element to result
      result.push({
        section: element,
        path: currentPath,
        level,
        parentId,
      });

      // Recursively process children if they exist
      if (element.children && element.children.length > 0) {
        const childrenSections = flattenMetaElements(
          element.children,
          currentPath,
          element.id,
          level + 1,
        );
        result = [...result, ...childrenSections];
      }
    });

    return result;
  };

  // Get all sections in a flattened structure with hierarchy information
  const allSectionsFlattenedWithStructure = computed(
    (): HierarchicalSection[] => {
      if (!collection.value?.global_structure) return [];

      let result: HierarchicalSection[] = [];

      // Add top-level section (global structure) if it has images
      if (
        collection.value.global_structure.images &&
        collection.value.global_structure.images.length > 0
      ) {
        result.push({
          section: collection.value.global_structure,
          path: ['global'],
          level: 0,
          parentId: null,
        });
      }

      // Add children sections with hierarchy information
      if (
        collection.value.global_structure.children &&
        collection.value.global_structure.children.length > 0
      ) {
        const childrenSections = flattenMetaElements(
          collection.value.global_structure.children,
          ['global'],
          'global',
          1,
        );
        result = [...result, ...childrenSections];
      }

      return result;
    },
  );

  // Get flattened hierarchical structure of all sections
  const hierarchicalSections = computed(() => {
    return allSectionsFlattenedWithStructure.value;
  });

  // Get top-level sections only (first level of nesting)
  const metaElementSections = computed(() => {
    if (!collection.value) return [] as MetaElementHierarchical[];
    if (!collection.value.global_structure)
      return [] as MetaElementHierarchical[];

    // Access children from global_structure
    return (collection.value.global_structure.children ||
      []) as MetaElementHierarchical[];
  });

  // Get child sections for a specific parent section
  const getChildSections = computed(() => {
    return (parentId: string): HierarchicalSection[] => {
      return hierarchicalSections.value.filter(
        (section) => section.parentId === parentId,
      );
    };
  });

  // Collect all images from all levels
  const allImagesFlattened = computed((): HierarchicalImage[] => {
    if (!collection.value) return [];

    const allImages: HierarchicalImage[] = [];

    // Add images from all sections at all levels
    hierarchicalSections.value.forEach((sectionData) => {
      if (
        sectionData.section.images &&
        Array.isArray(sectionData.section.images)
      ) {
        allImages.push(...sectionData.section.images);
      }
    });

    return allImages;
  });

  // Get a specific image by ID
  const getImageById = computed(() => {
    return (imageId: string): HierarchicalImage | undefined => {
      return allImagesFlattened.value.find((img) => img.id === imageId);
    };
  });

  // Get images from global structure if available
  const topLevelImages = computed((): HierarchicalImage[] => {
    if (!collection.value?.global_structure?.images) return [];
    return collection.value.global_structure.images;
  });

  // NEW: Sorted images getter
  const getSortedImages = computed(() => {
    return (
      images: HierarchicalImage[],
      sortOption: SortOption,
    ): HierarchicalImage[] => {
      // Create a stable copy to ensure consistent sorting
      const imagesCopy = [...images];

      switch (sortOption) {
        case 'name_asc':
          return imagesCopy.sort((a, b) => a.name.localeCompare(b.name));

        case 'name_desc':
          return imagesCopy.sort((a, b) => b.name.localeCompare(a.name));

        case 'date_desc':
        case 'date_asc':
          // Fallback to comparison by ID if dates aren't available
          return imagesCopy.sort(
            (a, b) =>
              a.id.localeCompare(b.id) * (sortOption === 'date_asc' ? 1 : -1),
          );

        case 'confidence_asc':
          // Ensure undefined values are handled properly
          return imagesCopy.sort((a, b) => {
            // Default to 0 if confidence is undefined
            const aConfidence = a.confidence ?? 0;
            const bConfidence = b.confidence ?? 0;
            return aConfidence - bConfidence;
          });

        case 'confidence_desc':
          // Ensure undefined values are handled properly
          return imagesCopy.sort((a, b) => {
            // Default to 0 if confidence is undefined
            const aConfidence = a.confidence ?? 0;
            const bConfidence = b.confidence ?? 0;
            return bConfidence - aConfidence;
          });

        case 'detection_count_desc':
          // Sort by detection count (highest first)
          return imagesCopy.sort((a, b) => {
            // Default to 0 if detection_count is undefined
            const aCount = a.detection_count ?? 0;
            const bCount = b.detection_count ?? 0;
            return bCount - aCount;
          });

        case 'order':
          // Handle possibly undefined order values
          return imagesCopy.sort((a, b) => {
            const aOrder = a.order ?? 0;
            const bOrder = b.order ?? 0;
            return aOrder - bOrder;
          });

        default:
          // Sort by ID as a stable default sort
          return imagesCopy.sort((a, b) => a.id.localeCompare(b.id));
      }
    };
  });

  // NEW: Get images for any section by its ID
  const getImagesForSection = computed(() => {
    return (sectionId: string): HierarchicalImage[] => {
      // Handle global section specially
      if (
        sectionId === 'global' &&
        collection.value?.global_structure?.images
      ) {
        return collection.value.global_structure.images;
      }

      // Find the section in our flattened structure
      const sectionData = hierarchicalSections.value.find(
        (s) => s.section.id === sectionId,
      );
      if (!sectionData) return [];

      return sectionData.section.images || [];
    };
  });

  // NEW: Filtered images by section id
  const getFilteredImagesForSection = computed(() => {
    return (
      sectionId: string,
      searchQuery: string,
      sortOption: SortOption,
      verificationFilter: 'all' | 'verified' | 'unverified',
      confidenceFilters: { low: boolean; medium: boolean; high: boolean },
      hasLowConfidence: (id: string) => boolean,
      hasMediumConfidence: (id: string) => boolean,
      hasUnverifiedDetections: (id: string) => boolean,
      getVerificationStatus: (id: string) => string,
    ): HierarchicalImage[] => {
      // Get the section's images
      let sectionImages: HierarchicalImage[] = [];

      // Special case for global section
      if (
        sectionId === 'global' &&
        collection.value?.global_structure?.images
      ) {
        sectionImages = [...collection.value.global_structure.images];
      } else {
        // Find the section in our hierarchical structure
        const sectionData = hierarchicalSections.value.find(
          (s) => s.section.id === sectionId,
        );
        if (
          !sectionData ||
          !sectionData.section.images ||
          !Array.isArray(sectionData.section.images)
        ) {
          return [];
        }
        sectionImages = [...sectionData.section.images];
      }

      // Apply search filter
      if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        sectionImages = sectionImages.filter(
          (img) =>
            img.name.toLowerCase().includes(query) ||
            img.id.toLowerCase().includes(query),
        );
      }

      // Apply verification filter
      if (verificationFilter !== 'all') {
        sectionImages = sectionImages.filter((img) => {
          const verificationStatus = getVerificationStatus(img.id);
          return verificationStatus === verificationFilter;
        });
      }

      // Apply confidence filters
      const hasAnyConfidenceFilter =
        confidenceFilters.low ||
        confidenceFilters.medium ||
        confidenceFilters.high;

      if (hasAnyConfidenceFilter) {
        sectionImages = sectionImages.filter((img) => {
          const hasLow = hasLowConfidence(img.id);
          const hasMedium = hasMediumConfidence(img.id);
          const hasHigh = !hasLow && !hasMedium;

          if (confidenceFilters.low && hasLow) {
            return true;
          }
          if (confidenceFilters.medium && hasMedium) {
            return true;
          }
          if (confidenceFilters.high && hasHigh) {
            return true;
          }
          return false;
        });
      }

      // Sort the filtered images
      return getSortedImages.value(sectionImages, sortOption);
    };
  });

  // Helper functions
  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };
  const init = async () => {};

  const resetState = () => {
    collection.value = undefined;
    collectionMetaRoles.value = [];
    loaded.value = false;
    error.value = '';
    loading.value = false;
    expandedSections.value = [];
  };

  const loadCollection = async (collectionId: string) => {
    if (collection.value?.id !== collectionId) {
      resetState();
    }
    setLoading(true);
    error.value = '';

    const requestPromise = new Promise<DAResponse<CollectionHierarchical>>(
      async (resolve) => {
        try {
          const response = await apiGetCollectionHierarchical(collectionId);
          if (response.error) {
            error.value = response.error;
            console.error(response.error);
            resolve({ error: response.error });
          } else if (response.data) {
            collection.value = response.data;
            console.log('Hierarchical collection loaded:', collection.value);

            // Log the hierarchical structure
            if (collection.value.global_structure) {
              console.log(
                'Global structure:',
                collection.value.global_structure,
              );

              // Log children if available
              if (collection.value.global_structure.children) {
                console.log(
                  'Children count:',
                  collection.value.global_structure.children.length,
                );

                if (collection.value.global_structure.children.length > 0) {
                  console.log(
                    'First child:',
                    collection.value.global_structure.children[0],
                  );

                  // Log nested children if available
                  const firstChild =
                    collection.value.global_structure.children[0];
                  if (firstChild.children && firstChild.children.length > 0) {
                    console.log(
                      'Nested children found:',
                      firstChild.children.length,
                    );
                  }
                }
              }

              // Log top-level images if available
              if (
                collection.value.global_structure.images &&
                collection.value.global_structure.images.length > 0
              ) {
                console.log(
                  'Top-level images found:',
                  collection.value.global_structure.images.length,
                );
              }
            }

            loaded.value = true;

            // Auto-expand all top-level sections by default
            if (collection.value.global_structure?.children) {
              expandedSections.value =
                collection.value.global_structure.children.map((me) => me.id);

              // Also add global section to expanded if it has images
              if (
                collection.value.global_structure.images &&
                collection.value.global_structure.images.length > 0
              ) {
                expandedSections.value.push('global');
              }
            }

            const metaRolesResponse =
              await getMetaRolesForCollection(collectionId);
            if (metaRolesResponse.data && metaRolesResponse.data.length > 0) {
              collectionMetaRoles.value = metaRolesResponse.data;
              console.log(
                `Loaded ${collectionMetaRoles.value.length} meta roles for collection ${collectionId}`,
              );
            } else if (metaRolesResponse.error) {
              console.error(
                `Failed to load meta roles for collection: ${metaRolesResponse.error}`,
              );
            }
            resolve({ data: response.data, error: undefined });
          } else {
            const errorMsg = 'No collection data received';
            error.value = errorMsg;
            console.error(errorMsg);
            resolve({ error: errorMsg });
          }
        } catch (e) {
          const errorMsg = 'Failed to load collection';
          error.value = errorMsg;
          console.error(e);
          resolve({ error: errorMsg });
        } finally {
          setLoading(false);
        }
      },
    );
    console.log('requestPromise', requestPromise);
    return requestPromise;
  };

  // Check if a section has children
  const hasSectionChildren = computed(() => {
    return (sectionId: string): boolean => {
      // Handle global section specially
      if (sectionId === 'global') {
        return (
          !!collection.value?.global_structure?.children &&
          collection.value.global_structure.children.length > 0
        );
      }

      // Find section in our structure
      const sectionData = hierarchicalSections.value.find(
        (s) => s.section.id === sectionId,
      );
      if (!sectionData) return false;

      return (
        !!sectionData.section.children &&
        sectionData.section.children.length > 0
      );
    };
  });

  // Get direct children of a section
  const getChildrenMetaElements = computed(() => {
    return (sectionId: string): MetaElementHierarchical[] => {
      // Handle global section specially
      if (
        sectionId === 'global' &&
        collection.value?.global_structure?.children
      ) {
        return collection.value.global_structure.children;
      }

      // Find section in our structure
      const sectionData = hierarchicalSections.value.find(
        (s) => s.section.id === sectionId,
      );
      if (!sectionData || !sectionData.section.children) return [];

      return sectionData.section.children;
    };
  });

  const toggleSection = (sectionId: string) => {
    const index = expandedSections.value.indexOf(sectionId);
    if (index === -1) {
      expandedSections.value.push(sectionId);
    } else {
      expandedSections.value.splice(index, 1);
    }
  };

  const isSectionExpanded = (sectionId: string) => {
    return expandedSections.value.includes(sectionId);
  };

  const expandAllSections = () => {
    const sectionsToExpand = ['global']; // Start with global

    // Add all section IDs from our flattened structure
    hierarchicalSections.value.forEach((section) => {
      sectionsToExpand.push(section.section.id);
    });

    expandedSections.value = sectionsToExpand;
  };

  const collapseAllSections = () => {
    expandedSections.value = [];
  };

  // Set the current sort option
  const setSortOption = (sortOption: SortOption) => {
    console.log(`Setting sort option to: ${sortOption}`);
    currentSortOption.value = sortOption;
  };

  return {
    collection,
    collectionMetaRoles,
    loaded,
    error,
    loading,
    expandedSections,
    metaElementSections,
    hierarchicalSections,
    getChildSections,
    topLevelImages,
    allImagesFlattened,
    getImageById,
    getSortedImages,
    getFilteredImagesForSection,
    getImagesForSection,
    currentSortOption,
    setSortOption,
    init,
    loadCollection,
    hasSectionChildren,
    getChildrenMetaElements,
    toggleSection,
    isSectionExpanded,
    expandAllSections,
    collapseAllSections,
  };
});
