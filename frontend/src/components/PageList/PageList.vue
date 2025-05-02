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
import { QScrollArea } from 'quasar';
import PageHeader from './PageHeader.vue';
import PageStatistics from './PageStatistics.vue';
import ImageThumbnail from './ImageThumbnail.vue';
import BulkActions from './BulkActions.vue';
import { useCollection } from 'src/stores/data/useCollection';
import { usePageListStore } from 'src/stores/ui/pageListStore';

// Optimization: Use a Map to cache filtered images by section - but keep it inside the reactive system
const filteredImagesCache = reactive(new Map());

// Define an interface for the image items
interface ImageItem {
  id: string;
  name: string;
  confidence?: number;
  order?: number;
  annotated?: boolean;
  detection_count?: number;
  annotated_detection_count?: number;
}

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
const sectionRefs = reactive(new Map<string, HTMLElement>());

// Default values for optional props
const showHeader = computed(() => props.showHeader !== false);
const showStatistics = computed(() => props.showStatistics !== false);
const enableBulkActions = computed(() => props.enableBulkActions !== false);

// Current active image
const activeImageId = computed(() => currentCollection.value.selectedImageId);

// Ref for the scroll area
const scrollAreaRef = ref<QScrollArea | null>(null);

// Optimization: virtual scrolling state
const isScrolling = ref(false);
const visibleStartIndex = ref(0);
const visibleEndIndex = ref(0);
const renderBuffer = 10; // Number of items to render above and below visible area

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

// Get filtered images with caching for better performance
function getFilteredImagesForSection(sectionId: string, images: ImageItem[]) {
  if (!images || !images.length) return [];

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

  // Optimization: Set up scroll event listener for virtual scrolling
  setupVirtualScrolling();

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

// Optimize the activeImageId watcher to avoid unnecessary scrolling
watch(
  activeImageId,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Small delay to ensure DOM is updated
      setTimeout(scrollToActiveImage, 100);
    }
  },
  { immediate: false },
);

// Optimization: Handle component activation/deactivation
onActivated(() => {
  setupVirtualScrolling();
});

onDeactivated(() => {
  if (scrollAreaRef.value) {
    const scrollEl = scrollAreaRef.value.getScrollTarget();
    scrollEl.removeEventListener('scroll', handleScroll);
  }
});

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

  // Remove scroll listener
  if (scrollAreaRef.value) {
    const scrollEl = scrollAreaRef.value.getScrollTarget();
    scrollEl.removeEventListener('scroll', handleScroll);
  }

  // Save expanded sections to localStorage
  saveExpandedSectionsToLocalStorage();
});

// Optimization: Virtual scrolling setup
function setupVirtualScrolling() {
  nextTick(() => {
    if (scrollAreaRef.value) {
      const scrollEl = scrollAreaRef.value.getScrollTarget();
      scrollEl.addEventListener('scroll', handleScroll, { passive: true });

      // Initial calculation of visible items
      calculateVisibleIndexes();
    }
  });
}

// Optimization: Debounced scroll handler
function handleScroll() {
  isScrolling.value = true;

  if (scrollDebounceTimeout) {
    window.clearTimeout(scrollDebounceTimeout);
  }

  // Only use scrolling optimization for performance, not for filtering
  scrollDebounceTimeout = window.setTimeout(() => {
    calculateVisibleIndexes();
    isScrolling.value = false;
    scrollDebounceTimeout = null;
  }, 100);
}

// Calculate which items should be visible based on scroll position
function calculateVisibleIndexes() {
  if (!scrollAreaRef.value) return;

  const scrollEl = scrollAreaRef.value.getScrollTarget();
  const scrollTop = scrollEl.scrollTop;
  const viewportHeight = scrollEl.clientHeight;

  // Simple estimation - assuming each item is around 100px tall
  // This would be more accurate with actual measurements of rendered items
  const itemHeight =
    pageListStore.viewMode === 'list-small'
      ? 80
      : pageListStore.viewMode === 'list-large'
        ? 150
        : 250;

  visibleStartIndex.value = Math.floor(scrollTop / itemHeight) - renderBuffer;
  visibleEndIndex.value =
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + renderBuffer;

  // Ensure we don't go below 0
  visibleStartIndex.value = Math.max(0, visibleStartIndex.value);
}

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

