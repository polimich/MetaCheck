<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  shallowRef,
  withDefaults,
  reactive,
  onActivated,
  onDeactivated,
  ComponentPublicInstance,
} from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { QVirtualScroll } from 'quasar';
import PageHeader from './PageHeader.vue';
import PageStatistics from './PageStatistics.vue';
import ImageThumbnail from './ImageThumbnail.vue';
import BulkActions from './BulkActions.vue';
import { useCollection } from 'src/stores/data/useCollection';
import { usePageListStore } from 'src/stores/ui/pageListStore';
import { MetaElementHierarchical } from 'src/types/data-access';

// Define a more specific type for image data
interface ImageData {
  id: string;
  url?: string;
  thumbnail_url?: string;
  order?: number;
  detection_count?: number;
  annotated_detection_count?: number;
  // Use any to maintain compatibility with HierarchicalImage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow other properties
}

// Optimization: Use a Map to cache filtered images by section - but keep it inside the reactive system
const filteredImagesCache = reactive(new Map<string, ImageData[]>());

// Define interfaces for virtual scroll items
interface VirtualScrollImage {
  type: 'image';
  sectionId: string;
  image: ImageData;
  level: number;
}

interface VirtualScrollSectionHeader {
  type: 'section-header';
  id: string;
  title: string;
  isExpanded: boolean;
  imageCount: number;
  directImageCount?: number;
  sectionCount?: number;
  subsectionCount?: number;
  sectionCounts?: { children: number; grandchildren: number };
  level: number;
  section?: MetaElementHierarchical;
}

interface VirtualScrollGridRow {
  type: 'grid-row';
  images: VirtualScrollImage[];
  level: number;
  sectionId: string;
}

type VirtualScrollItem =
  | VirtualScrollImage
  | VirtualScrollSectionHeader
  | VirtualScrollGridRow;

// Optimization: Handle component activation/deactivation
onActivated(() => {
  // Minimal code needed for proper functioning
  if (virtualScrollRef.value) {
    setTimeout(() => {
      virtualScrollRef.value?.refresh();
    }, 100);
  }
});

onDeactivated(() => {
  // No specific cleanup needed for virtual scroll
});

interface PageListProps {
  collectionId: string;
  showHeader?: boolean;
  showStatistics?: boolean;
  showViewModeSelector?: boolean;
  enableBulkActions?: boolean;
  layout?: 'full-width' | 'sidebar';
  initialViewMode?: 'list-small' | 'list-large' | 'grid';
  gridColumns?: number;
  initialHierarchicalMode?: boolean;
}

// Define props with defaults
const props = withDefaults(defineProps<PageListProps>(), {
  showHeader: false,
  showStatistics: false,
  showViewModeSelector: false,
  enableBulkActions: false,
  layout: 'sidebar',
  initialHierarchicalMode: true,
});

const emit = defineEmits<{
  (e: 'select-image', imageId: string): void;
  (e: 'layout-change', layout: string): void;
  (e: 'view-mode-change', viewMode: string): void;
}>();

// Use the centralized Pinia store instead of individual composables
const pageListStore = usePageListStore();

// Use shallowRef for complex objects that don't need deep reactivity
const currentCollection = shallowRef(useCurrentCollectionState());
const collectionStore = shallowRef(useCollection());

// Define the correct type for Vue component ref callback
type VNodeRef = ComponentPublicInstance | Element | null;

// Optimization: Create refs for DOM elements instead of using querySelector
const activeThumbnailRef = ref<HTMLElement | null>(null);

// Default values for optional props
const showHeader = computed(() => props.showHeader !== false);
const showStatistics = computed(() => props.showStatistics !== false);
const enableBulkActions = computed(() => props.enableBulkActions !== false);

// Current active image
const activeImageId = computed(() => currentCollection.value.selectedImageId);

// Virtual scroll configuration
const virtualScrollSize = ref(48); // Default item size (will be different based on view mode)

// Compute virtual scroll item size based on view mode
const getVirtualScrollItemSize = computed(() => {
  switch (pageListStore.viewMode) {
    case 'grid':
      return 330; // Increased for grid rows with taller images
    case 'list-large':
      return 230; // Increased for large list items
    case 'list-small':
    default:
      return 130; // Increased for small list items
  }
});

// Optimize scroll debouncing
function debouncedScrollRefresh() {
  if (scrollDebounceTimeout) {
    window.clearTimeout(scrollDebounceTimeout);
  }

  scrollDebounceTimeout = window.setTimeout(() => {
    if (virtualScrollRef.value) {
      console.log('Refreshing virtual scroll');
      // Refresh all items to account for size changes
      virtualScrollRef.value.reset();
      nextTick(() => {
        virtualScrollRef.value?.refresh();
      });
    }
  }, 50);
}

// Fix the grid row creation function to ensure proper row sizing
function createGridRows(
  items: VirtualScrollItem[],
  columnsPerRow: number,
): VirtualScrollItem[] {
  if (!items.length || pageListStore.viewMode !== 'grid') {
    // Return the original array for list views or if empty
    return items;
  }

  const result: VirtualScrollItem[] = [];
  let currentRow: VirtualScrollImage[] = [];
  let currentLevel = 1;
  let currentSectionId = '';

  // Process each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Always add section headers directly
    if (item.type === 'section-header') {
      // If we have a partial row, add it before the header
      if (currentRow.length > 0) {
        result.push({
          type: 'grid-row',
          images: [...currentRow],
          level: currentLevel,
          sectionId: currentSectionId,
        } as unknown as VirtualScrollItem);
        currentRow = [];
      }

      // Add the section header
      result.push(item);
      continue;
    }

    // Process images into grid rows
    if (item.type === 'image') {
      // Store current level and section for the row
      currentLevel = item.level;
      currentSectionId = item.sectionId;

      // Add to current row
      currentRow.push(item);

      // If row is full or we're at the end of a section, create a grid row
      const nextItem = i < items.length - 1 ? items[i + 1] : null;
      const isEndOfSection =
        !nextItem ||
        nextItem.type === 'section-header' ||
        (nextItem.type === 'image' && nextItem.sectionId !== currentSectionId);

      if (
        currentRow.length === columnsPerRow ||
        i === items.length - 1 ||
        isEndOfSection
      ) {
        result.push({
          type: 'grid-row',
          images: [...currentRow],
          level: currentLevel,
          sectionId: currentSectionId,
        } as unknown as VirtualScrollItem);
        currentRow = [];
      }
    }
  }

  return result;
}

