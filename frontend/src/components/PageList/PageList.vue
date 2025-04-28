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
} from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';
import {
  useImageConfidence,
  useImageVerification,
  useImageStatusDisplay,
  useImageSelection,
  useImageFiltering,
} from 'src/composables';
import { QScrollArea } from 'quasar';
import PageHeader from './PageHeader.vue';
import PageStatistics from './PageStatistics.vue';
import ImageThumbnail from './ImageThumbnail.vue';
import BulkActions from './BulkActions.vue';

interface PageListProps {
  collectionId: string;
  showHeader?: boolean;
  showStatistics?: boolean;
  showViewModeSelector?: boolean;
  enableBulkActions?: boolean;
  layout?: 'full-width' | 'sidebar';
  initialViewMode?: 'list-small' | 'list-large' | 'grid';
  gridColumns?: number;
}

// Define props with defaults
const props = withDefaults(defineProps<PageListProps>(), {
  showHeader: false,
  showStatistics: false,
  showViewModeSelector: false,
  enableBulkActions: false,
  layout: 'sidebar',
});

const emit = defineEmits<{
  (e: 'select-image', imageId: string): void;
  (e: 'layout-change', layout: string): void;
  (e: 'view-mode-change', viewMode: string): void;
}>();

// Use shallowRef for complex objects that don't need deep reactivity
const currentCollection = shallowRef(useCurrentCollectionState());

// Default values for optional props
const showHeader = computed(() => props.showHeader !== false);
const showStatistics = computed(() => props.showStatistics !== false);
const enableBulkActions = computed(() => props.enableBulkActions !== false);

// Current active image
const activeImageId = computed(() => currentCollection.value.selectedImageId);

// View mode options - with and without labels
const viewModeOptions = computed(() => {
  const options = [
    { value: 'list-small', icon: 'view_list', label: 'Compact' },
    { value: 'list-large', icon: 'view_headline', label: 'Details' },
    { value: 'grid', icon: 'grid_view', label: 'Grid' },
  ];

  // If in sidebar mode, remove labels
  if (props.layout === 'sidebar') {
    return options.map((option) => ({
      value: option.value,
      icon: option.icon,
    }));
  }

  return options;
});

// View mode control - use initialViewMode prop if provided
const viewMode = ref(props.initialViewMode || 'list-large');

// Watch for changes to initialViewMode prop
watch(
  () => props.initialViewMode,
  (newMode) => {
    if (newMode && newMode !== viewMode.value) {
      viewMode.value = newMode;
    }
  },
);

// Use composables
const verification = useImageVerification();
const confidence = useImageConfidence();
const selection = useImageSelection();
const statusDisplay = useImageStatusDisplay(
  confidence.getConfidenceLevel,
  verification.getImageVerificationStatus,
  confidence.hasLowConfidenceDetections,
  confidence.hasMediumConfidenceDetections,
  verification.hasUnverifiedDetections,
);
const filtering = useImageFiltering(
  verification.getImageVerificationStatus,
  (id: string) =>
    confidence.getAttentionLevel(id, verification.hasUnverifiedDetections),
  (id: string) =>
    confidence.needsAttention(id, verification.hasUnverifiedDetections),
  confidence.hasLowConfidenceDetections,
  confidence.hasMediumConfidenceDetections,
);

// Convenience aliases
const {
  LOW_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  hasLowConfidenceDetections,
  hasMediumConfidenceDetections,
} = confidence;
const { hasUnverifiedDetections } = verification;
const { getVerificationStatusColor, getVerificationTooltip, statistics } =
  statusDisplay;
const { sortBy, filterVerified, searchQuery, resetFilters, confidenceFilters } =
  filtering;
const {
  selectedImages,
  selectMode,
  toggleImageSelection,
  toggleSelectMode,
  selectAll,
  deselectAll,
  markSelectedAsVerified,
  downloadSelected,
} = selection;

// Ref for the scroll area
const scrollAreaRef = ref<QScrollArea | null>(null);

// Response to view mode changes
watch(viewMode, (newMode) => {
  localStorage.setItem(
    `pagelist-viewmode-${props.layout || 'default'}`,
    newMode,
  );
  emit('view-mode-change', newMode);
});

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

// Clean up event listeners
onBeforeUnmount(() => {
  if (resizeTimeout) {
    window.clearTimeout(resizeTimeout);
  }
});

