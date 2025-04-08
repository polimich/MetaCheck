<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { getPreviewImage } from 'utils';

const props = defineProps<{
  collectionId: string;
}>();

const router = useRouter();
const route = useRoute();
const currentCollection = useCurrentCollectionState();

// Selection state
const selectedImages = ref<string[]>([]);
const selectMode = ref(false);
const searchQuery = ref('');

// Filter and sort
const sortBy = ref('order'); // 'order', 'name', 'date'
const filterVerified = ref('all'); // 'all', 'verified', 'unverified', 'partial'

// Current active image
const activeImageId = computed(() => route.params.imageId as string);

// Load collection data when component mounts or collectionId changes
watch(() => props.collectionId, loadCollection, { immediate: true });

// Filter and sort the images
const filteredImages = computed(() => {
  if (!currentCollection.collection || !currentCollection.collection.images)
    return [];

  let images = [...currentCollection.collection.images];

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
      // We would need to get the verification status from a store
      // This is a placeholder - replace with actual verification logic
      const verificationStatus = getImageVerificationStatus(img.id);
      return verificationStatus === filterVerified.value;
    });
  }

  // Sort images
  switch (sortBy.value) {
    case 'name':
      return images.sort((a, b) => a.name.localeCompare(b.name));
    case 'date':
      // Fallback to comparison by ID if dates aren't available
      return images.sort((a, b) => b.id.localeCompare(a.id));
    case 'order':
    default:
      // Sort by ID as a stable default sort
      return images.sort((a, b) => a.id.localeCompare(b.id));
  }
});

// Get image verification status (placeholder function)
function getImageVerificationStatus(imageId: string): string {
  // This should be replaced with actual logic to determine if an image is fully verified,
  // partially verified, or not verified at all
  // Mock implementation for demonstration:
  const mockStatuses = {
    verified: ['00001', '00003', '00005'],
    partial: ['00002', '00006'],
    unverified: ['00004', '00007', '00008'],
  };

  if (mockStatuses.verified.includes(imageId.slice(-5))) return 'verified';
  if (mockStatuses.partial.includes(imageId.slice(-5))) return 'partial';
  return 'unverified';
}

async function loadCollection() {
  if (props.collectionId) {
    await currentCollection.loadCollection(props.collectionId);
  }
}

function navigateToImage(imageId: string) {
  if (selectMode.value) {
    toggleImageSelection(imageId);
  } else {
    router.push({
      name: 'image',
      params: {
        collectionId: props.collectionId,
        imageId: imageId,
      },
    });
  }
}

function toggleImageSelection(imageId: string) {
  const index = selectedImages.value.indexOf(imageId);
  if (index === -1) {
    selectedImages.value.push(imageId);
  } else {
    selectedImages.value.splice(index, 1);
  }
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  if (!selectMode.value) {
    selectedImages.value = [];
  }
}

function selectAll() {
  if (!currentCollection.collection?.images) return;

  selectedImages.value = currentCollection.collection.images.map(
    (img) => img.id,
  );
}

function deselectAll() {
  selectedImages.value = [];
}

function markSelectedAsVerified() {
  // Implement this function to mark selected images as verified
  console.log('Mark as verified:', selectedImages.value);
  // After processing, you might want to:
  deselectAll();
  selectMode.value = false;
}

function downloadSelected() {
  // Implement this function to download selected images
  console.log('Download:', selectedImages.value);
}

// Image thumbnail size control - updated to use slider with larger range
const thumbnailSize = ref(300); // px
const minThumbnailSize = 250;
const maxThumbnailSize = 350;

// Verification status helpers
function getVerificationStatusColor(imageId: string): string {
  const status = getImageVerificationStatus(imageId);
  if (status === 'verified') return 'green-8';
  if (status === 'partial') return 'orange-8';
  return 'grey-7';
}

function getVerificationTooltip(imageId: string): string {
  const status = getImageVerificationStatus(imageId);
  if (status === 'verified') return 'All annotations verified';
  if (status === 'partial') return 'Some annotations verified';
  return 'No annotations verified';
}
</script>

