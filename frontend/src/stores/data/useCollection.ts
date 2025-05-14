import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  CollectionHierarchical,
  MetaRole,
  MetaElementHierarchical,
  ImageDA,
} from 'src/types/data-access';
import { getMetaRolesForCollection } from 'src/api/metaRoleApiService';
import {
  collectionApi,
  getDetectionsForImage as apiGetDetectionsForImage,
} from 'src/api';
import { DetectionType } from './types';
import { getDetectionById } from 'src/api/detectionApiService';
import { updateDetectionWithMetaRole as apiUpdateDetectionWithMetaRole } from 'src/api/imageApiNew';
import { updateDetection as apiUpdateDetection } from 'src/api/imageApiNew';
import { ApiResponse } from 'src/types';

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
  height?: number;
  width?: number;
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

// Add a new interface for the enhanced selected image data
interface SelectedImageData {
  image: HierarchicalImage;
  location: ImageLocation;
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

  // Cache control flag - set to true to disable caching
  const disableCache = ref(false);

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

  // Update the selectedImage computed property to return both image and location info
  const selectedImage = computed((): SelectedImageData | undefined => {
    if (!selectedImageId.value || !collection.value?.global_structure)
      return undefined;

    // Use the image location map to efficiently find the image
    const location = imageLocationMap.value.get(selectedImageId.value);
    console.log(
      '[useCollection] selectedImage',
      selectedImageId.value,
      location,
    );
    if (!location) return undefined;

    // Return the image directly from the collection global structure
    // based on the section and index found in the map
    if (
      location.sectionId === 'global' &&
      collection.value.global_structure.images
    ) {
      // Image is in the top-level global structure
      const index = location.index;
      if (
        index >= 0 &&
        index < collection.value.global_structure.images.length
      ) {
        return {
          image: collection.value.global_structure.images[index],
          location,
        };
      }
    } else {
      // Find the section in the hierarchical sections
      const section = hierarchicalSections.value.find(
        (s) => s.section.id === location.sectionId,
      );
      if (
        section &&
        section.section.images &&
        location.index >= 0 &&
        location.index < section.section.images.length
      ) {
        return {
          image: section.section.images[location.index],
          location,
        };
      }
    }

    return undefined;
  });

