<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useCurrentCollectionState } from 'stores/frontend-state';
import {
  useImageConfidence,
  useImageVerification,
  useImageStatusDisplay,
  useImageSelection,
  useImageFiltering,
} from 'src/composables';
import PageHeader from './PageHeader.vue';
import PageStatistics from './PageStatistics.vue';
import ImageThumbnail from './ImageThumbnail.vue';
import BulkActions from './BulkActions.vue';

const props = defineProps<{
  collectionId: string;
}>();

const emit = defineEmits<{
  (e: 'select-image', imageId: string): void;
}>();

const router = useRouter();
const route = useRoute();
const currentCollection = useCurrentCollectionState();

// View mode options
const viewModeOptions = [
  { value: 'list-small', icon: 'view_list' },
  { value: 'list-large', icon: 'view_headline' },
  { value: 'grid', icon: 'grid_view' },
];

// View mode control
const viewMode = ref('list-large'); // Default view mode

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

// Current active image
const activeImageId = computed(() => route.params.imageId as string);

// Load collection data when component mounts or collectionId changes
watch(() => props.collectionId, loadCollection, { immediate: true });

// Use the filtered images from the filtering composable
const filteredImages = computed(() => filtering.filteredImages.value);

async function loadCollection() {
  if (props.collectionId) {
    await currentCollection.loadCollection(props.collectionId);
  }
}

function navigateToImage(imageId: string) {
  if (selectMode.value) {
    toggleImageSelection(imageId);
  } else {
    // Emit the selected image ID to parent component
    emit('select-image', imageId);

    // Navigate to the image
    router.push({
      name: 'image',
      params: {
        collectionId: props.collectionId,
        imageId: imageId,
      },
    });
  }
}
</script>

<template>
  <div class="page-list">
    <!-- Header with filters and controls -->
    <PageHeader
      v-model:searchQuery="searchQuery"
      v-model:sortBy="sortBy"
      v-model:filterVerified="filterVerified"
      v-model:confidenceFilters="confidenceFilters"
    />

    <!-- Statistics and progress indicators -->
    <PageStatistics
      :statistics="statistics"
      :filterVerified="filterVerified"
      :searchQuery="searchQuery"
      :filteredImagesCount="filteredImages.length"
      :totalImagesCount="currentCollection.collection?.images?.length || 0"
      @resetFilters="resetFilters"
    />

    <!-- View mode selector -->
    <div class="view-mode-selector">
      <div class="view-mode-container q-px-md q-py-sm">
        <div class="row items-center">
          <div class="col-auto text-body2 text-weight-medium q-mr-sm">
            View:
          </div>
          <div class="col">
            <q-btn-toggle
              v-model="viewMode"
              :options="viewModeOptions"
              spread
              elevated
              dense
              class="view-toggle"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Image list with status indicators -->
    <div class="page-list-content">
      <q-scroll-area class="page-list-scroll">
        <div v-if="currentCollection.loading" class="flex flex-center q-pa-md">
          <q-spinner color="primary" size="40px" />
        </div>

        <div
          v-else-if="!filteredImages.length"
          class="empty-state q-pa-md text-center"
        >
          <q-icon name="image_not_supported" size="48px" color="grey-6" />
          <div class="text-subtitle1 q-mt-sm">No pages found</div>
          <div class="text-caption text-grey-7">Try adjusting your filters</div>
          <q-btn
            flat
            color="primary"
            class="q-mt-sm"
            label="Reset filters"
            @click="resetFilters"
          />
        </div>

        <div v-else :class="['image-container', `view-${viewMode}`]">
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
      :selectMode="selectMode"
      :selectedImages="selectedImages"
      @toggleSelectMode="toggleSelectMode"
      @selectAll="selectAll"
      @deselectAll="deselectAll"
      @markSelectedAsVerified="markSelectedAsVerified"
      @downloadSelected="downloadSelected"
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
.page-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.view-mode-selector {
  flex-shrink: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.view-toggle {
  width: 100%;
  max-width: 300px;

  :deep(.q-btn__content) {
    flex-direction: column;

    i {
      margin-bottom: 2px;
      font-size: 18px;
    }
  }
}

.page-list-content {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
}

.page-list-scroll {
  height: 100%;
  width: 100%;
}

.image-container {
  padding: 8px;

  &.view-list-small,
  &.view-list-large {
    display: flex;
    flex-direction: column;
  }

  &.view-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
    gap: 8px;
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
}
</style>
