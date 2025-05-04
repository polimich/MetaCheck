import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  CollectionHierarchical,
  MetaRole,
  MetaElementHierarchical,
} from 'src/types/data-access';
import { getMetaRolesForCollection } from 'src/api/metaRoleApiService';
import { DAResponse } from '../data-access/types';
import {
  apiGetCollectionHierarchical,
  getDetectionsForImage as apiGetDetectionsForImage,
} from 'src/api';
import { DetectionType } from './types';
import { getDetectionById } from 'src/api/detectionApiService';
import { updateDetectionWithMetaRole as apiUpdateDetectionWithMetaRole } from 'src/api/imageApiNew';
import { updateDetection as apiUpdateDetection } from 'src/api/imageApiNew';

// Define a more specific type for the image update data
interface UpdatedImageData {
  detection_count?: number;
  annotated_detection_count?: number;
  confidence?: number;
  detections?: DetectionType[];
  [key: string]: unknown; // Allow other properties with unknown type instead of any
}

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
  page_index?: string;
  page_index_confidence?: number;
  page_type?: string;
  page_type_confidence?: number;
  detections?: DetectionType[];
}

// Interface for hierarchical section item with its parent info
export interface HierarchicalSection {
  section: MetaElementHierarchical;
  path: string[];
  level: number;
  parentId: string | null;
}

// Interface for image location in collection structure
interface ImageLocation {
  sectionId: string;
  parentIds: string[];
  index: number;
  image: HierarchicalImage;
}