// Generate a flattened array of all visible items for virtual scroll
// This includes sections, subsections, and images, with images grouped into rows for grid view
const virtualScrollItems = computed((): VirtualScrollItem[] => {
  // Start with an empty array
  let items: VirtualScrollItem[] = [];

  // First, add the global section if it has images
  if (collectionStore.value.topLevelImages.length > 0) {
    // Add the section header as a special item
    items.push({
      type: 'section-header',
      id: 'global',
      title: getGlobalSectionTitle.value,
      isExpanded: collectionStore.value.isSectionExpanded('global'),
      imageCount: collectionStore.value.topLevelImages.length,
      sectionCount: collectionStore.value.metaElementSections.length,
      level: 1,
    });

    // If the section is expanded, add all its images
    if (collectionStore.value.isSectionExpanded('global')) {
      const filteredImages = getFilteredImagesForSection('global');

      if (filteredImages && filteredImages.length > 0) {
        filteredImages.forEach((image: ImageData) => {
          items.push({
            type: 'image',
            sectionId: 'global',
            image,
            level: 1,
          });
        });
      }
    }
  }

  // For each top-level section
  collectionStore.value.metaElementSections.forEach((section) => {
    if (
      sectionHasFilteredImages(section.id) ||
      sectionHasDisplayableChildren.value(section)
    ) {
      // Add the section header
      items.push({
        type: 'section-header',
        id: section.id,
        title: getSectionDisplayName(section),
        isExpanded: collectionStore.value.isSectionExpanded(section.id),
        imageCount: getTotalImagesInSection.value(section),
        directImageCount: section.images?.length || 0,
        sectionCounts: getNestedSectionCounts.value(section),
        level: 1,
        section,
      });

      // If expanded, add its images and child sections
      if (collectionStore.value.isSectionExpanded(section.id)) {
        // Add direct images in this section
        const filteredImages = getFilteredImagesForSection(section.id);
        if (filteredImages && filteredImages.length > 0) {
          filteredImages.forEach((image: ImageData) => {
            items.push({
              type: 'image',
              sectionId: section.id,
              image,
              level: 1,
            });
          });
        }

        // Add child sections
        if (section.children && section.children.length > 0) {
          const childSections = filteredChildSections.value(section);

          childSections.forEach((childSection) => {
            // Add child section header
            items.push({
              type: 'section-header',
              id: childSection.id,
              title: getSectionDisplayName(childSection),
              isExpanded: collectionStore.value.isSectionExpanded(
                childSection.id,
              ),
              imageCount:
                childSection.images?.length +
                (childSection.children && Array.isArray(childSection.children)
                  ? childSection.children.reduce(
                      (sum: number, grandchild: MetaElementHierarchical) =>
                        sum + (grandchild.images?.length || 0),
                      0,
                    )
                  : 0),
              directImageCount: childSection.images?.length || 0,
              subsectionCount: childSection.children?.length || 0,
              level: 2,
              section: childSection,
            });

            // If expanded, add child images and grandchild sections
            if (collectionStore.value.isSectionExpanded(childSection.id)) {
              // Add child images
              const childFilteredImages = getFilteredImagesForSection(
                childSection.id,
              );
              if (childFilteredImages && childFilteredImages.length > 0) {
                childFilteredImages.forEach((image: ImageData) => {
                  items.push({
                    type: 'image',
                    sectionId: childSection.id,
                    image,
                    level: 2,
                  });
                });
              }

              // Add grandchild sections
              if (childSection.children && childSection.children.length > 0) {
                const grandchildSections =
                  filteredGrandChildSections.value(childSection);

                grandchildSections.forEach((grandchildSection) => {
                  // Add grandchild section header
                  items.push({
                    type: 'section-header',
                    id: grandchildSection.id,
                    title: getSectionDisplayName(grandchildSection),
                    isExpanded: collectionStore.value.isSectionExpanded(
                      grandchildSection.id,
                    ),
                    imageCount: grandchildSection.images?.length || 0,
                    level: 3,
                    section: grandchildSection,
                  });

                  // If expanded, add grandchild images
                  if (
                    collectionStore.value.isSectionExpanded(
                      grandchildSection.id,
                    )
                  ) {
                    const grandchildFilteredImages =
                      getFilteredImagesForSection(grandchildSection.id);
                    if (
                      grandchildFilteredImages &&
                      grandchildFilteredImages.length > 0
                    ) {
                      grandchildFilteredImages.forEach((image: ImageData) => {
                        items.push({
                          type: 'image',
                          sectionId: grandchildSection.id,
                          image,
                          level: 3,
                        });
                      });
                    }
                  }
                });
              }
            }
          });
        }
      }
    }
  });

  // For grid view, restructure the items to create rows
  if (pageListStore.viewMode === 'grid') {
    return createGridRows(items, pageListStore.effectiveGridColumns);
  }

  return items;
});