// Optimization: Improved scroll to active image
const scrollToActiveImage = async () => {
  if (!activeImageId.value || !scrollAreaRef.value) return;

  // Wait for DOM updates
  await nextTick();

  // Find the active thumbnail using its ref or a class selector as fallback
  if (activeThumbnailRef.value) {
    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
      if (scrollAreaRef.value && activeThumbnailRef.value) {
        // Scroll the element into view with smooth behavior
        scrollAreaRef.value.setScrollPosition(
          'vertical',
          activeThumbnailRef.value.offsetTop - 100,
          300,
        );
      }
    });
  } else {
    // Fallback to class selector if ref isn't available
    const activeThumbnail = document.querySelector(
      '.image-thumbnail.thumbnail-active',
    ) as HTMLElement;

    if (activeThumbnail && scrollAreaRef.value) {
      scrollAreaRef.value.setScrollPosition(
        'vertical',
        activeThumbnail.offsetTop - 100,
        300,
      );
    }
  }
};

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
  // Only check hierarchical data now
  return !collectionStore.value.metaElementSections.length;
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

// Optimization: Improved section toggle with ref-based scrolling
function handleSectionToggle(sectionId: string) {
  // Toggle the section first
  collectionStore.value.toggleSection(sectionId);

  // If the section is being expanded, scroll to it after a short delay to allow animation
  if (collectionStore.value.isSectionExpanded(sectionId)) {
    // Wait for the DOM to update and animation to start
    setTimeout(() => {
      const sectionEl = sectionRefs.get(sectionId);

      if (sectionEl && scrollAreaRef.value) {
        // Calculate scroll position - position the section header near the top with extra padding
        const scrollPosition = Math.max(0, sectionEl.offsetTop - 100);

        // Use smooth scrolling for better UX
        scrollAreaRef.value.setScrollPosition(
          'vertical',
          scrollPosition,
          400, // Slightly longer duration for smoother animation
        );
      }
    }, 150); // Longer delay for more reliable expansion
  }

  // Save expanded sections state
  saveExpandedSectionsToLocalStorage();
}

