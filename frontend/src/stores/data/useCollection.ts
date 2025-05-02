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

export const useCollection = defineStore('collection', () => {
  const collection = ref<CollectionHierarchical>();
  const collectionMetaRoles = ref<MetaRole[]>([]);

  const loaded = ref(false);
  const error = ref('');
  const loading = ref(false);
  const expandedSections = ref<string[]>([]);

  // Sorting and filtering state
  const currentSortOption = ref<SortOption>('order');

  // computed properties
  const metaElementSections = computed(() => {
    if (!collection.value) return [] as MetaElementHierarchical[];
    if (!collection.value.global_structure)
      return [] as MetaElementHierarchical[];

    // Access children from global_structure instead of meta_elements
    return (collection.value.global_structure.children ||
      []) as MetaElementHierarchical[];
  });

  const allImagesFlattened = computed((): HierarchicalImage[] => {
    if (!collection.value) return [];

    const allImages: HierarchicalImage[] = [];

    // Helper function to recursively collect images from hierarchical structure
    const collectImagesRecursively = (element: MetaElementHierarchical) => {
      // Add images from current element
      if (element.images && Array.isArray(element.images)) {
        allImages.push(...element.images);
      }

      // Recursively process children
      if (element.children && Array.isArray(element.children)) {
        element.children.forEach((childElement) => {
          // Ensure the child is a MetaElementHierarchical before processing
          if (
            childElement &&
            'detections' in childElement &&
            'images' in childElement
          ) {
            collectImagesRecursively(childElement as MetaElementHierarchical);
          }
        });
      }
    };

    // Use metaElementSections if available
    if (metaElementSections.value && metaElementSections.value.length > 0) {
      // Process each section and its children recursively
      metaElementSections.value.forEach((section) => {
        collectImagesRecursively(section);
      });
    }
    // Fallback to global structure images if available
    else if (collection.value.global_structure) {
      collectImagesRecursively(collection.value.global_structure);
    }
    // Fallback to collection images if all else fails
    else if (collection.value.images) {
      allImages.push(...collection.value.images);
    }

    return allImages;
  });

  // Get a specific image by ID
  const getImageById = computed(() => {
    return (imageId: string): HierarchicalImage | undefined => {
      return allImagesFlattened.value.find((img) => img.id === imageId);
    };
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

  // NEW: Filtered images by section
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
      const section = metaElementSections.value.find(
        (section) => section.id === sectionId,
      );
      if (!section || !section.images || !Array.isArray(section.images))
        return [];

      let sectionImages = [...section.images];

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

              if (collection.value.global_structure.children) {
                console.log(
                  'Children count:',
                  collection.value.global_structure.children.length,
                );
                console.log(
                  'First child:',
                  collection.value.global_structure.children[0],
                );
              } else {
                console.log('No children in global structure');
              }
            } else {
              console.log('No global structure in the collection');
            }

            loaded.value = true;

            // Auto-expand all sections by default
            if (collection.value.global_structure?.children) {
              expandedSections.value =
                collection.value.global_structure.children.map((me) => me.id);
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

  const getImagesForMetaElement = (metaElementId: string) => {
    if (!collection.value || !collection.value.global_structure) return [];

    // Try to find the meta element - first at the top level, then search recursively
    const metaElement = findMetaElementRecursively(
      collection.value.global_structure,
      metaElementId,
    );

    return metaElement?.images || [];
  };

  // Helper function to find a meta element by ID recursively
  const findMetaElementRecursively = (
    element: MetaElementHierarchical,
    targetId: string,
  ): MetaElementHierarchical | undefined => {
    // Check if this is the element we're looking for
    if (element.id === targetId) {
      return element;
    }

    // If not, search in children if they exist
    if (element.children && Array.isArray(element.children)) {
      for (const child of element.children) {
        // Skip non-hierarchical children
        if (!child || !('detections' in child) || !('images' in child))
          continue;

        const found = findMetaElementRecursively(
          child as MetaElementHierarchical,
          targetId,
        );
        if (found) return found;
      }
    }

    // Not found in this branch
    return undefined;
  };

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
    if (!collection.value?.global_structure?.children) return;
    expandedSections.value = collection.value.global_structure.children.map(
      (me) => me.id,
    );
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
    allImagesFlattened,
    getImageById,
    getSortedImages,
    getFilteredImagesForSection,
    currentSortOption,
    setSortOption,
    init,
    loadCollection,
    getImagesForMetaElement,
    toggleSection,
    isSectionExpanded,
    expandAllSections,
    collapseAllSections,
  };
});