// Optimize performance by using a stable cache key for filtering
const filterCacheKey = computed(() => {
  return `${pageListStore.searchQuery}-${pageListStore.filterVerified}-${JSON.stringify(pageListStore.confidenceFilters)}-${pageListStore.sortBy}`;
});

// Use a single optimization flag to debounce expensive filtering operations
const isFilterProcessing = ref(false);

// Watch for filter changes to clear cache
watch(filterCacheKey, () => {
  // Clear the entire cache when filters change
  console.log('Filter or sort changed, clearing cache');
  filteredImagesCache.clear();

  // Debounce filter processing to prevent UI jank
  if (!isFilterProcessing.value) {
    isFilterProcessing.value = true;
    requestAnimationFrame(() => {
      isFilterProcessing.value = false;
    });
  }
});

// Add specific watch for sort changes to ensure updating
watch(
  () => pageListStore.sortBy,
  (newSortValue) => {
    console.log('Sort changed to:', newSortValue);
    // Clear the cache to force refiltering
    filteredImagesCache.clear();
  },
);

// Watch for changes in selection state to ensure UI updates
watch(
  () => pageListStore.selectedImages,
  () => {
    console.log(
      'Selection changed:',
      pageListStore.selectedImages.length,
      'images selected',
    );
    // No need to invalidate cache for selection changes
  },
  { deep: true },
);

// Watch for collection changes to clear cache
watch(
  () => props.collectionId,
  () => {
    console.log('Collection changed, clearing cache');
    filteredImagesCache.clear();
  },
);

// Watch for select mode changes to ensure UI updates
watch(
  () => pageListStore.selectMode,
  (newValue) => {
    console.log('Select mode changed:', newValue);
  },
);

// Watch for view mode changes to update virtual scroll item size
watch(
  () => pageListStore.viewMode,
  () => {
    // Update virtual scroll item size when view mode changes
    virtualScrollSize.value = getVirtualScrollItemSize.value;
    // Wait for DOM update then refresh the virtual scroll
    nextTick(() => {
      if (virtualScrollRef.value) {
        virtualScrollRef.value.reset();
      }
    });
  },
);

// Get filtered images with caching for better performance
function getFilteredImagesForSection(sectionId: string) {
  const cacheKey = `${sectionId}:${filterCacheKey.value}`;

  // Check if we have this section's filtered images in cache
  if (filteredImagesCache.has(cacheKey)) {
    return filteredImagesCache.get(cacheKey);
  }

  // Fallback to direct filtering if not in cache
  const result = collectionStore.value.getFilteredImagesForSection(
    sectionId,
    pageListStore.searchQuery,
    pageListStore.sortBy,
    pageListStore.filterVerified,
    pageListStore.confidenceFilters,
    pageListStore.hasLowConfidenceDetections,
    pageListStore.hasMediumConfidenceDetections,
    pageListStore.hasUnverifiedDetections,
    pageListStore.getVerificationStatus,
  );

  // Cache the result
  filteredImagesCache.set(cacheKey, result);
  return result;
}

// Check if a section has images after filtering
function sectionHasFilteredImages(sectionId: string) {
  const filteredImages = getFilteredImagesForSection(sectionId);
  return filteredImages && filteredImages.length > 0;
}

// Get display name for a section
function getSectionDisplayName(section: MetaElementHierarchical) {
  // Prioritize meta_element_type display_name, then name, then fall back to ID
  return (
    section.meta_element_type?.display_name ||
    section.meta_element_type?.name ||
    section.id
  );
}

// Computed property to filter child sections that have images
const filteredChildSections = computed(() => {
  return (parentSection: MetaElementHierarchical) => {
    if (!parentSection.children) return [];
    return parentSection.children.filter((child: MetaElementHierarchical) =>
      sectionHasFilteredImages(child.id),
    );
  };
});

// Check if a section has nested children that should be displayed
const sectionHasDisplayableChildren = computed(() => {
  return (section: MetaElementHierarchical): boolean => {
    if (!section.children || section.children.length === 0) return false;

    // Check if at least one child has filtered images or its own displayable children
    return section.children.some((childSection: MetaElementHierarchical) => {
      const hasFilteredImages = sectionHasFilteredImages(childSection.id);
      const hasDisplayableChildren =
        childSection.children &&
        childSection.children.length > 0 &&
        childSection.children.some((grandchild: MetaElementHierarchical) =>
          sectionHasFilteredImages(grandchild.id),
        );

      return hasFilteredImages || hasDisplayableChildren;
    });
  };
});

// Computed property to filter grand-child sections that have images
const filteredGrandChildSections = computed(() => {
  return (childSection: MetaElementHierarchical) => {
    if (!childSection.children) return [];
    return childSection.children.filter((grandChild: MetaElementHierarchical) =>
      sectionHasFilteredImages(grandChild.id),
    );
  };
});

// Count total images in a section including all nested children
const getTotalImagesInSection = computed(() => {
  return (section: MetaElementHierarchical): number => {
    // Start with direct images in this section
    let totalImages = section.images?.length || 0;

    // Add images from children
    if (section.children && section.children.length > 0) {
      section.children.forEach((childSection: MetaElementHierarchical) => {
        // Add direct images in child section
        totalImages += childSection.images?.length || 0;

        // Add images from grandchildren
        if (childSection.children && childSection.children.length > 0) {
          childSection.children.forEach(
            (grandChildSection: MetaElementHierarchical) => {
              totalImages += grandChildSection.images?.length || 0;
            },
          );
        }
      });
    }

    return totalImages;
  };
});

// Count nested sections at each level
const getNestedSectionCounts = computed(() => {
  return (
    section: MetaElementHierarchical,
  ): { children: number; grandchildren: number } => {
    let childCount = section.children?.length || 0;
    let grandChildCount = 0;

    // Count grandchildren
    if (section.children && section.children.length > 0) {
      section.children.forEach((childSection: MetaElementHierarchical) => {
        grandChildCount += childSection.children?.length || 0;
      });
    }

    return { children: childCount, grandchildren: grandChildCount };
  };
});