// Function to scroll to active image with requestAnimationFrame
const scrollToActiveImage = async () => {
  if (!activeImageId.value || !scrollAreaRef.value) return;

  // Wait for DOM updates
  await nextTick();

  // Use requestAnimationFrame for smoother scrolling
  requestAnimationFrame(() => {
    const activeThumbnail = document.querySelector(
      '.image-thumbnail.thumbnail-active',
    ) as HTMLElement;

    if (activeThumbnail && scrollAreaRef.value) {
      // Scroll the element into view with smooth behavior
      scrollAreaRef.value.setScrollPosition(
        'vertical',
        activeThumbnail.offsetTop - 100,
        300,
      );
    }
  });
};

// Load collection data when component mounts or collectionId changes
watch(() => props.collectionId, loadCollection, { immediate: true });

// Use the filtered images from the filtering composable
const filteredImages = computed(() => filtering.filteredImages.value);

// Determine if the collection is empty
const isCollectionEmpty = computed(() => {
  if (!currentCollection.value.collection?.images) return true;
  return currentCollection.value.collection.images.length === 0;
});

// Add userGridColumns ref to track user's column preference
const userGridColumns = ref(
  props.gridColumns || (props.layout === 'sidebar' ? 1 : 4),
);

// Update gridColumns computed property to use the user's preference
const effectiveGridColumns = computed(() => {
  // If view mode is not grid, always use 1 column
  if (viewMode.value !== 'grid') {
    return 1;
  }

  // Otherwise use the user's column preference
  return userGridColumns.value;
});

// Debounce variable for resize
let resizeTimeout: number | null = null;

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

// Optimized image navigation with proper type checking
function navigateToImage(imageId: string) {
  if (selectMode.value) {
    toggleImageSelection(imageId);
  } else {
    // Update selected image in the collection state
    currentCollection.value.selectImage(imageId);

    // Emit the selected image ID to parent component
    emit('select-image', imageId);
  }
}

// Load saved preferences from localStorage
onMounted(() => {
  const savedViewMode = localStorage.getItem(
    `pagelist-viewmode-${props.layout || 'default'}`,
  );
  if (
    savedViewMode &&
    viewModeOptions.value.some((option) => option.value === savedViewMode)
  ) {
    viewMode.value = savedViewMode as 'list-small' | 'list-large' | 'grid';
  }

  // Load saved grid columns preference
  const savedColumns = localStorage.getItem(
    `pagelist-grid-columns-${props.layout || 'default'}`,
  );
  if (savedColumns && !isNaN(parseInt(savedColumns))) {
    userGridColumns.value = parseInt(savedColumns);
  }
});
</script>

<template>
  <div class="page-list q-pa-md" :class="[`layout-${props.layout}`]">
    <!-- Header with filters and controls - more compact in fullscreen mode -->
    <PageHeader
      v-if="showHeader"
      v-model:searchQuery="searchQuery"
      v-model:sortBy="sortBy"
      v-model:filterVerified="filterVerified"
      v-model:confidenceFilters="confidenceFilters"
      v-model:viewMode="viewMode"
      v-model:userGridColumns="userGridColumns"
      :class="{ 'header-fullscreen': props.layout === 'full-width' }"
      :layoutMode="props.layout"
      :compact="props.layout === 'full-width'"
      @locate-active-image="scrollToActiveImage"
    />

    <!-- Statistics and progress indicators - more compact in fullscreen -->
    <PageStatistics
      v-if="showStatistics"
      :statistics="statistics"
      :filterVerified="filterVerified"
      :searchQuery="searchQuery"
      :filteredImagesCount="filteredImages.length"
      :totalImagesCount="currentCollection.collection?.images?.length || 0"
      @resetFilters="resetFilters"
      :class="{ 'stats-fullscreen': props.layout === 'full-width' }"
      :layoutMode="props.layout"
      :compact="props.layout === 'full-width'"
    />

    <!-- Empty Collection State -->
    <div
      v-if="isCollectionEmpty && !currentCollection.loading"
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
    <div v-else class="page-list-content">
      <q-scroll-area class="page-list-scroll" ref="scrollAreaRef">
        <div v-if="currentCollection.loading" class="flex flex-center q-pa-md">
          <div class="column items-center">
            <q-spinner color="primary" size="40px" />
            <div class="text-subtitle1 q-mt-md">Loading images...</div>
          </div>
        </div>

        <div
          v-else-if="!filteredImages.length"
          class="empty-state q-pa-xl text-center"
        >
          <q-icon name="filter_alt_off" size="48px" color="grey-6" />
          <div class="text-subtitle1 q-mt-sm">No pages match your filters</div>
          <div class="text-caption text-grey-7">
            Try adjusting your search or filter criteria
          </div>
          <q-btn
            flat
            color="primary"
            class="q-mt-sm"
            label="Reset filters"
            @click="resetFilters"
          />
        </div>

        <div
          v-else
          :class="[
            'image-container',
            `view-${viewMode}`,
            `grid-cols-${effectiveGridColumns}`,
          ]"
        >
          <!-- Use optimized rendering for thumbnails -->
          <ImageThumbnail
            v-for="image in filteredImages"
            :key="image.id"
            :image="image"
            :isActive="image.id === activeImageId"
            :isSelected="selectedImages.includes(image.id)"
            :selectMode="selectMode"
            :needsAttention="
              confidence.needsAttention(image.id, hasUnverifiedDetections)
            "
            :hasLowConfidence="hasLowConfidenceDetections(image.id)"
            :hasMediumConfidence="hasMediumConfidenceDetections(image.id)"
            :hasUnverifiedDetections="hasUnverifiedDetections(image.id)"
            :verificationStatusColor="getVerificationStatusColor(image.id)"
            :verificationTooltip="getVerificationTooltip(image.id)"
            :viewMode="viewMode"
            :LOW_CONFIDENCE_THRESHOLD="LOW_CONFIDENCE_THRESHOLD"
            :MEDIUM_CONFIDENCE_THRESHOLD="MEDIUM_CONFIDENCE_THRESHOLD"
            @click="navigateToImage"
            @select="toggleImageSelection"
          />
        </div>

        <!-- Add some bottom padding to ensure scroll area can scroll past the last thumbnail -->
        <div class="q-pa-lg"></div>
      </q-scroll-area>
    </div>

    <!-- Bulk action toolbar at the bottom -->
    <BulkActions
      v-if="enableBulkActions"
      :selectMode="selectMode"
      :selectedImages="selectedImages"
      @toggleSelectMode="toggleSelectMode"
      @selectAll="selectAll"
      @deselectAll="deselectAll"
      @markSelectedAsVerified="markSelectedAsVerified"
      @downloadSelected="downloadSelected"
      :class="{ 'actions-fullscreen': props.layout === 'full-width' }"
      :layoutMode="props.layout"
    >
      <template v-slot:page-count>
        {{ filteredImages.length }} of
        {{ currentCollection.collection?.images?.length || 0 }}
        pages
      </template>
    </BulkActions>
  </div>