export const useCollection = defineStore('collection', () => {
  const collection = ref<CollectionHierarchical>();
  const collectionMetaRoles = ref<MetaRole[]>([]);
  const imageLocationMap = ref<Map<string, ImageLocation>>(new Map());

  const loaded = ref(false);
  const error = ref('');
  const loading = ref(false);
  const expandedSections = ref<string[]>([]);
  const selectedImageId = ref<string>('');
  // Sorting and filtering state
  const currentSortOption = ref<SortOption>('order');

  // Additional stats from original currentCollectionState
  const image_count = computed(() => collection.value?.image_count || 0);
  const detection_count = computed(
    () => collection.value?.detection_count || 0,
  );
  const annotated_detection_count = computed(
    () => collection.value?.annotated_detection_count || 0,
  );

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
    imageLocationMap.value.clear();
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

            // Build the image location map after loading the collection
            imageLocationMap.value = buildImageLocationMap();
            console.log(
              `[useCollection] Built image location map with ${imageLocationMap.value.size} entries`,
            );

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

  const selectImage = (imageId: string) => {
    console.log(
      `Selecting image ${imageId} in collection ${collection.value?.id}`,
    );
    if (!imageId) {
      selectedImageId.value = '';
      return;
    }

    // Check if this is just re-selecting the same image
    if (selectedImageId.value === imageId) {
      console.log(
        `[useCollection] Image ${imageId} is already selected, no changes needed`,
      );
      return;
    }

    // Verify image exists in collection
    const image = getImageById.value(imageId);
    if (image) {
      // Just update the selection state without any refreshes
      selectedImageId.value = imageId;
      console.log(`[useCollection] Image ${imageId} selected successfully`);
    } else {
      console.error(
        `[useCollection] Cannot select image ${imageId} - not found in collection`,
      );
    }
  };

  // Reload the current collection
  const reloadCollection = async () => {
    if (collection.value?.id) {
      return await loadCollection(collection.value.id);
    } else {
      console.error('No collection loaded to reload');
      return { error: 'No collection loaded to reload' };
    }
  };

  // Check if the collection is loaded and ready to use
  const isCollectionReady = (collectionId: string): boolean => {
    return (
      loaded.value &&
      collection.value?.id === collectionId &&
      allImagesFlattened.value.length > 0
    );
  };

  // Wait for collection to be ready (useful for race conditions)
  const waitForCollectionReady = async (
    collectionId: string,
    maxWaitMs = 2000,
  ): Promise<boolean> => {
    // If collection is already ready, return immediately
    if (isCollectionReady(collectionId)) {
      return true;
    }

    // If collection is different or not loaded yet, load it
    if (!loaded.value || collection.value?.id !== collectionId) {
      console.log(
        `[useCollection] Collection ${collectionId} not loaded, loading it now`,
      );
      await loadCollection(collectionId);

      // Check again after loading
      if (isCollectionReady(collectionId)) {
        return true;
      }
    }

    // If still not ready, wait for it (images might still be processing)
    console.log(
      `[useCollection] Waiting for collection ${collectionId} to be fully ready`,
    );
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (isCollectionReady(collectionId)) {
          clearInterval(checkInterval);
          console.log(
            `[useCollection] Collection ${collectionId} is now ready`,
          );
          resolve(true);
        } else if (Date.now() - startTime > maxWaitMs) {
          clearInterval(checkInterval);
          console.warn(
            `[useCollection] Timed out waiting for collection ${collectionId} to be ready`,
          );
          resolve(false);
        }
      }, 100);
    });
  };

  // Update a detection in the collection - used to synchronize state with useImage store
  const updateDetectionInCollection = async (
    updatedDetection: DetectionType,
  ) => {
    console.log(
      `[useCollection] Updating detection ${updatedDetection.id} in collection`,
    );

    try {
      // Fetch the latest detection data from the API
      const detectionResponse = await getDetectionById(updatedDetection.id);
      if (detectionResponse.error) {
        console.error(
          `[useCollection] Failed to fetch detection data: ${detectionResponse.error}`,
        );
        return;
      }

      // Find the image containing this detection
      const imageId = updatedDetection.image_id;
      const allDetectionsInImage = await apiGetDetectionsForImage(imageId);
      if (allDetectionsInImage.error) {
        console.error(
          `[useCollection] Failed to fetch detections for image ${imageId}: ${allDetectionsInImage.error}`,
        );
        return;
      }

      // Update the detection count for the image
      const image = allImagesFlattened.value.find((img) => img.id === imageId);
      if (image && allDetectionsInImage.data) {
        image.detection_count = allDetectionsInImage.data.length;
        image.annotated_detection_count = allDetectionsInImage.data.filter(
          (detection) => detection.annotated,
        ).length;
        image.confidence =
          allDetectionsInImage.data.reduce(
            (sum, detection) => sum + (detection.confidence || 0),
            0,
          ) / allDetectionsInImage.data.length;
        image.detections = allDetectionsInImage.data;
      }

      console.log(`[useCollection] Updated image ${imageId} in collection`);
    } catch (error) {
      console.error(
        '[useCollection] Error updating detection in collection:',
        error,
      );
    }
  };

  // Get detections for a specific image from the API
  const getDetectionsForImage = async (imageId: string) => {
    try {
      console.log(`[useCollection] Fetching detections for image ${imageId}`);

      const response = await apiGetDetectionsForImage(imageId);
      if (response.error) {
        console.error(
          `[useCollection] Error fetching detections: ${response.error}`,
        );
        return { success: false, error: response.error, data: null };
      }

      return { success: true, error: '', data: response.data };
    } catch (error) {
      console.error('[useCollection] Error in getDetectionsForImage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  };

  // Create a map of all images with their locations in the collection structure
  const buildImageLocationMap = () => {
    const map = new Map<string, ImageLocation>();

    if (!collection.value?.global_structure) return map;

    // Helper function to add image-section mappings recursively
    // Using any type to avoid type errors with the collection structure
    const processSection = (section: any, path: string[] = []) => {
      // Add images from this section
      if (section.images && Array.isArray(section.images)) {
        section.images.forEach((image: any, index: number) => {
          map.set(image.id, {
            sectionId: section.id,
            parentIds: [...path],
            index,
            image,
          });
        });
      }

      // Process children recursively
      if (section.children && Array.isArray(section.children)) {
        section.children.forEach((child: any) => {
          processSection(child, [...path, section.id]);
        });
      }
    };

    // Handle the global structure first (top level)
    if (
      collection.value.global_structure.images &&
      Array.isArray(collection.value.global_structure.images)
    ) {
      collection.value.global_structure.images.forEach(
        (image: any, index: number) => {
          map.set(image.id, {
            sectionId: 'global',
            parentIds: [],
            index,
            image,
          });
        },
      );
    }

    // Process children of global structure
    if (
      collection.value.global_structure.children &&
      Array.isArray(collection.value.global_structure.children)
    ) {
      collection.value.global_structure.children.forEach((child: any) => {
        processSection(child, ['global']);
      });
    }

    return map;
  };

  // Get an image with its location info
  const getImageLocation = (imageId: string): ImageLocation | undefined => {
    return imageLocationMap.value.get(imageId);
  };

  // Update an image directly in its original location in the collection structure
  const updateImageDirectly = (
    imageId: string,
    updatedImageData: Partial<HierarchicalImage>,
  ): boolean => {
    const location = imageLocationMap.value.get(imageId);
    if (!location) {
      console.warn(
        `[useCollection] Image ${imageId} location not found in map`,
      );
      return false;
    }

    try {
      // Get the section based on the location info
      let targetSection: any = null;

      // Handle global section
      if (
        location.sectionId === 'global' &&
        collection.value?.global_structure
      ) {
        targetSection = collection.value.global_structure;
      }
      // Handle nested sections
      else if (collection.value?.global_structure) {
        // Start with global structure
        let currentSection: any = collection.value.global_structure;

        // Follow the path to find the target section
        for (const parentId of location.parentIds) {
          if (parentId === 'global') continue; // Skip global marker

          // Find the child section matching this parent ID
          if (
            !currentSection.children ||
            !Array.isArray(currentSection.children)
          ) {
            console.warn(
              `[useCollection] Invalid children array in section path for image ${imageId}`,
            );
            return false;
          }

          const nextSection = currentSection.children.find(
            (child: any) => child.id === parentId,
          );
          if (!nextSection) {
            console.warn(
              `[useCollection] Could not find section ${parentId} in path for image ${imageId}`,
            );
            return false;
          }

          currentSection = nextSection;
        }

        // Find the target section (the one containing our image)
        if (currentSection.id === location.sectionId) {
          targetSection = currentSection;
        } else if (
          currentSection.children &&
          Array.isArray(currentSection.children)
        ) {
          const foundSection = currentSection.children.find(
            (child: any) => child.id === location.sectionId,
          );
          if (foundSection) {
            targetSection = foundSection;
          }
        }
      }

      // Update the image if we found the containing section
      if (
        targetSection &&
        targetSection.images &&
        Array.isArray(targetSection.images) &&
        location.index >= 0 &&
        location.index < targetSection.images.length
      ) {
        // Update the image at the specified index
        targetSection.images[location.index] = {
          ...targetSection.images[location.index],
          ...updatedImageData,
        };

        // Also update the mapped reference
        location.image = {
          ...location.image,
          ...updatedImageData,
        };

        console.log(
          `[useCollection] Directly updated image ${imageId} in collection structure`,
        );
        return true;
      } else {
        console.warn(
          `[useCollection] Could not find valid target section or image for ${imageId}`,
        );
        return false;
      }
    } catch (error) {
      console.error('[useCollection] Error updating image directly:', error);
      return false;
    }
  };

  // Update an image in the collection with new data (now using direct update)
  const updateImageInCollection = async (
    imageId: string,
    updatedImageData: UpdatedImageData,
  ) => {
    try {
      console.log(`[useCollection] Updating image ${imageId} in collection`);

      // Use the direct update method first

      return updateImageDirectly(imageId, updatedImageData);
    } catch (error) {
      console.error(
        '[useCollection] Error updating image in collection:',
        error,
      );
      return false;
    }
  };

  // Update a detection with a meta role
  const updateDetectionWithMetaRole = async (
    detectionId: string,
    metaRoleId: string,
    value: string,
  ) => {
    try {
      console.log(
        `[useCollection] Updating detection ${detectionId} with metaRoleId: ${metaRoleId}, value: ${value}`,
      );

      // Get the current detection data
      const detectionResponse = await getDetectionById(detectionId);
      if (detectionResponse.error || !detectionResponse.data) {
        console.error(
          `[useCollection] Error fetching detection: ${detectionResponse.error}`,
        );
        return {
          success: false,
          error: detectionResponse.error || 'Detection not found',
        };
      }

      const detection = detectionResponse.data;

      // Check if we're just confirming the detection without changing values
      const isConfirmingOnly =
        detection.value === value && detection.computed_type === metaRoleId;

      let success = false;
      let error = '';

      if (isConfirmingOnly) {
        // We're just confirming the detection - use a simpler API call
        console.log(
          `[useCollection] Just confirming detection ${detectionId} without changes`,
        );

        // Create update payload with valid fields
        // Use the confirmDetection API endpoint if available
        const updatePayload = {
          id: detection.id,
          annotated: true,
          confidence: 1.0,
          value: detection.value,
          image_id: detection.image_id,
          // Convert x,y,width,height to bbox string format if needed by the API
          x: detection.x,
          y: detection.y,
          width: detection.width,
          height: detection.height,
        };

        // Simple PUT request to update just those fields
        const response = await apiUpdateDetection(updatePayload);

        if (response.error) {
          console.error(
            `[useCollection] Error confirming detection: ${response.error}`,
          );
          error = response.error;
          success = false;
        } else {
          console.log(
            `[useCollection] Successfully confirmed detection ${detectionId}`,
          );
          success = true;
        }
      } else {
        // We're changing values - use the meta role update endpoint
        console.log(
          `[useCollection] Updating detection ${detectionId} with new values`,
        );

        // Call API to update the detection
        const response = await apiUpdateDetectionWithMetaRole(
          detectionId,
          metaRoleId,
          value,
        );

        if (!response.success || response.error) {
          console.error(
            `[useCollection] Error updating detection with meta role: ${response.error}`,
          );
          error = response.error || 'Unknown error';
          success = false;
        } else {
          console.log(
            `[useCollection] Successfully updated detection ${detectionId} with meta role ${metaRoleId}`,
          );
          success = true;
        }
      }

      // If the update was successful, update the image in the collection
      if (success && detection.image_id) {
        // Get all detections for this image to update counts
        const detections = await apiGetDetectionsForImage(detection.image_id);
        if (detections.data) {
          // Find the image in our collection
          const imageUpdateData = {
            detection_count: detections.data.length,
            annotated_detection_count: detections.data.filter(
              (d) => d.annotated,
            ).length,
          };

          // Update the image in the collection
          await updateImageInCollection(detection.image_id, imageUpdateData);
        }
      }

      return { success, error };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(
        `[useCollection] Error updating detection with meta role: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  };

  return {
    collection,
    collectionMetaRoles,
    loaded,
    error,
    loading,
    expandedSections,
    selectedImageId,
    imageLocationMap,
    image_count,
    detection_count,
    annotated_detection_count,
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
    reloadCollection,
    hasSectionChildren,
    getChildrenMetaElements,
    toggleSection,
    isSectionExpanded,
    expandAllSections,
    collapseAllSections,
    selectImage,
    isCollectionReady,
    waitForCollectionReady,
    updateDetectionInCollection,
    getDetectionsForImage,
    updateImageInCollection,
    updateDetectionWithMetaRole,
    getImageLocation,
    updateImageDirectly,
  };
});