// Get a formatted title for global section
const getGlobalSectionTitle = computed(() => {
  if (!collectionStore.value.collection?.global_structure) return 'Global';

  const globalStructure = collectionStore.value.collection.global_structure;

  // Try to get name from meta_element_type
  const typeName =
    globalStructure.meta_element_type?.display_name ||
    globalStructure.meta_element_type?.name ||
    'Global';

  return typeName;
});

// Interface for QVirtualScroll Component
interface QVirtualScrollRef {
  scrollTo: (index: number) => void;
  reset: () => void;
  refresh: (index?: number) => void;
}

// Virtual scroll helpers
const virtualScrollRef = ref<QVirtualScrollRef | null>(null);

// Scroll to a specific item in the virtual scroll
function scrollTo(index: number) {
  if (virtualScrollRef.value) {
    virtualScrollRef.value.scrollTo(index);
  }
}

// Find the exact parent hierarchy for an image: [topSection, childSection, grandchildSection]
function findImageHierarchy(imageId: string): string[] {
  const hierarchy: string[] = [];

  // Check global section first
  const isInGlobal = collectionStore.value.topLevelImages.some(
    (img) => img.id === imageId,
  );
  if (isInGlobal) {
    return ['global'];
  }

  // Check each top-level section
  for (const section of collectionStore.value.metaElementSections) {
    // Check if image is directly in this section
    if (section.images && section.images.some((img) => img.id === imageId)) {
      return [section.id];
    }

    // Check children
    if (section.children) {
      for (const childSection of section.children) {
        // Check if image is in this child section
        if (
          childSection.images &&
          childSection.images.some((img) => img.id === imageId)
        ) {
          return [section.id, childSection.id];
        }

        // Check grandchildren
        if (childSection.children) {
          for (const grandchildSection of childSection.children) {
            if (
              grandchildSection.images &&
              grandchildSection.images.some((img) => img.id === imageId)
            ) {
              return [section.id, childSection.id, grandchildSection.id];
            }
          }
        }
      }
    }
  }

  return hierarchy;
}

// Expand all sections in the hierarchy
function expandSectionHierarchy(hierarchy: string[]): void {
  for (const sectionId of hierarchy) {
    if (!collectionStore.value.isSectionExpanded(sectionId)) {
      console.log(`Expanding section in hierarchy: ${sectionId}`);
      collectionStore.value.toggleSection(sectionId);
    }
  }
}

// Find the exact index and row position of an image within the virtual scroll items
function findDetailedImagePosition(imageId: string): {
  index: number;
  imageIndex?: number;
  isInGridRow: boolean;
} {
  for (let i = 0; i < virtualScrollItems.value.length; i++) {
    const item = virtualScrollItems.value[i];

    if (item.type === 'image' && item.image.id === imageId) {
      return { index: i, isInGridRow: false };
    } else if (item.type === 'grid-row') {
      // Check if the image is in this grid row
      const imageIndex = item.images.findIndex(
        (img) => img.image.id === imageId,
      );
      if (imageIndex !== -1) {
        return { index: i, imageIndex, isInGridRow: true };
      }
    }
  }

  return { index: -1, isInGridRow: false };
}

// Optimized function to scroll to active image
const scrollToActiveImage = async () => {
  if (!activeImageId.value || !virtualScrollRef.value) {
    console.log('Cannot scroll: missing active image ID or virtual scroll ref');
    return;
  }

  console.log('Attempting to scroll to active image:', activeImageId.value);

  // Find the complete section hierarchy for this image
  const hierarchy = findImageHierarchy(activeImageId.value);
  console.log('Image hierarchy:', hierarchy);

  if (hierarchy.length === 0) {
    console.warn('Could not find image in any section');
    return;
  }

  // Expand all necessary sections
  expandSectionHierarchy(hierarchy);

  // Wait for DOM updates after expanding sections
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Find the detailed position of the active image in the virtual items
  const {
    index: activeIndex,
    imageIndex,
    isInGridRow,
  } = findDetailedImagePosition(activeImageId.value);

  if (activeIndex !== -1) {
    console.log(
      'Found active image at index:',
      activeIndex,
      isInGridRow ? `(in grid row, position ${imageIndex})` : '',
    );

    // Scroll to the row containing the image
    virtualScrollRef.value.scrollTo(activeIndex);

    // Use debounced refresh for optimal rendering
    debouncedScrollRefresh();

    // If the image is in a grid row, we need to scroll horizontally to it
    // (Note: This would require custom horizontal scrolling logic if needed)
    if (isInGridRow && imageIndex !== undefined) {
      // Highlight the specific image in the grid row through other means if needed
      console.log(`Image is in grid position ${imageIndex}`);
    }
  } else {
    console.warn(
      'Active image not found in virtual scroll items after expanding sections',
    );

    // If we couldn't find the image, try once more after a longer delay
    // This helps when the virtualScrollItems computed property needs time to update
    setTimeout(async () => {
      const { index: retryIndex } = findDetailedImagePosition(
        activeImageId.value,
      );
      if (retryIndex !== -1) {
        console.log('Found active image after retry at index:', retryIndex);
        virtualScrollRef.value?.scrollTo(retryIndex);
        debouncedScrollRefresh();
      } else {
        console.error('Failed to find active image after retry');
      }
    }, 300);
  }
};