// Optimization: Cache section ref helper
function setSectionRef(el: HTMLElement | null, sectionId: string) {
  if (el) {
    sectionRefs.set(sectionId, el);
  }
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

      <!-- Image list with status indicators -->
      <div v-else class="page-list-scroll-container">
        <q-scroll-area class="page-list-scroll" ref="scrollAreaRef">
          <div
            v-if="currentCollection.loading || collectionStore.loading"
            class="flex flex-center q-pa-md"
          >
            <div class="column items-center">
              <q-spinner color="primary" size="40px" />
              <div class="text-subtitle1 q-mt-md">Loading images...</div>
            </div>
          </div>

          <!-- Hierarchical view (now the default and only view) -->
          <div class="hierarchical-container">
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
              v-if="collectionStore.metaElementSections.length === 0"
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

            <!-- Sections container -->
            <div v-else class="sections-container">
              <!-- Render each section -->
              <div
                v-for="section in collectionStore.metaElementSections"
                :key="section.id"
                class="meta-element-section q-mb-md"
                :ref="(el) => setSectionRef(el as HTMLElement, section.id)"
              >
                <!-- Section header -->
                <div
                  class="section-header q-pa-sm q-px-md cursor-pointer"
                  @click="handleSectionToggle(section.id)"
                >
                  <div class="row items-center no-wrap">
                    <q-icon
                      :name="
                        collectionStore.isSectionExpanded(section.id)
                          ? 'expand_more'
                          : 'chevron_right'
                      "
                      size="1.5em"
                      class="q-mr-sm"
                    />
                    <div class="text-subtitle1">
                      {{
                        section.meta_element_type?.display_name ||
                        section.meta_element_type?.name ||
                        section.id
                      }}
                    </div>
                    <q-badge color="primary" class="q-ml-sm">
                      {{ section.images?.length || 0 }} images
                    </q-badge>
                    <q-space />
                  </div>
                </div>

                <!-- Section content -->
                <q-slide-transition>
                  <div
                    v-if="collectionStore.isSectionExpanded(section.id)"
                    class="section-content q-pa-sm"
                  >
                    <!-- Empty section message -->
                    <div
                      v-if="!section.images || section.images.length === 0"
                      class="empty-section q-pa-md text-center"
                    >
                      <q-icon
                        name="image_not_supported"
                        size="32px"
                        color="grey-6"
                      />
                      <div class="text-caption q-mt-sm">
                        No images in this section
                      </div>
                    </div>

                    <!-- Section images -->
                    <template v-else>
                      <!-- Filter images based on current filters -->
                      <div
                        :class="[
                          'image-container',
                          `view-${pageListStore.viewMode}`,
                        ]"
                        :style="{
                          'grid-template-columns':
                            pageListStore.viewMode === 'grid'
                              ? `repeat(${pageListStore.effectiveGridColumns}, minmax(200px, 1fr))`
                              : 'none',
                        }"
                      >
                        <!-- Optimization: Use cached filtered images -->
                        <template v-if="section.images">
                          <ImageThumbnail
                            v-for="image in getFilteredImagesForSection(
                              section.id,
                              section.images,
                            )"
                            :key="image.id"
                            :image="image"
                            :isActive="image.id === activeImageId"
                            :isSelected="
                              pageListStore.selectedImages.includes(image.id)
                            "
                            :selectMode="pageListStore.selectMode"
                            :viewMode="pageListStore.viewMode"
                            :flags="{
                              needsAttention: pageListStore.needsAttention(
                                image.id,
                              ),
                              hasLowConfidence:
                                pageListStore.hasLowConfidenceDetections(
                                  image.id,
                                ),
                              hasMediumConfidence:
                                pageListStore.hasMediumConfidenceDetections(
                                  image.id,
                                ),
                              hasUnverifiedDetections:
                                pageListStore.hasUnverifiedDetections(image.id),
                            }"
                            :verificationStatus="{
                              color: pageListStore.getVerificationStatusColor(
                                image.id,
                              ),
                              tooltip: pageListStore.getVerificationTooltip(
                                image.id,
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
                            :ref="
                              image.id === activeImageId
                                ? setActiveThumbnailRef
                                : undefined
                            "
                          />
                        </template>
                      </div>
                    </template>
                  </div>
                </q-slide-transition>
              </div>
            </div>
          </div>

          <!-- Bottom spacer to ensure content doesn't get hidden under the fixed toolbar -->
          <div class="bottom-spacer"></div>
        </q-scroll-area>
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
}

/* Scroll area */
.page-list-scroll {
  height: 100%;
  width: 100%;
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

/* Hierarchical container */
.hierarchical-container {
  padding: 8px;
  width: 100%;
}

/* Section controls */
.section-controls {
  margin-bottom: 8px;
  border-radius: 4px;
}

/* Meta element sections */
.meta-element-section {
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 16px;
  transition: all 0.3s ease;

  .section-header {
    background-color: #f5f5f5;
    transition: background-color 0.2s ease;
    position: sticky;
    top: 0;
    z-index: 10;

    &:hover {
      background-color: #e0e0e0;
    }
  }

  .section-content {
    background-color: white;
    overflow: visible; /* Allow content to be fully visible */
  }
}

/* Image container */
.image-container {
  width: 100%;

  &.view-grid {
    display: grid;
    gap: 16px;
    padding: 16px;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  &.view-list-small,
  &.view-list-large {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }
}

/* Bottom spacer */
.bottom-spacer {
  height: 120px; /* Increased height to provide more space for the fixed BulkActions bar */
  width: 100%;
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

/* Empty section styling */
.empty-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.01);
  border-radius: 4px;
}
</style>
