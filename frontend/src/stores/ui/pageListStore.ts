import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import {
  useCollection,
  SortOption as CollectionSortOption,
  HierarchicalImage,
} from 'src/stores/data/useCollection';
import {
  updateImagePageType,
  updateImagePageIndex,
  verifyPageIndexUpdate,
} from 'src/api/imageApiNew';

// Confidence thresholds as constants (not reactive)
const LOW_CONFIDENCE_THRESHOLD = 0.7; // 70% confidence
const MEDIUM_CONFIDENCE_THRESHOLD = 0.9; // 90% confidence

// Type definitions
export type SortOption = CollectionSortOption;

export type VerificationFilter = 'all' | 'verified' | 'unverified';
export type ViewMode = 'list-small' | 'list-large' | 'grid';

interface ConfidenceFilters {
  low: boolean;
  medium: boolean;
  high: boolean;
}

export const usePageListStore = defineStore('pageList', () => {
  // Access to collection data - using only useCollection
  const collectionStore = useCollection();

  // ======== VIEW SETTINGS ========
  const viewMode = ref<ViewMode>('list-large');
  const gridColumns = ref(4);

  // ======== SELECTION STATE ========
  const selectedImages = ref<string[]>([]);
  const selectMode = ref(false);
  const lastSelectedImageId = ref<string | null>(null);

  // ======== FILTER STATE ========
  const searchQuery = ref('');
  const sortBy = ref<SortOption>('order');
  const filterVerified = ref<VerificationFilter>('all');
  const confidenceFilters = ref<ConfidenceFilters>({
    low: false,
    medium: false,
    high: false,
  });

  // Add a reactive debounce flag to control expensive computation timing
  const isFilterProcessing = ref(false);
  // Keep track of whether filters have been applied but not processed
  const pendingFilterUpdate = ref(false);

  // Create a debounce wrapper for expensive operations
  const debounceOperation = <T extends (...args: unknown[]) => void>(
    callback: T,
    delay = 100,
  ) => {
    let timeoutId: number | null = null;

    return (...args: Parameters<T>) => {
      isFilterProcessing.value = true;
      pendingFilterUpdate.value = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        callback(...args);
        isFilterProcessing.value = false;
        pendingFilterUpdate.value = false;
      }, delay);
    };
  };

  // ======== COMPUTED PROPERTIES ========

  // Add a last-filter-change timestamp to optimize updates
  const lastFilterChange = ref(Date.now());

  // Update timestamp when filters change
  const updateFilterTimestamp = () => {
    lastFilterChange.value = Date.now();
    pendingFilterUpdate.value = true;

    // Debounce the operation to prevent too many updates
    debouncedProcessFilters();
  };

  // Debounced processor for filter changes
  const debouncedProcessFilters = debounceOperation(() => {
    // This is intentionally empty - just updating the timestamp
    // will trigger the computed to recalculate
    console.log('Processed filter changes at', new Date().toISOString());
  }, 200);

  // Watch for filter changes
  watch(
    [searchQuery, filterVerified, confidenceFilters, sortBy],
    () => {
      updateFilterTimestamp();
    },
    { deep: true },
  );

  // Create a memoized filter function
  const filterCache = new Map<string, HierarchicalImage[]>();

  // Helper function to generate a cache key based on current filters
  const getFilterCacheKey = () => {
    return `${searchQuery.value}-${filterVerified.value}-${JSON.stringify(confidenceFilters.value)}-${sortBy.value}-${lastFilterChange.value}`;
  };

  // ======== UI OPTIONS ========
  // These options don't need to be reactive since they're constant
  const sortOptions = [
    { label: 'Order', value: 'order' },
    { label: 'Name (A-Z)', value: 'name_asc' },
    { label: 'Name (Z-A)', value: 'name_desc' },
    { label: 'Newest first', value: 'date_desc' },
    { label: 'Oldest first', value: 'date_asc' },
    { label: 'Confidence (Low to High)', value: 'confidence_asc' },
    { label: 'Confidence (High to Low)', value: 'confidence_desc' },
    { label: 'Most Detections', value: 'detection_count_desc' },
  ];

  const verificationOptions = [
    { label: 'All verification', value: 'all' },
    { label: 'Verified only', value: 'verified' },
    { label: 'Unverified only', value: 'unverified' },
  ];

  const confidenceOptions = [
    { label: 'Low', value: 'low', color: 'red' },
    { label: 'Medium', value: 'medium', color: 'orange' },
    { label: 'High', value: 'high', color: 'green' },
  ];

  const viewModeOptions = [
    { value: 'list-small', icon: 'view_list', label: 'Compact' },
    { value: 'list-large', icon: 'view_headline', label: 'Details' },
    { value: 'grid', icon: 'grid_view', label: 'Grid' },
  ];

  const gridColumnOptions = [2, 3, 4, 6, 8, 10];

  // ======== HELPER FUNCTIONS ========
  // These are extracted as pure functions for better performance

  // Check if image has low confidence detections
  function hasLowConfidenceDetections(imageId: string): boolean {
    const image = collectionStore.getImageById(imageId);
    if (!image) return false;

    // Check confidence directly
    return (
      image.confidence !== undefined &&
      image.confidence < LOW_CONFIDENCE_THRESHOLD
    );
  }

  // Check if image has medium confidence detections
  function hasMediumConfidenceDetections(imageId: string): boolean {
    const image = collectionStore.getImageById(imageId);
    if (!image) return false;

    // If confidence is undefined or below low threshold, it's not medium
    if (
      image.confidence === undefined ||
      image.confidence < LOW_CONFIDENCE_THRESHOLD
    ) {
      return false;
    }

    // Check if confidence is between low and medium thresholds
    return (
      image.confidence >= LOW_CONFIDENCE_THRESHOLD &&
      image.confidence < MEDIUM_CONFIDENCE_THRESHOLD
    );
  }

  // Get confidence level label
  function getConfidenceLevel(imageId: string): string {
    if (hasLowConfidenceDetections(imageId)) {
      return 'low';
    } else if (hasMediumConfidenceDetections(imageId)) {
      return 'medium';
    }
    return 'high';
  }

  // Check if image has unverified detections
  function hasUnverifiedDetections(imageId: string): boolean {
    const image = collectionStore.getImageById(imageId);
    if (!image) return false;

    // Check annotated property
    return image.annotated !== true;
  }

  // Get image verification status
  function getVerificationStatus(imageId: string): string {
    const image = collectionStore.getImageById(imageId);
    if (!image) return 'unverified';

    // If the image is fully annotated, it's verified
    if (image.annotated === true) {
      return 'verified';
    }

    // Check for partial verification (if available)
    if (image.annotated_detection_count && image.detection_count) {
      if (
        image.annotated_detection_count > 0 &&
        image.annotated_detection_count < image.detection_count
      ) {
        return 'partial';
      }
    }

    return 'unverified';
  }

  // Get verification status color
  function getVerificationStatusColor(imageId: string): string {
    const status = getVerificationStatus(imageId);
    const confidenceLevel = getConfidenceLevel(imageId);

    // If low confidence, always show red regardless of verification status
    if (confidenceLevel === 'low') {
      return 'red-8';
    }

    // Otherwise, color based on verification status
    if (status === 'verified') return 'green-8';
    if (status === 'partial') return 'orange-8';
    return 'grey-7';
  }

  // Get tooltip text for verification status
  function getVerificationTooltip(imageId: string): string {
    const status = getVerificationStatus(imageId);
    const confidenceLevel = getConfidenceLevel(imageId);

    let tooltip = '';

    // Add verification status
    if (status === 'verified') tooltip += 'All annotations verified';
    else if (status === 'partial') tooltip += 'Some annotations verified';
    else tooltip += 'No annotations verified';

    // Add confidence level if not high
    if (confidenceLevel === 'low') {
      tooltip += '\nLow confidence (&lt; 70%)';
    } else if (confidenceLevel === 'medium') {
      tooltip += '\nMedium confidence (70-90%)';
    }

    return tooltip;
  }

  // Need attention if: has unverified detections OR has low confidence detections
  function needsAttention(imageId: string): boolean {
    return (
      hasUnverifiedDetections(imageId) || hasLowConfidenceDetections(imageId)
    );
  }

  // Get attention level (0-10, higher means more urgent attention needed)
  function getAttentionLevel(imageId: string): number {
    const image = collectionStore.getImageById(imageId);
    if (!image) return 0;

    if (hasLowConfidenceDetections(imageId)) {
      return 10; // Highest priority - low confidence
    } else if (hasUnverifiedDetections(imageId)) {
      return 7; // High priority - unverified detections
    } else if (hasMediumConfidenceDetections(imageId)) {
      return 4; // Medium priority - medium confidence
    }
    return 0; // No attention needed
  }

  // Map color names to hex values - non-reactive helper function
  function getColorValue(colorName: string): string {
    const colorMap: Record<string, string> = {
      red: '#F44336',
      orange: '#FF9800',
      green: '#4CAF50',
      'grey-5': '#9E9E9E',
    };

    return colorMap[colorName] || '#9E9E9E';
  }

  // ======== COMPUTED PROPERTIES ========

  // Filtered images based on current filters - main computed property
  const filteredImages = computed(() => {
    // If we're processing, return the last known result
    if (isFilterProcessing.value && filterCache.size > 0) {
      // Return the last computed result while processing
      const lastResult = Array.from(filterCache.values())[filterCache.size - 1];
      return lastResult;
    }

    const cacheKey = getFilterCacheKey();

    // Check if result is already cached
    if (filterCache.has(cacheKey)) {
      return filterCache.get(cacheKey) as HierarchicalImage[];
    }

    console.time('filter-operation');

    // Get all images from the hierarchical structure
    let images = collectionStore.allImagesFlattened;
    if (!images.length) {
      console.timeEnd('filter-operation');
      filterCache.set(cacheKey, []);
      return [];
    }

    // Apply search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      images = images.filter(
        (img) =>
          img.name.toLowerCase().includes(query) ||
          img.id.toLowerCase().includes(query),
      );
    }

    // Apply verification filter
    if (filterVerified.value !== 'all') {
      images = images.filter((img) => {
        const verificationStatus = getVerificationStatus(img.id);
        return verificationStatus === filterVerified.value;
      });
    }

    // Apply confidence filters
    const hasAnyConfidenceFilter =
      confidenceFilters.value.low ||
      confidenceFilters.value.medium ||
      confidenceFilters.value.high;

    if (hasAnyConfidenceFilter) {
      images = images.filter((img) => {
        const hasLow = hasLowConfidenceDetections(img.id);
        const hasMedium = hasMediumConfidenceDetections(img.id);
        const hasHigh = !hasLow && !hasMedium;

        if (confidenceFilters.value.low && hasLow) {
          return true;
        }
        if (confidenceFilters.value.medium && hasMedium) {
          return true;
        }
        if (confidenceFilters.value.high && hasHigh) {
          return true;
        }
        return false;
      });
    }

    // Sort images using the collection store's sorter
    const result = collectionStore.getSortedImages(images, sortBy.value);

    // Cache the result
    filterCache.set(cacheKey, result);

    // Limit cache size to prevent memory issues
    if (filterCache.size > 10) {
      // Remove oldest entries
      const keys = Array.from(filterCache.keys());
      filterCache.delete(keys[0]);
    }

    console.timeEnd('filter-operation');
    return result;
  });

  // Statistics for the current collection
  const statistics = computed(() => {
    const images = collectionStore.allImagesFlattened;
    if (!images.length) {
      return {
        total: 0,
        needsAttention: 0,
        lowConfidence: 0,
        mediumConfidence: 0,
        unverified: 0,
        verified: 0,
        partial: 0,
      };
    }

    const needsAttentionCount = images.filter((img) =>
      needsAttention(img.id),
    ).length;
    const lowConfidence = images.filter((img) =>
      hasLowConfidenceDetections(img.id),
    ).length;
    const mediumConfidence = images.filter((img) =>
      hasMediumConfidenceDetections(img.id),
    ).length;
    const unverified = images.filter((img) =>
      hasUnverifiedDetections(img.id),
    ).length;
    const verified = images.filter(
      (img) => getVerificationStatus(img.id) === 'verified',
    ).length;
    const partial = images.filter(
      (img) => getVerificationStatus(img.id) === 'partial',
    ).length;

    return {
      total: images.length,
      needsAttention: needsAttentionCount,
      lowConfidence,
      mediumConfidence,
      unverified,
      verified,
      partial,
    };
  });

  // ======== ACTIONS ========

  // Filter images within a section using the collection store getter
  function filterImagesInSection<T extends { id: string; name: string }>(
    sectionImages: T[],
  ) {
    if (
      !sectionImages ||
      !Array.isArray(sectionImages) ||
      sectionImages.length === 0
    )
      return [];

    // Get the section ID from the first image (assuming all images are from the same section)
    const firstImage = sectionImages[0];
    const image = collectionStore.getImageById(firstImage.id);
    if (!image) return [];

    // Ensure we have a valid sectionId by checking the first image in the collection
    const sectionId = image?.id ? image.id.split('_')[0] : '';
    if (!sectionId) return sectionImages;

    // Use the new collection store getter for better performance
    return collectionStore.getFilteredImagesForSection(
      sectionId,
      searchQuery.value,
      sortBy.value,
      filterVerified.value,
      confidenceFilters.value,
      hasLowConfidenceDetections,
      hasMediumConfidenceDetections,
      hasUnverifiedDetections,
      getVerificationStatus,
    );
  }

  // Image selection handling
  function toggleImageSelection(imageId: string, shiftKey = false) {
    // If not in select mode, don't handle selection
    if (!selectMode.value) {
      return;
    }

    // Handle shift+click for range selection
    if (shiftKey && lastSelectedImageId.value) {
      // Get all images from all sections in the hierarchical view
      const allImages = collectionStore.allImagesFlattened;

      const currentIndex = allImages.findIndex((img) => img.id === imageId);
      const lastIndex = allImages.findIndex(
        (img) => img.id === lastSelectedImageId.value,
      );

      if (currentIndex >= 0 && lastIndex >= 0) {
        // Determine range start and end
        const startIdx = Math.min(currentIndex, lastIndex);
        const endIdx = Math.max(currentIndex, lastIndex);

        // Select all images in the range
        for (let i = startIdx; i <= endIdx; i++) {
          if (!selectedImages.value.includes(allImages[i].id)) {
            selectedImages.value.push(allImages[i].id);
          }
        }
      }
    } else {
      // Normal toggle selection logic
      const index = selectedImages.value.indexOf(imageId);
      if (index === -1) {
        selectedImages.value.push(imageId);
      } else {
        selectedImages.value.splice(index, 1);
      }
    }

    // Update the last selected image
    lastSelectedImageId.value = imageId;
  }

  // Toggle select mode on/off
  function toggleSelectMode() {
    selectMode.value = !selectMode.value;
    if (!selectMode.value) {
      selectedImages.value = [];
      lastSelectedImageId.value = null;
    }
  }

  // Select all visible images
  function selectAll() {
    selectedImages.value = collectionStore.allImagesFlattened.map(
      (img) => img.id,
    );
  }

  // Deselect all images
  function deselectAll() {
    selectedImages.value = [];
    lastSelectedImageId.value = null;
  }

  // Mark selected images as verified (placeholder implementation)
  function markSelectedAsVerified() {
    console.log('Mark as verified:', selectedImages.value);
    deselectAll();
    selectMode.value = false;
  }

  // Download selected images (placeholder implementation)
  function downloadSelected() {
    console.log('Download selected:', selectedImages.value);
  }

  // Add a refresh function to reload data from API
  async function refreshData() {
    // Perform a collection reload to get fresh data from the server
    try {
      console.log(
        '[DEBUG-PageListStore] Starting refreshData() - reloading collection data',
      );

      // Get the current collection ID BEFORE any changes to cache settings
      const collectionId = collectionStore.collection?.id;

      if (!collectionId) {
        console.error(
          '[DEBUG-PageListStore] No collection ID available for refresh',
        );
        return { error: 'No collection ID available' };
      }

      // Sample some images before refresh to compare after
      const sampleImagesBefore = collectionStore.allImagesFlattened
        .filter((img) => img.page_index)
        .slice(0, 3)
        .map((img) => ({
          id: img.id,
          page_index: img.page_index || '(none)',
          timestamp: Date.now(),
        }));

      console.log(
        '[DEBUG-PageListStore] Images before refresh:',
        JSON.stringify(sampleImagesBefore),
      );
      console.log('[DEBUG-PageListStore] Refreshing collection:', collectionId);

      // Temporarily disable cache to ensure fresh data
      const wasCacheDisabled = collectionStore.disableCache;

      console.log(
        '[DEBUG-PageListStore] Current cache setting:',
        wasCacheDisabled ? 'disabled' : 'enabled',
      );
      console.log(
        '[DEBUG-PageListStore] Temporarily disabling cache to ensure fresh data',
      );

      collectionStore.setDisableCache(true);

      try {
        // Force reload the collection
        console.log(
          `[DEBUG-PageListStore] Calling reloadCollection() for ${collectionId}`,
        );
        await collectionStore.reloadCollection();

        // Check if the images actually changed
        const sampleImagesAfter = collectionStore.allImagesFlattened
          .filter((img) => img.page_index)
          .slice(0, 3)
          .map((img) => ({
            id: img.id,
            page_index: img.page_index || '(none)',
            timestamp: Date.now(),
          }));

        console.log(
          '[DEBUG-PageListStore] Images after refresh:',
          JSON.stringify(sampleImagesAfter),
        );

        // Compare the before and after samples
        const changed =
          JSON.stringify(sampleImagesBefore.map((i) => i.page_index)) !==
          JSON.stringify(sampleImagesAfter.map((i) => i.page_index));

        console.log(
          `[DEBUG-PageListStore] Images changed during refresh: ${changed}`,
        );

        console.log('[DEBUG-PageListStore] Collection reload completed');

        // Restore cache setting if needed
        if (!wasCacheDisabled) {
          console.log(
            '[DEBUG-PageListStore] Restoring cache setting to enabled',
          );
          collectionStore.setDisableCache(wasCacheDisabled);
        }

        // Verify updates were actually loaded
        await verifyLocalUpdates(collectionId);

        console.log('[DEBUG-PageListStore] Refresh operation complete');
        return { success: true };
      } catch (error) {
        console.error(
          `[DEBUG-PageListStore] Error reloading collection: ${error}`,
        );
        return {
          error: `Failed to reload collection: ${error}`,
        };
      }
    } catch (error) {
      console.error(`[DEBUG-PageListStore] Error in refreshData: ${error}`);
      return { error: `${error}` };
    }
  }

  // Helper function to verify updates directly from API
  async function verifyLocalUpdates(collectionId: string) {
    console.log(
      `[DEBUG-PageListStore] Verifying updates for collection: ${collectionId}`,
    );

    // Get a sample of images that might have page indices
    const imagesToCheck = collectionStore.allImagesFlattened
      .filter((img) => img.page_index)
      .slice(0, 5);

    if (imagesToCheck.length === 0) {
      console.log('[DEBUG-PageListStore] No images to verify in local data');
      return;
    }

    console.log(
      '[DEBUG-PageListStore] Verifying local updates for images:',
      imagesToCheck.map((img) => ({
        id: img.id,
        page_index: img.page_index,
      })),
    );

    // If the collection store doesn't have the correct collection loaded,
    // try to reload it first
    if (collectionStore.collection?.id !== collectionId) {
      console.log(
        `[DEBUG-PageListStore] Loading collection ${collectionId} for verification`,
      );
      try {
        await collectionStore.loadCollection(collectionId);
      } catch (error) {
        console.error(
          `[DEBUG-PageListStore] Error loading collection for verification: ${error}`,
        );
      }
    }

    // Verify each image directly from API
    for (const img of imagesToCheck) {
      try {
        const verification = await verifyPageIndexUpdate(
          img.id,
          img.page_index || '',
        );
        console.log(
          `[DEBUG-PageListStore] API verification for ${img.id}: ${verification.success ? 'Success' : 'Failed'}`,
        );

        // If local data is out of sync with server, update it
        if (!verification.success && verification.actualPageIndex !== null) {
          console.log(
            `[DEBUG-PageListStore] Updating local image data from API: ${img.id} -> ${verification.actualPageIndex}`,
          );
          collectionStore.updateImageDirectly(img.id, {
            page_index: verification.actualPageIndex,
          });
        }
      } catch (error) {
        console.error(
          `[DEBUG-PageListStore] Error verifying image ${img.id}:`,
          error,
        );
      }
    }
  }

  // Change page type for all selected images
  async function changePageType(pageType: string) {
    console.log(
      `Changing page type to ${pageType} for images:`,
      selectedImages.value,
    );

    // Track successful and failed operations
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each selected image sequentially
    for (const imageId of selectedImages.value) {
      try {
        // Call the API directly to update the page type
        const result = await updateImagePageType(imageId, pageType);

        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          if (result.error) {
            results.errors.push(`Image ${imageId}: ${result.error}`);
          }
        }
      } catch (error) {
        results.failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.errors.push(`Image ${imageId}: ${errorMessage}`);
      }
    }

    // Log the results
    console.log(
      `Page type update results: ${results.success} successful, ${results.failed} failed`,
    );
    if (results.errors.length > 0) {
      console.error('Page type update errors:', results.errors);
    }

    // Clear selection after operation
    deselectAll();
    selectMode.value = false;

    return results;
  }

  // Change page indices for all selected images
  async function changePageIndices(options: {
    prefix: string;
    suffix: string;
    startNumber: number;
    endNumber: number;
    step: number;
    pagesPerImage: number;
  }) {
    console.log(
      '[DEBUG-PageListStore] Changing page indices with options:',
      options,
    );
    console.log(
      '[DEBUG-PageListStore] Selected images count:',
      selectedImages.value.length,
    );

    // Track successful and failed operations
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      updatedImageIds: [] as string[],
    };

    // Get sorted selected images to ensure correct number assignment
    const sortedImages = selectedImages.value
      .map((id) => collectionStore.getImageById(id))
      .filter((img) => img !== undefined)
      .sort((a, b) => (a?.order || 0) - (b?.order || 0));

    console.log(
      '[DEBUG-PageListStore] Sorted images for processing:',
      sortedImages.map((img) => ({
        id: img?.id,
        order: img?.order,
        current_page_index: img?.page_index,
      })),
    );

    // Apply page indices
    let currentNumber = options.startNumber;

    for (const image of sortedImages) {
      if (image) {
        const pageIndex = `${options.prefix}${currentNumber}${options.suffix}`;
        try {
          console.log(
            `[DEBUG-PageListStore] Updating image ${image.id} with page index: ${pageIndex}`,
          );

          // Call the API directly to update the page index
          const result = await updateImagePageIndex(image.id, pageIndex);

          if (result.success) {
            results.success++;
            results.updatedImageIds.push(image.id);
            console.log(
              `[DEBUG-PageListStore] Successfully updated image ${image.id} with page index ${pageIndex}`,
            );

            // Verify the update by fetching the image data from the server
            console.log(
              `[DEBUG-PageListStore] Verifying page index update for image ${image.id}`,
            );
            try {
              const verification = await verifyPageIndexUpdate(
                image.id,
                pageIndex,
              );
              console.log(
                `[DEBUG-PageListStore] Verification result for ${image.id}: ${verification.success ? 'Success' : 'Failed'}`,
              );

              if (!verification.success) {
                console.error(
                  `[DEBUG-PageListStore] Verification failed: ${verification.error}`,
                );
              }
            } catch (verifyError) {
              console.error(
                `[DEBUG-PageListStore] Error during verification: ${verifyError}`,
              );
            }

            // Try to directly update the image in the store
            const currentImage = collectionStore.getImageById(image.id);
            if (currentImage) {
              console.log(
                `[DEBUG-PageListStore] Current page_index before update: ${currentImage.page_index}`,
              );

              // Try to update the image directly in the collection
              const updated = collectionStore.updateImageDirectly(image.id, {
                page_index: pageIndex,
                page_index_confidence: 1.0, // Set high confidence as it's manually set
              });

              console.log(
                `[DEBUG-PageListStore] Direct update of image in collection: ${updated ? 'Success' : 'Failed'}`,
              );

              // Verify the update in the store
              const updatedImage = collectionStore.getImageById(image.id);
              console.log(
                `[DEBUG-PageListStore] Updated page_index after direct update: ${updatedImage?.page_index}`,
              );
            }
          } else {
            results.failed++;
            if (result.error) {
              results.errors.push(`Image ${image.id}: ${result.error}`);
              console.error(
                `[DEBUG-PageListStore] Failed to update image ${image.id}: ${result.error}`,
              );
            }
          }
        } catch (error) {
          results.failed++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          results.errors.push(`Image ${image.id}: ${errorMessage}`);
          console.error(
            `[DEBUG-PageListStore] Exception updating image ${image.id}:`,
            error,
          );
        }

        // Increment by step * pagesPerImage
        currentNumber += options.step * options.pagesPerImage;
      }
    }

    // Log the results
    console.log(
      `[DEBUG-PageListStore] Page index update results: ${results.success} successful, ${results.failed} failed`,
    );
    if (results.errors.length > 0) {
      console.error(
        '[DEBUG-PageListStore] Page index update errors:',
        results.errors,
      );
    }

    // Log the updated image IDs
    console.log(
      '[DEBUG-PageListStore] Updated image IDs:',
      results.updatedImageIds,
    );

    // Check if we need to refresh data to reflect changes
    if (results.success > 0) {
      console.log(
        '[DEBUG-PageListStore] Will refresh data after page index updates',
      );
      // Use setTimeout to ensure the API has time to process the updates
      setTimeout(() => refreshData(), 500);
    }

    // Clear selection after operation
    deselectAll();
    selectMode.value = false;

    return results;
  }

  // Reset all filters
  function resetFilters() {
    sortBy.value = 'order';
    filterVerified.value = 'all';
    searchQuery.value = '';
    confidenceFilters.value = {
      low: false,
      medium: false,
      high: false,
    };
  }

  // Initialize with saved settings from localStorage
  function initFromLocalStorage(layout: 'full-width' | 'sidebar' = 'sidebar') {
    const savedViewMode = localStorage.getItem(
      `pagelist-viewmode-${layout || 'default'}`,
    );
    if (
      savedViewMode === 'list-small' ||
      savedViewMode === 'list-large' ||
      savedViewMode === 'grid'
    ) {
      viewMode.value = savedViewMode;
    }

    const savedGridColumns = localStorage.getItem(
      `pagelist-grid-columns-${layout || 'default'}`,
    );
    if (savedGridColumns && !isNaN(parseInt(savedGridColumns))) {
      gridColumns.value = parseInt(savedGridColumns);
    }
  }

  // Save settings to localStorage when they change
  watch(viewMode, (newMode) => {
    localStorage.setItem(
      `pagelist-viewmode-${currentLayout.value || 'default'}`,
      newMode,
    );
  });

  watch(gridColumns, (newValue) => {
    localStorage.setItem(
      `pagelist-grid-columns-${currentLayout.value || 'default'}`,
      newValue.toString(),
    );
  });

  // Track current layout
  const currentLayout = ref<'full-width' | 'sidebar'>('sidebar');

  // Calculate effective grid columns based on layout
  const effectiveGridColumns = computed(() => {
    // If view mode is not grid, always use 1 column
    if (viewMode.value !== 'grid') {
      return 1;
    }

    // For sidebar layout, limit columns to what makes sense
    if (currentLayout.value === 'sidebar') {
      return Math.min(gridColumns.value, 4); // Limit to 4 columns in sidebar
    }

    // Otherwise use the configured grid columns
    return gridColumns.value;
  });

  // Set the current layout
  function setLayout(layout: 'full-width' | 'sidebar') {
    currentLayout.value = layout;
    initFromLocalStorage(layout);
  }

  // Watch for changes to sorting and update the collection store
  watch(
    sortBy,
    (newSortValue) => {
      console.log(`PageListStore: Setting sort to ${newSortValue}`);
      collectionStore.setSortOption(newSortValue);
    },
    { immediate: true },
  );

  return {
    // State
    viewMode,
    gridColumns,
    effectiveGridColumns,
    selectedImages,
    selectMode,
    searchQuery,
    sortBy,
    filterVerified,
    confidenceFilters,
    statistics,
    filteredImages,

    // Constants
    LOW_CONFIDENCE_THRESHOLD,
    MEDIUM_CONFIDENCE_THRESHOLD,

    // Options (non-reactive)
    sortOptions,
    verificationOptions,
    confidenceOptions,
    viewModeOptions,
    gridColumnOptions,

    // Actions
    toggleImageSelection,
    toggleSelectMode,
    selectAll,
    deselectAll,
    markSelectedAsVerified,
    downloadSelected,
    changePageType,
    changePageIndices,
    resetFilters,
    setLayout,
    filterImagesInSection,
    refreshData,

    // Helper functions
    hasLowConfidenceDetections,
    hasMediumConfidenceDetections,
    getConfidenceLevel,
    hasUnverifiedDetections,
    getVerificationStatus,
    getVerificationStatusColor,
    getVerificationTooltip,
    needsAttention,
    getAttentionLevel,
    getColorValue,
  };
});