// Initialize the store with the correct layout
onMounted(() => {
  pageListStore.setLayout(props.layout);

  // If initialViewMode is provided, override the localStorage value
  if (props.initialViewMode) {
    pageListStore.viewMode = props.initialViewMode;
  }

  // If gridColumns is provided, override the localStorage value
  if (props.gridColumns) {
    pageListStore.gridColumns = props.gridColumns;
  }

  // Set virtual scroll item size based on view mode
  virtualScrollSize.value = getVirtualScrollItemSize.value;

  // Set grid columns CSS variable
  updateGridColumnsCssVar();

  // Optimization: Load expanded sections from localStorage if available
  loadExpandedSectionsFromLocalStorage();
});

// Response to view mode changes
watch(
  () => pageListStore.viewMode,
  (newMode) => {
    emit('view-mode-change', newMode);
  },
);

// Optimize the activeImageId watcher to scroll to active image in virtual scroll
watch(
  activeImageId,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Prevent multiple scroll operations with a shorter delay
      setTimeout(() => {
        scrollToActiveImage();
      }, 50);
    }
  },
  { immediate: false },
);

// Clean up event listeners
let resizeTimeout: number | null = null;
let scrollDebounceTimeout: number | null = null;

onBeforeUnmount(() => {
  if (resizeTimeout) {
    window.clearTimeout(resizeTimeout);
  }

  if (scrollDebounceTimeout) {
    window.clearTimeout(scrollDebounceTimeout);
  }

  // Save expanded sections to localStorage
  saveExpandedSectionsToLocalStorage();
});

// Function to save expanded sections state to localStorage
function saveExpandedSectionsToLocalStorage() {
  localStorage.setItem(
    `expanded-sections-${props.collectionId}`,
    JSON.stringify(collectionStore.value.expandedSections),
  );
}

// Function to load expanded sections state from localStorage
function loadExpandedSectionsFromLocalStorage() {
  const savedSections = localStorage.getItem(
    `expanded-sections-${props.collectionId}`,
  );

  if (savedSections) {
    try {
      const parsed = JSON.parse(savedSections);

      // If we have sections to expand and they're in an array format
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Just replace the current expanded sections with the saved ones
        collectionStore.value.expandedSections = parsed;
      }
    } catch (e) {
      console.error('Error loading saved section states:', e);
    }
  }
}

// Improved section toggle with virtual scroll support
function handleSectionToggle(sectionId: string) {
  // Toggle the section first
  collectionStore.value.toggleSection(sectionId);

  // If the section is being expanded, find its index and scroll to it
  if (collectionStore.value.isSectionExpanded(sectionId)) {
    // Find the index of this section in virtual items
    const sectionIndex = virtualScrollItems.value.findIndex(
      (item) => item.type === 'section-header' && item.id === sectionId,
    );

    if (sectionIndex !== -1) {
      // Wait for the DOM to update with expanded section
      setTimeout(() => {
        // Scroll to the section but a bit above it for better UX
        scrollTo(Math.max(0, sectionIndex - 1));
      }, 100);
    }
  }

  // Save expanded sections state
  saveExpandedSectionsToLocalStorage();
}

// Optimization: Cache active thumbnail ref helper
function setActiveThumbnailRef(el: VNodeRef) {
  // Cast to HTMLElement if it's an element
  if (el instanceof HTMLElement) {
    activeThumbnailRef.value = el;
  } else if (el && 'el' in el && el.el instanceof HTMLElement) {
    // Handle component instance with $el property
    activeThumbnailRef.value = el.el;
  } else {
    activeThumbnailRef.value = null;
  }
}

// Image navigation with selection support
function navigateToImage(imageId: string, shiftKey = false) {
  if (pageListStore.selectMode) {
    pageListStore.toggleImageSelection(imageId, shiftKey);
  } else {
    // Update selected image in the collection state
    currentCollection.value.selectImage(imageId);

    // Emit the selected image ID to parent component
    emit('select-image', imageId);
  }
}

// Load collection data when component mounts or collectionId changes
watch(
  () => props.collectionId,
  async () => {
    await loadCollection();
    // Always load hierarchical collection data
    await loadHierarchicalCollection();

    // Optimization: Reset cache when collection changes
    filteredImagesCache.clear();
  },
  { immediate: true },
);

// Determine if the collection is empty
const isCollectionEmpty = computed(() => {
  // Check all levels for images
  return collectionStore.value.allImagesFlattened.length === 0;
});

// Optimized loadCollection with better caching and error handling
async function loadCollection() {
  if (!props.collectionId) return;

  // More comprehensive cache check with logging
  if (
    currentCollection.value.loaded &&
    currentCollection.value.id === props.collectionId
  ) {
    console.log(
      `PageList: Collection ${props.collectionId} already loaded, using cached data.`,
    );
    return;
  }

  if (currentCollection.value.loading) {
    console.log(
      `PageList: Collection ${props.collectionId} is currently loading, waiting...`,
    );
    return;
  }

  console.log(`PageList: Loading collection ${props.collectionId}`);
  try {
    await currentCollection.value.loadCollection(props.collectionId);
  } catch (error) {
    console.error(
      `PageList: Error loading collection ${props.collectionId}:`,
      error,
    );
  }
}

// Load hierarchical collection data
async function loadHierarchicalCollection() {
  if (!props.collectionId) return;

  if (
    collectionStore.value.loaded &&
    collectionStore.value.collection?.id === props.collectionId
  ) {
    console.log(
      `PageList: Hierarchical collection ${props.collectionId} already loaded, using cached data.`,
    );
    return;
  }

  if (collectionStore.value.loading) {
    console.log(
      `PageList: Hierarchical collection ${props.collectionId} is currently loading, waiting...`,
    );
    return;
  }

  console.log(
    `PageList: Loading hierarchical collection ${props.collectionId}`,
  );
  try {
    await collectionStore.value.loadCollection(props.collectionId);
  } catch (error) {
    console.error(
      `PageList: Error loading hierarchical collection ${props.collectionId}:`,
      error,
    );
  }
}