<template>
  <div class="page-list">
    <!-- Header with title and search -->
    <div class="page-list-header q-pa-sm">
      <div class="text-h6 q-mb-sm">Pages</div>

      <q-input
        v-model="searchQuery"
        dense
        outlined
        placeholder="Search pages"
        class="q-mb-sm"
      >
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>

      <!-- Filters and sort -->
      <div class="row q-col-gutter-xs q-mb-sm">
        <div class="col-6">
          <q-select
            v-model="sortBy"
            dense
            outlined
            options-dense
            :options="[
              { label: 'Page Order', value: 'order' },
              { label: 'Name', value: 'name' },
              { label: 'Date Added', value: 'date' },
            ]"
            emit-value
            map-options
            label="Sort by"
          />
        </div>
        <div class="col-6">
          <q-select
            v-model="filterVerified"
            dense
            outlined
            options-dense
            :options="[
              { label: 'All', value: 'all' },
              { label: 'Verified', value: 'verified' },
              { label: 'Partial', value: 'partial' },
              { label: 'Unverified', value: 'unverified' },
            ]"
            emit-value
            map-options
            label="Status"
          />
        </div>
      </div>

      <!-- Thumbnail size slider -->
      <div class="q-mb-sm">
        <div class="row items-center">
          <div class="col-3 text-caption text-grey-8">Size:</div>
          <div class="col-9">
            <q-slider
              v-model="thumbnailSize"
              :min="minThumbnailSize"
              :max="maxThumbnailSize"
              label
              label-always
              color="primary"
            />
          </div>
        </div>
      </div>

      <!-- Toolbar for selection mode -->
      <div class="selection-toolbar q-mb-sm filter-bar q-pa-xs">
        <q-btn-group flat>
          <q-btn
            flat
            dense
            :color="selectMode ? 'primary' : 'grey'"
            :icon="selectMode ? 'check_box' : 'check_box_outline_blank'"
            @click="toggleSelectMode"
          >
            <q-tooltip>{{
              selectMode ? 'Exit selection mode' : 'Select images'
            }}</q-tooltip>
          </q-btn>

          <q-btn
            v-if="selectMode"
            flat
            dense
            icon="select_all"
            @click="selectAll"
          >
            <q-tooltip>Select all</q-tooltip>
          </q-btn>

          <q-btn
            v-if="selectMode && selectedImages.length > 0"
            flat
            dense
            icon="deselect"
            @click="deselectAll"
          >
            <q-tooltip>Deselect all</q-tooltip>
          </q-btn>
        </q-btn-group>

        <div v-if="selectMode" class="q-ml-auto">
          <q-badge color="primary" class="q-mr-xs">
            {{ selectedImages.length }} selected
          </q-badge>

          <q-btn-dropdown
            v-if="selectedImages.length > 0"
            flat
            dense
            color="primary"
            icon="more_vert"
            menu-anchor="bottom right"
            menu-self="top right"
          >
            <q-list>
              <q-item clickable v-close-popup @click="markSelectedAsVerified">
                <q-item-section avatar>
                  <q-icon color="green" name="verified" />
                </q-item-section>
                <q-item-section>Mark as verified</q-item-section>
              </q-item>

              <q-item clickable v-close-popup @click="downloadSelected">
                <q-item-section avatar>
                  <q-icon name="download" />
                </q-item-section>
                <q-item-section>Download</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
      </div>
    </div>

    <!-- Results count -->
    <div class="q-px-sm q-mb-sm text-caption text-grey-8 flex justify-between">
      <div>
        Showing {{ filteredImages.length }} of
        {{ currentCollection.collection?.images?.length || 0 }} pages
        <template v-if="filterVerified !== 'all'">
          ({{ filterVerified }} only)
        </template>
      </div>
    </div>

    <!-- Image list with status indicators -->
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
      </div>

      <div v-else class="image-grid q-pa-sm">
        <div
          v-for="image in filteredImages"
          :key="image.id"
          class="image-item q-mb-md"
          :class="{
            'image-active': image.id === activeImageId,
            'image-selected': selectedImages.includes(image.id),
          }"
          @click="navigateToImage(image.id)"
        >
          <div class="image-container" :style="`height: ${thumbnailSize}px`">
            <q-img
              :src="getPreviewImage(image.id)"
              :height="`${thumbnailSize}px`"
              fit="cover"
            >
              <template v-slot:loading>
                <q-spinner-dots color="white" />
              </template>

              <div class="absolute-top-right q-pa-xs">
                <q-badge :color="getVerificationStatusColor(image.id)" rounded>
                  <q-tooltip>{{ getVerificationTooltip(image.id) }}</q-tooltip>
                </q-badge>
              </div>

              <div v-if="selectMode" class="absolute-top-left q-pa-xs">
                <q-checkbox
                  v-model="selectedImages"
                  :val="image.id"
                  dark
                  dense
                  @click.stop
                />
              </div>
            </q-img>
          </div>
          <div class="image-name text-caption q-px-xs q-py-xs ellipsis">
            {{ image.name }}
          </div>
        </div>
      </div>
    </q-scroll-area>

    <!-- Footer with stats -->
    <div class="page-list-footer q-px-sm q-py-xs text-caption text-grey">
      {{ filteredImages.length }} of
      {{ currentCollection.collection?.images?.length || 0 }} pages
    </div>
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

.page-list-header {
  flex-shrink: 0;
}

.page-list-scroll {
  flex-grow: 1;
}

.page-list-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.selection-toolbar {
  display: flex;
  align-items: center;
}

.filter-bar {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.image-grid {
  display: flex;
  flex-direction: column;
}

.image-item {
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  }

  &.image-active {
    border-color: $primary;
  }

  &.image-selected {
    border-color: $primary;
    background-color: rgba($primary, 0.05);
  }
}

.image-container {
  width: 100%;
  overflow: hidden;
}

.image-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