</template>

<style lang="scss" scoped>
// Define CSS variables for easy theming
:root {
  --page-list-border-color: rgba(0, 0, 0, 0.12);
  --page-list-shadow-color: rgba(0, 0, 0, 0.05);
  --page-list-bg-light: #f8f8f8;
  --page-list-bg-white: white;
  --page-list-spacing-sm: 8px;
  --page-list-spacing-md: 16px;
  --page-list-spacing-lg: 24px;
}

.page-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  // Use CSS containment for better performance
  contain: layout style;

  &.layout-sidebar {
    border-right: 1px solid var(--page-list-border-color);
    width: 100%;
  }

  &.layout-full-width {
    max-width: 100%;
    padding: 0;
    border: none;
    background-color: var(--page-list-bg-light);

    .header-fullscreen {
      padding: 8px var(--page-list-spacing-md);
      background: var(--page-list-bg-white);
      border-bottom: 1px solid var(--page-list-border-color);
      box-shadow: 0 2px 4px var(--page-list-shadow-color);
    }

    .stats-fullscreen {
      padding: 6px var(--page-list-spacing-md);
      background: var(--page-list-bg-light);
      border-bottom: 1px solid var(--page-list-border-color);
    }

    .actions-fullscreen {
      padding: 6px var(--page-list-spacing-md);
      background: var(--page-list-bg-white);
      border-top: 1px solid var(--page-list-border-color);
      box-shadow: 0 -2px 4px var(--page-list-shadow-color);
    }

    .image-container {
      &.view-grid {
        padding: var(--page-list-spacing-md);
        gap: var(--page-list-spacing-md);
      }

      &.view-list-small,
      &.view-list-large {
        padding: var(--page-list-spacing-md);
      }
    }
  }
}

.page-list-content {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
  // Use contain to optimize performance
  contain: content;
}

.page-list-scroll {
  height: 100%;
  width: 100%;
  // Optimize scroll performance
  will-change: scroll-position;
  overscroll-behavior: contain;
}

.image-container {
  padding: var(--page-list-spacing-sm);
  // Use CSS containment for better performance
  contain: layout style;

  &.view-list-small,
  &.view-list-large {
    display: flex;
    flex-direction: column;
    gap: var(--page-list-spacing-sm);
  }

  &.view-grid {
    display: grid;
    gap: 16px;

    // Dynamic grid columns based on the gridColumns prop
    @for $i from 1 through 12 {
      &.grid-cols-#{$i} {
        grid-template-columns: repeat($i, 1fr);
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  margin: 16px;
}

.empty-collection {
  flex-grow: 1;
  text-align: center;
}
</style>