// Update grid columns CSS variable when it changes
watch(() => pageListStore.gridColumns, updateGridColumnsCssVar);

// Function to update the CSS variable for grid columns
function updateGridColumnsCssVar() {
  document.documentElement.style.setProperty(
    '--grid-columns',
    String(pageListStore.effectiveGridColumns),
  );
}

// Add an event emitter to track description expansion and refresh virtual scroll
const handleDescriptionExpand = () => {
  // Refresh the virtual scroll when a description is expanded/collapsed
  if (virtualScrollRef.value) {
    debouncedScrollRefresh();
  }
};
</script>

<template>
  <div class="page-list-wrapper" :class="[`layout-${props.layout}`]">
    <!-- Header with filters and controls -->
    <div class="page-list-header" v-if="showHeader">
      <PageHeader
        v-model:searchQuery="pageListStore.searchQuery"
        v-model:sortBy="pageListStore.sortBy"
        v-model:filterVerified="pageListStore.filterVerified"
        v-model:confidenceFilters="pageListStore.confidenceFilters"
        v-model:viewMode="pageListStore.viewMode"
        v-model:userGridColumns="pageListStore.gridColumns"
        :class="{ 'header-fullscreen': props.layout === 'full-width' }"
        :layoutMode="props.layout"
        :compact="props.layout === 'full-width'"
        @locate-active-image="scrollToActiveImage"
      />
    </div>

    <!-- Statistics and progress indicators -->
    <div class="page-list-stats" v-if="showStatistics">
      <PageStatistics
        :statistics="pageListStore.statistics"
        :filterVerified="pageListStore.filterVerified"
        :searchQuery="pageListStore.searchQuery"
        :filteredImagesCount="pageListStore.filteredImages.length"
        :totalImagesCount="currentCollection.collection?.images?.length || 0"
        @resetFilters="pageListStore.resetFilters"
        :class="{ 'stats-fullscreen': props.layout === 'full-width' }"
        :layoutMode="props.layout"
        :compact="props.layout === 'full-width'"
      />
    </div>

    <!-- Main content area -->
    <div class="page-list-content">
      <!-- Empty Collection State -->
      <div
        v-if="
          isCollectionEmpty &&
          !currentCollection.loading &&
          !collectionStore.loading
        "
        class="empty-collection q-pa-xl flex flex-center column"
      >
        <q-icon name="image_not_supported" size="64px" color="grey-6" />
        <div class="text-h6 q-mt-md">No Images in Collection</div>
        <div class="text-body1 text-grey-7 q-mt-sm">
          This collection doesn't contain any images yet.
        </div>
        <q-btn
          color="primary"
          class="q-mt-lg"
          label="Upload Images"
          icon="upload"
        />
      </div>

      <!-- Loading state -->
      <div
        v-else-if="currentCollection.loading || collectionStore.loading"
        class="flex flex-center q-pa-md"
      >
        <div class="column items-center">
          <q-spinner color="primary" size="40px" />
          <div class="text-subtitle1 q-mt-md">Loading images...</div>
        </div>
      </div>

      <!-- Virtual Scroll Implementation -->
      <div v-else class="page-list-scroll-container">
        <!-- Section controls -->
        <div class="section-controls q-px-md q-py-sm bg-grey-2">
          <q-btn
            flat
            dense
            size="sm"
            icon="unfold_more"
            @click="collectionStore.expandAllSections"
            label="Expand All"
          />
          <q-btn
            flat
            dense
            size="sm"
            icon="unfold_less"
            @click="collectionStore.collapseAllSections"
            label="Collapse All"
            class="q-ml-sm"
          />
        </div>

        <!-- Empty state when no sections exist -->
        <div
          v-if="
            collectionStore.hierarchicalSections.length === 0 &&
            !collectionStore.topLevelImages.length
          "
          class="empty-state q-pa-xl text-center"
        >
          <q-icon name="category" size="48px" color="grey-6" />
          <div class="text-subtitle1 q-mt-sm">
            No sections in this collection
          </div>
          <div class="text-caption text-grey-7">
            This collection doesn't have any organized sections yet
          </div>
        </div>

        <!-- Virtual Scroll with Items -->
        <q-virtual-scroll
          v-else
          ref="virtualScrollRef"
          :items="virtualScrollItems"
          :virtual-scroll-item-size="virtualScrollSize"
          class="virtual-scroll-container"
        >
          <template v-slot="{ item, index }">
            <div
              :class="`virtual-item virtual-item-${item.type} level-${item.level}`"
              :key="`item-${item.type === 'image' ? item.image.id : item.type === 'grid-row' ? `grid-row-${index}` : item.id}`"
            >
              <!-- Section Headers -->
              <div
                v-if="item.type === 'section-header'"
                class="meta-element-section"
              >
                <!-- Section header -->
                <div
                  class="section-header q-pa-sm q-px-md cursor-pointer"
                  @click="handleSectionToggle(item.id)"
                  :class="`section-level-${item.level}`"
                >
                  <div class="row items-center no-wrap">
                    <q-icon
                      :name="item.isExpanded ? 'expand_more' : 'chevron_right'"
                      size="1.5em"
                      class="q-mr-sm"
                    />
                    <div class="text-subtitle1">
                      {{ item.title }}
                    </div>

                    <!-- Summary badges -->
                    <q-badge
                      color="primary"
                      class="q-ml-sm"
                      v-if="item.imageCount > 0"
                      v-tooltip="
                        item.level === 1
                          ? 'Total images in this section and subsections'
                          : ''
                      "
                    >
                      {{ item.imageCount }} images{{
                        item.level === 1 ? ' total' : ''
                      }}
                    </q-badge>

                    <q-badge
                      v-if="item.directImageCount > 0 && item.level <= 2"
                      color="primary"
                      class="q-ml-sm"
                      v-tooltip="'Images directly in this section'"
                    >
                      ({{ item.directImageCount }} direct)
                    </q-badge>

                    <q-badge
                      v-if="
                        item.level === 1 && item.sectionCounts?.children > 0
                      "
                      color="secondary"
                      class="q-ml-sm"
                      v-tooltip="'Nested subsections'"
                    >
                      {{ item.sectionCounts.children }} subsections
                      <span v-if="item.sectionCounts.grandchildren > 0">
                        ({{ item.sectionCounts.grandchildren }} nested)
                      </span>
                    </q-badge>

                    <q-badge
                      v-if="item.level === 2 && item.subsectionCount > 0"
                      color="secondary"
                      class="q-ml-sm"
                      v-tooltip="'Nested subsections'"
                    >
                      {{ item.subsectionCount }} subsections
                    </q-badge>

                    <q-space />
                  </div>
                </div>
              </div>

              <!-- Grid Row -->
              <div
                v-else-if="item.type === 'grid-row'"
                class="grid-row"
                :class="`level-${item.level}`"
              >
                <!-- Loop through images in this row -->
                <ImageThumbnail
                  v-for="imageItem in item.images"
                  :key="`img-${imageItem.image.id}`"
                  :image="imageItem.image"
                  :isActive="imageItem.image.id === activeImageId"
                  :isSelected="
                    pageListStore.selectedImages.includes(imageItem.image.id)
                  "
                  :selectMode="pageListStore.selectMode"
                  :viewMode="pageListStore.viewMode"
                  :flags="{
                    needsAttention: pageListStore.needsAttention(
                      imageItem.image.id,
                    ),
                    hasLowConfidence: pageListStore.hasLowConfidenceDetections(
                      imageItem.image.id,
                    ),
                    hasMediumConfidence:
                      pageListStore.hasMediumConfidenceDetections(
                        imageItem.image.id,
                      ),
                    hasUnverifiedDetections:
                      pageListStore.hasUnverifiedDetections(imageItem.image.id),
                  }"
                  :verificationStatus="{
                    color: pageListStore.getVerificationStatusColor(
                      imageItem.image.id,
                    ),
                    tooltip: pageListStore.getVerificationTooltip(
                      imageItem.image.id,
                    ),
                  }"
                  :confidenceThresholds="{
                    low: pageListStore.LOW_CONFIDENCE_THRESHOLD,
                    medium: pageListStore.MEDIUM_CONFIDENCE_THRESHOLD,
                  }"
                  @click="navigateToImage"
                  @select="
                    (id, shiftKey) =>
                      pageListStore.toggleImageSelection(id, shiftKey)
                  "
                  @description-expand="handleDescriptionExpand"
                  :ref="
                    imageItem.image.id === activeImageId
                      ? setActiveThumbnailRef
                      : undefined
                  "
                  class="grid-item"
                />
              </div>

              <!-- Regular Image Items (for list views) -->
              <div
                v-else-if="item.type === 'image'"
                :class="[
                  'image-container-item',
                  `view-${pageListStore.viewMode}`,
                  `level-${item.level}`,
                ]"
              >
                <ImageThumbnail
                  :key="`img-${item.image.id}`"
                  :image="item.image"
                  :isActive="item.image.id === activeImageId"
                  :isSelected="
                    pageListStore.selectedImages.includes(item.image.id)
                  "
                  :selectMode="pageListStore.selectMode"
                  :viewMode="pageListStore.viewMode"
                  :flags="{
                    needsAttention: pageListStore.needsAttention(item.image.id),
                    hasLowConfidence: pageListStore.hasLowConfidenceDetections(
                      item.image.id,
                    ),
                    hasMediumConfidence:
                      pageListStore.hasMediumConfidenceDetections(
                        item.image.id,
                      ),
                    hasUnverifiedDetections:
                      pageListStore.hasUnverifiedDetections(item.image.id),
                  }"
                  :verificationStatus="{
                    color: pageListStore.getVerificationStatusColor(
                      item.image.id,
                    ),
                    tooltip: pageListStore.getVerificationTooltip(
                      item.image.id,
                    ),
                  }"
                  :confidenceThresholds="{
                    low: pageListStore.LOW_CONFIDENCE_THRESHOLD,
                    medium: pageListStore.MEDIUM_CONFIDENCE_THRESHOLD,
                  }"
                  @click="navigateToImage"
                  @select="
                    (id, shiftKey) =>
                      pageListStore.toggleImageSelection(id, shiftKey)
                  "
                  @description-expand="handleDescriptionExpand"
                  :ref="
                    item.image.id === activeImageId
                      ? setActiveThumbnailRef
                      : undefined
                  "
                  :class="{
                    'q-virtual-scroll--with-prev':
                      index > 0 &&
                      virtualScrollItems[index - 1].type === 'image' &&
                      (virtualScrollItems[index - 1] as VirtualScrollImage)
                        .sectionId === item.sectionId,
                  }"
                />
              </div>
            </div>
          </template>
        </q-virtual-scroll>
      </div>
    </div>

    <!-- Bulk action toolbar - outside the scroll area to stay fixed at the bottom -->
    <div class="page-list-footer" v-if="enableBulkActions">
      <BulkActions
        :selectMode="pageListStore.selectMode"
        :selectedImages="pageListStore.selectedImages"
        @toggleSelectMode="pageListStore.toggleSelectMode"
        @selectAll="pageListStore.selectAll"
        @deselectAll="pageListStore.deselectAll"
        @markSelectedAsVerified="pageListStore.markSelectedAsVerified"
        @downloadSelected="pageListStore.downloadSelected"
        :layoutMode="props.layout"
        class="bulk-actions"
      >
        <template v-slot:page-count>
          {{ pageListStore.filteredImages.length }} of
          {{ currentCollection.collection?.images?.length || 0 }}
          pages
        </template>
      </BulkActions>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Main page list wrapper */