  // Helper functions
  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };
  const init = async () => {};

  // Cache for section lookups to avoid repeated searches
  const sectionCache = ref(new Map<string, HierarchicalSection>());

  // Function to delete a detection from an image in the collection
  const deleteDetectionFromImage = (
    imageId: string,
    detectionId: string,
    providedLocation?: ImageLocation,
  ): boolean => {
    const startTime = performance.now();
    console.time(`deleteDetection:${detectionId}`);

    // Fast path: we need imageId, detectionId and a valid collection
    if (!imageId || !detectionId || !collection.value) {
      console.timeEnd(`deleteDetection:${detectionId}`);
      return false;
    }

    // Fast path: Direct access via provided location
    const locationLookupStart = performance.now();
    const location = providedLocation || imageLocationMap.value.get(imageId);
    const locationLookupTime = performance.now() - locationLookupStart;
    console.log(
      `[PERF] Location lookup took: ${locationLookupTime.toFixed(2)}ms`,
    );

    if (!location) {
      console.log(`[PERF] Failed to find location for image ${imageId}`);
      console.timeEnd(`deleteDetection:${detectionId}`);
      return false;
    }

    try {
      console.log(
        `[PERF] Using location: section=${location.sectionId}, index=${location.index}, path=${location.parentIds.join('/')}`,
      );

      // Direct access to the image using its location
      const imageAccessStart = performance.now();
      let image: HierarchicalImage | undefined;

      // Global images are directly accessible
      if (
        location.sectionId === 'global' &&
        collection.value.global_structure?.images
      ) {
        image = collection.value.global_structure.images[location.index];
        console.log('[PERF] Global section direct access path');
      }
      // Section images require one-step section lookup
      else {
        console.log(`[PERF] Looking up section: ${location.sectionId}`);
        const sectionLookupStart = performance.now();

        // Check section cache first
        let section: HierarchicalSection | undefined;

        // Use cached section if available to avoid repeated searches
        if (sectionCache.value.has(location.sectionId)) {
          section = sectionCache.value.get(location.sectionId);
          console.log('[PERF] Using cached section');
        } else {
          // If section isn't cached, find it and cache for future use
          const sections = hierarchicalSections.value;
          console.log(`[PERF] Total sections to search: ${sections.length}`);

          // Build cache for all sections if we have a large collection
          if (sections.length > 100 && sectionCache.value.size === 0) {
            console.log('[PERF] Building full section cache');
            const cacheBuildStart = performance.now();

            // Add all sections to cache
            for (const s of sections) {
              if (!sectionCache.value.has(s.section.id)) {
                sectionCache.value.set(s.section.id, s);
              }
            }

            console.log(
              `[PERF] Built section cache with ${sectionCache.value.size} entries in ${(performance.now() - cacheBuildStart).toFixed(2)}ms`,
            );
            section = sectionCache.value.get(location.sectionId);
          } else {
            // For smaller collections or if cache is already built
            section = sections.find((s) => s.section.id === location.sectionId);

            // Cache this section for future use
            if (section) {
              sectionCache.value.set(location.sectionId, section);
            }
          }
        }

        console.log(
          `[PERF] Section lookup took: ${(performance.now() - sectionLookupStart).toFixed(2)}ms`,
        );
        console.log(`[PERF] Section found: ${!!section}`);

        // Access the image directly if section exists
        if (section?.section.images) {
          const imageArraySize = section.section.images.length;
          console.log(
            `[PERF] Section has ${imageArraySize} images, accessing index ${location.index}`,
          );

          if (location.index >= 0 && location.index < imageArraySize) {
            image = section.section.images[location.index];
          } else {
            console.log(
              `[PERF] Image index ${location.index} is out of bounds (0-${imageArraySize - 1})`,
            );
          }
        }
      }

      const imageAccessTime = performance.now() - imageAccessStart;
      console.log(`[PERF] Image access took: ${imageAccessTime.toFixed(2)}ms`);

      // Fast failure if image not found
      if (!image) {
        console.log('[PERF] Image not found with the provided location');
        console.timeEnd(`deleteDetection:${detectionId}`);
        return false;
      }

      if (!image.detections) {
        console.log('[PERF] Image has no detections array');
        console.timeEnd(`deleteDetection:${detectionId}`);
        return false;
      }

      // Log detection array details
      console.log(`[PERF] Image has ${image.detections.length} detections`);

      // Direct access to the detection
      const detectionLookupStart = performance.now();
      const detectionIndex = image.detections.findIndex(
        (d) => d.id === detectionId,
      );
      const detectionLookupTime = performance.now() - detectionLookupStart;
      console.log(
        `[PERF] Detection lookup took: ${detectionLookupTime.toFixed(2)}ms, found at index: ${detectionIndex}`,
      );

      if (detectionIndex === -1) {
        console.log(
          `[PERF] Detection ${detectionId} not found in image - likely already deleted`,
        );
        console.timeEnd(`deleteDetection:${detectionId}`);
        // Return true to prevent retry attempts if the detection is already gone
        // This helps with the double-deletion pattern observed in the logs
        return true;
      }

      // Cache annotated state
      const wasAnnotated = image.detections[detectionIndex].annotated;

      // Fast array removal
      const spliceStart = performance.now();
      image.detections.splice(detectionIndex, 1);
      console.log(
        `[PERF] Array splice took: ${(performance.now() - spliceStart).toFixed(2)}ms`,
      );

      // Direct property updates - no heavy calculations
      image.detection_count = image.detections.length;

      // Extremely efficient annotated count update - just decrement
      if (wasAnnotated && typeof image.annotated_detection_count === 'number') {
        image.annotated_detection_count = Math.max(
          0,
          image.annotated_detection_count - 1,
        );
      }

      // Keep location map in sync
      if (location.image) {
        location.image.detection_count = image.detection_count;
        if (
          wasAnnotated &&
          typeof image.annotated_detection_count === 'number'
        ) {
          location.image.annotated_detection_count =
            image.annotated_detection_count;
        }
      }

      const totalTime = performance.now() - startTime;
      console.log(`[PERF] Total deletion time: ${totalTime.toFixed(2)}ms`);
      console.timeEnd(`deleteDetection:${detectionId}`);
      return true;
    } catch (error) {
      console.error(
        '[useCollection] Fast-path detection delete failed:',
        error,
      );
      console.log(
        `[PERF] Function failed after ${(performance.now() - startTime).toFixed(2)}ms`,
      );
      console.timeEnd(`deleteDetection:${detectionId}`);
      return false;
    }
  };

  // Helper to clear the section cache when collection changes
  const clearSectionCache = () => {
    sectionCache.value.clear();
  };

  // Reset state completely
  const resetState = () => {
    collection.value = undefined;
    collectionMetaRoles.value = [];
    loaded.value = false;
    error.value = '';
    loading.value = false;
    expandedSections.value = [];
    imageLocationMap.value.clear();
    clearSectionCache();
  };

  // Toggle cache on/off
  const setDisableCache = (disabled: boolean) => {
    disableCache.value = disabled;
    console.log(
      `[DEBUG-Collection] Cache ${disabled ? 'disabled' : 'enabled'}`,
    );

    // Reset state when disabling cache to ensure fresh data
    if (disabled) {
      console.log('[DEBUG-Collection] Resetting state due to cache disabling');
      resetState();
    }
  };

  // Reload the current collection - KEEP THIS VERSION
  const reloadCollection = async () => {
    console.log('[DEBUG-Collection] reloadCollection called');

    if (collection.value?.id) {
      // Temporarily disable cache to ensure fresh data
      const originalCacheSetting = disableCache.value;
      console.log(
        `[DEBUG-Collection] Original cache setting: ${originalCacheSetting ? 'disabled' : 'enabled'}`,
      );

      // Force disable cache for this reload
      if (!disableCache.value) {
        console.log(
          '[DEBUG-Collection] Temporarily disabling cache for reload',
        );
        disableCache.value = true;
      }

      // Reset the collection state to ensure fresh load
      console.log(
        `[DEBUG-Collection] Resetting state for collection reload: ${collection.value.id}`,
      );
      resetState();

      try {
        // Load the collection from the API
        console.log(
          `[DEBUG-Collection] Loading fresh data for collection: ${collection.value.id}`,
        );
        const result = await loadCollection(collection.value.id);

        // Restore original cache setting
        console.log(
          `[DEBUG-Collection] Restoring cache setting to: ${originalCacheSetting ? 'disabled' : 'enabled'}`,
        );
        disableCache.value = originalCacheSetting;

        // Log some sample data to verify reload
        if (result.data) {
          const totalImages = allImagesFlattened.value.length;
          console.log(
            `[DEBUG-Collection] Reload successful, collection has ${totalImages} images`,
          );

          // Log a sample of image data
          if (totalImages > 0) {
            const sampleImages = allImagesFlattened.value.slice(0, 5);
            console.log(
              '[DEBUG-Collection] Sample images after reload:',
              sampleImages.map((img) => ({
                id: img.id,
                page_index: img.page_index,
                page_type: img.page_type,
              })),
            );
          }
        } else {
          console.error(`[DEBUG-Collection] Reload failed: ${result.error}`);
        }

        return result;
      } catch (error) {
        console.error(
          '[DEBUG-Collection] Exception during collection reload:',
          error,
        );

        // Restore original cache setting even if there's an error
        console.log(
          `[DEBUG-Collection] Restoring cache setting after error to: ${originalCacheSetting ? 'disabled' : 'enabled'}`,
        );
        disableCache.value = originalCacheSetting;

        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      console.error('[DEBUG-Collection] No collection loaded to reload');
      return { error: 'No collection loaded to reload' };
    }
  };

  const loadCollection = async (collectionId: string) => {
    // When cache is disabled, always reset state
    if (disableCache.value || collection.value?.id !== collectionId) {
      console.log(
        `[DEBUG-Collection] Resetting state for collection ${collectionId}`,
      );
      console.log(
        `[DEBUG-Collection] disableCache: ${disableCache.value}, current collection: ${collection.value?.id}`,
      );
      resetState();
    }
    setLoading(true);
    error.value = '';

    console.log(
      `[DEBUG-Collection] Starting API request to load collection ${collectionId}`,
    );
    const requestPromise = new Promise<ApiResponse<CollectionHierarchical>>(
      async (resolve) => {
        try {
          const response =
            await collectionApi.getHierarchicalTree(collectionId);
          console.log(
            `[DEBUG-Collection] Received API response for collection ${collectionId}`,
          );

          if (response.error) {
            error.value = response.error;
            console.error(`[DEBUG-Collection] API error: ${response.error}`);
            resolve({ error: response.error });
          } else if (response.data) {
            collection.value = response.data;
            console.log(
              '[DEBUG-Collection] Hierarchical collection loaded:',
              collection.value?.id,
            );

            // Build the image location map after loading the collection
            imageLocationMap.value = buildImageLocationMap();
            console.log(
              `[DEBUG-Collection] Built image location map with ${imageLocationMap.value.size} entries`,
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

            console.log('[DEBUG-Collection] Loading meta roles for collection');
            const metaRolesResponse =
              await getMetaRolesForCollection(collectionId);
            if (metaRolesResponse.data && metaRolesResponse.data.length > 0) {
              collectionMetaRoles.value = metaRolesResponse.data;
              console.log(
                `[DEBUG-Collection] Loaded ${collectionMetaRoles.value.length} meta roles for collection ${collectionId}`,
              );
            } else if (metaRolesResponse.error) {
              console.error(
                `[DEBUG-Collection] Failed to load meta roles for collection: ${metaRolesResponse.error}`,
              );
            }

            console.log(
              '[DEBUG-Collection] Collection loading process complete',
            );
            resolve({ data: response.data, error: undefined });
          } else {
            const errorMsg = 'No collection data received';
            error.value = errorMsg;
            console.error(`[DEBUG-Collection] ${errorMsg}`);
            resolve({ error: errorMsg });
          }
        } catch (e) {
          const errorMsg = 'Failed to load collection';
          error.value = errorMsg;
          console.error(
            '[DEBUG-Collection] Exception during collection load:',
            e,
          );
          resolve({ error: errorMsg });
        } finally {
          setLoading(false);
          console.log(
            '[DEBUG-Collection] Collection loading process finished (success or failure)',
          );
        }
      },
    );
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

  // Check if the collection is loaded and ready to use
  const isCollectionReady = (collectionId: string): boolean => {
    // When cache is disabled, always return false to force reload
    if (disableCache.value) {
      console.log(
        `[DEBUG-Collection] Cache is disabled, forcing reload of collection ${collectionId}`,
      );
      return false;
    }

    const isReady =
      loaded.value &&
      collection.value?.id === collectionId &&
      allImagesFlattened.value.length > 0;

    console.log(
      `[DEBUG-Collection] Collection ${collectionId} ready check: ${isReady}`,
    );
    console.log(`[DEBUG-Collection] - loaded: ${loaded.value}`);
    console.log(
      `[DEBUG-Collection] - current collection: ${collection.value?.id}`,
    );
    console.log(
      `[DEBUG-Collection] - image count: ${allImagesFlattened.value.length}`,
    );
    return isReady;
  };

  // Wait for collection to be ready (useful for race conditions)
  const waitForCollectionReady = async (
    collectionId: string,
    maxWaitMs = 2000,
  ): Promise<boolean> => {
    // If collection is already ready, return immediately
    if (isCollectionReady(collectionId)) {
      console.log(
        `[DEBUG-Collection] Collection ${collectionId} is already ready`,
      );
      return true;
    }

    // If collection is different or not loaded yet, load it
    if (!loaded.value || collection.value?.id !== collectionId) {
      console.log(
        `[DEBUG-Collection] Collection ${collectionId} not loaded, loading it now`,
      );
      await loadCollection(collectionId);

      // Check again after loading
      if (isCollectionReady(collectionId)) {
        console.log(
          `[DEBUG-Collection] Collection ${collectionId} is now ready after loading`,
        );
        return true;
      }
    }

    // If still not ready, wait for it (images might still be processing)
    console.log(
      `[DEBUG-Collection] Waiting for collection ${collectionId} to be fully ready`,
    );
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (isCollectionReady(collectionId)) {
          clearInterval(checkInterval);
          console.log(
            `[DEBUG-Collection] Collection ${collectionId} is now ready after waiting`,
          );
          resolve(true);
        } else if (Date.now() - startTime > maxWaitMs) {
          clearInterval(checkInterval);
          console.warn(
            `[DEBUG-Collection] Timed out waiting for collection ${collectionId} to be ready`,
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
    // Using a proper type for sections in the collection structure
    const processSection = (
      section: MetaElementHierarchical,
      path: string[] = [],
    ) => {
      // Add images from this section
      if (section.images && Array.isArray(section.images)) {
        section.images.forEach((image: ImageDA, index: number) => {
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
        section.children.forEach((child: MetaElementHierarchical) => {
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
        (image: ImageDA, index: number) => {
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
      collection.value.global_structure.children.forEach(
        (child: MetaElementHierarchical) => {
          processSection(child, ['global']);
        },
      );
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

    console.log(
      `[DEBUG-Collection] Directly updating image ${imageId} with:`,
      JSON.stringify(updatedImageData),
    );
    console.log(
      '[DEBUG-Collection] Image location:',
      JSON.stringify({
        sectionId: location.sectionId,
        index: location.index,
        parentIds: location.parentIds,
      }),
    );

    try {
      // Get the section based on the location info
      let targetSection: MetaElementHierarchical | null = null;

      // Handle global section
      if (
        location.sectionId === 'global' &&
        collection.value?.global_structure
      ) {
        targetSection = collection.value.global_structure;
        console.log('[DEBUG-Collection] Target is global section');
      }
      // Handle nested sections
      else if (collection.value?.global_structure) {
        // Start with global structure
        let currentSection: MetaElementHierarchical =
          collection.value.global_structure;

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
            (child: MetaElementHierarchical) => child.id === parentId,
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
          console.log(
            `[DEBUG-Collection] Found target section: ${targetSection.id}`,
          );
        } else if (
          currentSection.children &&
          Array.isArray(currentSection.children)
        ) {
          const foundSection = currentSection.children.find(
            (child: MetaElementHierarchical) => child.id === location.sectionId,
          );
          if (foundSection) {
            targetSection = foundSection;
            console.log(
              `[DEBUG-Collection] Found target section in children: ${targetSection.id}`,
            );
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
        // Get the current image to preserve required type fields
        const currentImage = targetSection.images[location.index];

        console.log('[DEBUG-Collection] Current image data before update:', {
          id: currentImage.id,
          page_index: currentImage.page_index || '(none)',
          page_type: currentImage.page_type || '(none)',
        });

        // Create new image object to ensure reactivity
        const updatedImage = {
          ...currentImage, // Keep all existing properties
          ...updatedImageData, // Apply updates
          // Explicitly ensure detections are preserved with their hierarchical structure
          detections: currentImage.detections,
        };

        // Force reactive update by recreating the images array
        targetSection.images = [
          ...targetSection.images.slice(0, location.index),
          updatedImage,
          ...targetSection.images.slice(location.index + 1),
        ];

        // Update the location map reference
        location.image = {
          ...location.image,
          ...updatedImageData,
        };

        console.log(
          `[DEBUG-Collection] Successfully updated image ${imageId} in collection structure`,
          {
            id: updatedImage.id,
            page_index: updatedImage.page_index || '(none)',
            page_type: updatedImage.page_type || '(none)',
            timestamp: Date.now(),
          },
        );

        // Force update of reactive properties for UI components to recognize the change
        if (collection.value) {
          // Recreate collection to ensure reactivity (Vue might not detect deep changes)
          collection.value = { ...collection.value };
          console.log('[DEBUG-Collection] Forced collection reactivity update');
        }

        return true;
      } else {
        console.warn(
          `[DEBUG-Collection] Could not find valid target section or image for ${imageId}`,
        );
        return false;
      }
    } catch (error) {
      console.error('[DEBUG-Collection] Error updating image directly:', error);
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

  // Add a new helper function to modify an image directly using just the image data
  const modifyImageInStructure = (
    imageData: HierarchicalImage,
    providedLocation?: ImageLocation,
  ): boolean => {
    if (!imageData.id || !collection.value?.global_structure) {
      console.warn(
        '[useCollection] Invalid image data or collection structure',
      );
      return false;
    }

    // Use provided location if available (faster) or look it up otherwise
    const location =
      providedLocation || imageLocationMap.value.get(imageData.id);
    if (!location) {
      console.warn(
        `[useCollection] Image ${imageData.id} location not found in map`,
      );
      return false;
    }

    // Get reference to the containing section
    let targetSection: MetaElementHierarchical | null = null;

    // Handle global section
    if (location.sectionId === 'global') {
      targetSection = collection.value.global_structure;
    } else {
      // Navigate to the target section using the location info
      const sectionData = hierarchicalSections.value.find(
        (s) => s.section.id === location.sectionId,
      );
      if (sectionData) {
        targetSection = sectionData.section;
      }
    }

    // Update the image if we found the section
    if (
      targetSection?.images &&
      Array.isArray(targetSection.images) &&
      location.index >= 0 &&
      location.index < targetSection.images.length
    ) {
      try {
        // Use updateImageDirectly which already handles type compatibility
        // This is our safer approach to just update specific fields
        const result = updateImageDirectly(imageData.id, {
          name: imageData.name,
          confidence: imageData.confidence,
          order: imageData.order,
          annotated: imageData.annotated,
          detection_count: imageData.detection_count,
          annotated_detection_count: imageData.annotated_detection_count,
          page_index: imageData.page_index,
          page_index_confidence: imageData.page_index_confidence,
          page_type: imageData.page_type,
          page_type_confidence: imageData.page_type_confidence,
          // Only include height/width if defined to avoid type issues
          ...(imageData.height !== undefined
            ? { height: imageData.height }
            : {}),
          ...(imageData.width !== undefined ? { width: imageData.width } : {}),
        });

        if (result) {
          console.log(
            `[useCollection] Image ${imageData.id} updated in collection structure`,
          );
          return true;
        }
      } catch (error) {
        console.error('[useCollection] Error updating image:', error);
      }
    }

    console.warn(
      `[useCollection] Failed to update image ${imageData.id} in collection structure`,
    );
    return false;
  };

  // Add a new helper function to modify a single detection in an image
  const modifyDetectionInImage = (
    imageId: string,
    detectionId: string,
    updatedDetection: Partial<DetectionType>,
    providedLocation?: ImageLocation,
  ): boolean => {
    if (!imageId || !detectionId || !collection.value?.global_structure) {
      console.warn(
        '[useCollection] Invalid image/detection data or collection structure',
      );
      return false;
    }

    // Use provided location if available (faster) or look it up otherwise
    const location = providedLocation || imageLocationMap.value.get(imageId);
    if (!location) {
      console.warn(
        `[useCollection] Image ${imageId} location not found in map`,
      );
      return false;
    }

    // Get reference to the containing section
    let targetSection: MetaElementHierarchical | null = null;

    // Handle global section
    if (location.sectionId === 'global') {
      targetSection = collection.value.global_structure;
    } else {
      // Navigate to the target section using the location info
      const sectionData = hierarchicalSections.value.find(
        (s) => s.section.id === location.sectionId,
      );
      if (sectionData) {
        targetSection = sectionData.section;
      }
    }

    // Find the image in the section
    if (
      targetSection?.images &&
      Array.isArray(targetSection.images) &&
      location.index >= 0 &&
      location.index < targetSection.images.length
    ) {
      try {
        // Get the image
        const image = targetSection.images[location.index];

        // Make sure the image has detections array
        if (!image.detections || !Array.isArray(image.detections)) {
          console.warn(
            `[useCollection] Image ${imageId} has no detections array`,
          );
          return false;
        }

        // Find the detection to update
        const detectionIndex = image.detections.findIndex(
          (detection) => detection.id === detectionId,
        );

        if (detectionIndex === -1) {
          console.warn(
            `[useCollection] Detection ${detectionId} not found in image ${imageId}`,
          );
          return false;
        }

        // Update the detection
        const currentDetection = image.detections[detectionIndex];
        image.detections[detectionIndex] = {
          ...currentDetection,
          ...updatedDetection,
          // Ensure last_change is updated
          last_change: new Date().toISOString(),
        };

        // If we're updating the detection's annotated status, also update the image's counts
        if (updatedDetection.annotated !== undefined) {
          // Count annotated detections
          const annotatedCount = image.detections.filter(
            (d) => d.annotated,
          ).length;
          image.annotated_detection_count = annotatedCount;

          // Update location map reference
          if (location.image) {
            location.image.annotated_detection_count = annotatedCount;
          }
        }

        console.log(
          `[useCollection] Detection ${detectionId} updated in image ${imageId}`,
        );
        return true;
      } catch (error) {
        console.error('[useCollection] Error updating detection:', error);
        return false;
      }
    }

    console.warn(
      `[useCollection] Failed to update detection ${detectionId} in image ${imageId}`,
    );
    return false;
  };

  // Function to add a new detection to an image in the collection
  const addDetectionToImage = (
    imageId: string,
    newDetection: DetectionType,
    providedLocation?: ImageLocation,
  ): boolean => {
    if (!imageId || !newDetection || !collection.value?.global_structure) {
      console.warn(
        '[useCollection] Invalid image/detection data or collection structure',
      );
      return false;
    }

    // Use provided location if available (faster) or look it up otherwise
    const location = providedLocation || imageLocationMap.value.get(imageId);
    if (!location) {
      console.warn(
        `[useCollection] Image ${imageId} location not found in map`,
      );
      return false;
    }

    // Get reference to the containing section
    let targetSection: MetaElementHierarchical | null = null;

    // Handle global section
    if (location.sectionId === 'global') {
      targetSection = collection.value.global_structure;
    } else {
      // Navigate to the target section using the location info
      const sectionData = hierarchicalSections.value.find(
        (s) => s.section.id === location.sectionId,
      );
      if (sectionData) {
        targetSection = sectionData.section;
      }
    }

    // Find the image in the section
    if (
      targetSection?.images &&
      Array.isArray(targetSection.images) &&
      location.index >= 0 &&
      location.index < targetSection.images.length
    ) {
      try {
        // Get the image
        const image = targetSection.images[location.index];

        // Initialize detections array if needed
        if (!image.detections) {
          image.detections = [];
        } else if (!Array.isArray(image.detections)) {
          console.warn(
            `[useCollection] Image ${imageId} has invalid detections property`,
          );
          return false;
        }

        // Make sure the detection has an id and image_id (required fields)
        if (!newDetection.id) {
          console.warn('[useCollection] New detection must have an id');
          return false;
        }

        // Ensure detection has the correct image_id
        const detectionToAdd = {
          ...newDetection,
          image_id: imageId,
          // Ensure last_change and other required timestamp fields
          last_change: new Date().toISOString(),
          created_date: newDetection.created_date || new Date().toISOString(),
          last_access: newDetection.last_access || new Date().toISOString(),
        };

        // Add the detection
        image.detections.push(detectionToAdd);

        // Update counts
        image.detection_count = image.detections.length;

        // Update annotated count if needed
        if (detectionToAdd.annotated) {
          const annotatedCount = image.detections.filter(
            (d) => d.annotated,
          ).length;
          image.annotated_detection_count = annotatedCount;
        }

        // Update location map reference
        if (location.image) {
          location.image.detection_count = image.detection_count;
          if (detectionToAdd.annotated) {
            location.image.annotated_detection_count =
              image.annotated_detection_count;
          }
        }

        console.log(
          `[useCollection] Detection ${detectionToAdd.id} added to image ${imageId}`,
        );
        return true;
      } catch (error) {
        console.error('[useCollection] Error adding detection:', error);
        return false;
      }
    }

    console.warn(`[useCollection] Failed to add detection to image ${imageId}`);
    return false;
  };

  return {
    collection,
    collectionMetaRoles,
    loaded,
    error,
    loading,
    expandedSections,
    selectedImageId,
    selectedImage,
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
    modifyImageInStructure,
    modifyDetectionInImage,
    deleteDetectionFromImage,
    addDetectionToImage,
    disableCache,
    setDisableCache,
  };
});