.page-list-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;

  /* Sidebar layout styles */
  &.layout-sidebar {
    border-right: 1px solid rgba(0, 0, 0, 0.12);
    padding: 12px;
    height: calc(100vh - 50px); /* Adjust based on header height */
    max-height: 100%;
  }

  /* Full width layout styles */
  &.layout-full-width {
    border: none;
    background-color: #f8f8f8;
  }
}

/* Header section */
.page-list-header {
  flex-shrink: 0;
  z-index: 20;
  background-color: white;

  .layout-full-width & {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }
}

/* Stats section */
.page-list-stats {
  flex-shrink: 0;
  z-index: 15;
  background-color: white;

  .layout-full-width & {
    background-color: #f8f8f8;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }
}

/* Main content area */
.page-list-content {
  flex: 1;
  min-height: 0; /* Important for flexbox to allow proper scrolling */
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .empty-collection {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
}

/* Scroll container */
.page-list-scroll-container {
  flex: 1;
  min-height: 0; /* Important for flexbox to allow proper scrolling */
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* Hide overflow but allow child elements to scroll */
}

/* Virtual scroll container */
.virtual-scroll-container {
  height: calc(100% - 48px); /* Subtract section controls height */
  width: 100%;
  background-color: #f8f8f8;
  overflow: auto; /* Ensure scrolling works */
  max-height: calc(
    100vh - 200px
  ); /* Ensures it doesn't expand beyond viewport height */
}

/* Footer with bulk actions */
.page-list-footer {
  position: relative;
  flex-shrink: 0;
  z-index: 100;

  .bulk-actions {
    width: 100%;
  }
}

/* Section controls */
.section-controls {
  margin-bottom: 8px;
  border-radius: 4px;
}

/* Virtual items */
.virtual-item {
  width: 100%;
  box-sizing: border-box;
}

/* Virtual item for section headers */
.virtual-item-section-header {
  padding: 4px 8px;
}

/* Virtual item for images */
.virtual-item-image {
  padding: 4px;

  &.view-grid {
    width: 100%;

    &.level-1 {
      padding-left: 16px;
    }

    &.level-2 {
      padding-left: 32px;
    }

    &.level-3 {
      padding-left: 48px;
    }
  }

  &.view-list-small,
  &.view-list-large {
    &.level-1 {
      padding-left: 16px;
    }

    &.level-2 {
      padding-left: 32px;
    }

    &.level-3 {
      padding-left: 48px;
    }
  }
}

/* Image container within virtual scroll */
.image-container-item {
  width: 100%;

  &.view-grid {
    display: flex;
    flex-wrap: wrap;
    padding: 8px;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    justify-content: flex-start;

    > * {
      // Use flex basis for proper grid layout
      flex: 0 0
        calc(
          (100% - (var(--grid-columns, 3) - 1) * 12px) / var(--grid-columns, 3)
        );
      max-width: calc(
        (100% - (var(--grid-columns, 3) - 1) * 12px) / var(--grid-columns, 3)
      );
      margin-bottom: 12px;
    }
  }

  &.level-1 {
    padding-left: 16px;
  }

  &.level-2 {
    padding-left: 32px;
  }

  &.level-3 {
    padding-left: 48px;
  }
}

/* Meta element sections */
.meta-element-section {
  margin-bottom: 0; /* Reduced from 16px to avoid extra spacing in virtual scroll */
  width: 100%;

  /* Section level styling */
  &.section-level-1,
  .section-level-1 {
    background-color: white;
  }

  &.section-level-2,
  .section-level-2 {
    background-color: #fafafa;
  }

  &.section-level-3,
  .section-level-3 {
    background-color: #f5f5f5;
  }
}

/* Section headers */
.section-header {
  background-color: #f5f5f5;
  transition: background-color 0.2s ease;
  position: relative;
  z-index: 10;

  &:hover {
    background-color: #e0e0e0;
  }

  /* Level specific styling */
  &.section-level-1 {
    background-color: #f5f5f5;

    &:hover {
      background-color: #e0e0e0;
    }
  }

  &.section-level-2 {
    background-color: #f0f0f0;

    &:hover {
      background-color: #e5e5e5;
    }
  }

  /* Level 3 styling */
  &.section-level-3 {
    background-color: #e8e8e8;

    &:hover {
      background-color: #dedede;
    }
  }
}

/* Empty state styling */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  margin: 16px;
}

/* Badge styles */
:deep(.q-badge) {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  margin-right: 0.25rem;

  &.q-badge--secondary {
    background-color: #2196f3;
  }
}

/* Utility class for virtual scroll */
:deep(.q-virtual-scroll--with-prev) {
  margin-top: -8px; /* Reduce gap between consecutive images */
}

/* Add CSS for grid rows */
.grid-row {
  display: flex;
  flex-wrap: nowrap;
  width: 100%;
  gap: 12px;
  padding: 8px;
  box-sizing: border-box;
  height: 330px; /* Increased to match virtual scroll size for grid */
  overflow: hidden;

  .grid-item {
    flex: 1 1 0;
    min-width: 0;
    max-width: calc(100% / var(--grid-columns, 3));
  }

  &.level-1 {
    padding-left: 16px;
  }

  &.level-2 {
    padding-left: 32px;
  }

  &.level-3 {
    padding-left: 48px;
  }
}
</style>
