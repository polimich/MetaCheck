<script setup lang="ts">
import { computed, ref } from 'vue';
import { getPreviewImage } from 'src/utils/imageUtils';
import ConfidenceIndicator from './ConfidenceIndicator.vue';
import ConfidenceBadge from './ConfidenceBadge.vue';

// Improved props structure with fewer props
const props = defineProps({
  image: {
    type: Object,
    required: true,
  },
  isActive: {
    type: Boolean,
    required: true,
  },
  isSelected: {
    type: Boolean,
    required: true,
  },
  selectMode: {
    type: Boolean,
    required: true,
  },
  viewMode: {
    type: String,
    required: true,
  },
  confidenceThresholds: {
    type: Object,
    required: true,
    default: () => ({
      low: 0.5,
      medium: 0.8,
    }),
  },
  verificationStatus: {
    type: Object,
    required: true,
    default: () => ({
      color: '',
      tooltip: '',
    }),
  },
  flags: {
    type: Object,
    required: true,
    default: () => ({
      needsAttention: false,
      hasLowConfidence: false,
      hasMediumConfidence: false,
      hasUnverifiedDetections: false,
    }),
  },
});

const emit = defineEmits(['click', 'select']);

// Track if details are shown
const showDetails = ref(false);

// Keep track of loading state
const isLoading = ref(false);

function handleClick(event: MouseEvent) {
  emit('click', props.image.id, event.shiftKey);
}

function handleSelect(event: MouseEvent | null = null) {
  const shiftKey = event ? event.shiftKey : false;
  emit('select', props.image.id, shiftKey);
}

// Handle image load start event
function handleImageLoadStart() {
  isLoading.value = true;
}

// Handle image load complete event
function handleImageLoaded() {
  isLoading.value = false;
}

// Toggle details visibility
function toggleDetails() {
  showDetails.value = !showDetails.value;
}

const thumbnailClass = computed(() => {
  return {
    'thumbnail-list-small': props.viewMode === 'list-small',
    'thumbnail-list-large': props.viewMode === 'list-large',
    'thumbnail-grid': props.viewMode === 'grid',
    'thumbnail-active': props.isActive,
    'thumbnail-selected': props.isSelected,
    'thumbnail-needs-attention': props.flags.needsAttention,
    'thumbnail-loading': isLoading.value,
    'details-visible': showDetails.value,
  };
});

const annotationProgressPercentage = computed(() => {
  if (props.image.detection_count === 0) return 0;
  return Math.round(
    (props.image.annotated_detection_count / props.image.detection_count) * 100,
  );
});

const annotationProgressClass = computed(() => {
  const percentage = annotationProgressPercentage.value;
  if (percentage >= 90) return 'text-green';
  if (percentage >= 50) return 'text-orange';
  return 'text-red';
});

// Format confidence for display
const formatConfidence = (confidence: number) => {
  return confidence ? `${Math.round(confidence * 100)}%` : '';
};

// Get confidence color based on value
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'green-8';
  if (confidence >= 0.5) return 'orange-8';
  return 'red-8';
};

// Use a tiny transparent placeholder image to prevent flashing
const placeholderImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Create image src
const imageSrc = computed(() => {
  return getPreviewImage(props.image.id);
});

// Truncate filename for display
const truncatedName = computed(() => {
  const name = props.image.name;
  if (name.length > 20) {
    return name.substring(0, 17) + '...';
  }
  return name;
});
</script>

<template>
  <div :class="['image-thumbnail', thumbnailClass]" @click="handleClick">
    <!-- Selection checkbox -->
    <div
      v-if="selectMode"
      class="selection-indicator"
      @click.stop="handleSelect($event)"
    >
      <q-checkbox :modelValue="isSelected" @update:modelValue="handleSelect" />
    </div>

    <div class="thumbnail-content">
      <!-- Image preview area - displayed by default -->
      <div class="image-preview-area" v-if="!showDetails">
        <!-- Order badge - top right -->
        <q-badge color="primary" class="order-badge">
          {{ image.order }}
          <q-tooltip>Page order: {{ image.order }}</q-tooltip>
        </q-badge>

        <!-- Confidence badge - top left (using the new component) -->
        <ConfidenceBadge
          :hasLowConfidence="flags.hasLowConfidence"
          :hasMediumConfidence="flags.hasMediumConfidence"
          :detectionCount="image.detection_count"
        />

        <!-- Image wrapper with page index badge inside -->
        <div class="image-wrapper">
          <div class="image-center-wrapper">
            <q-img
              :src="imageSrc"
              :ratio="0"
              style="height: 100%; width: 100%"
              object-fit="contain"
              native-context-menu
              img-class="image-cache"
              @load="handleImageLoaded"
              @loading="handleImageLoadStart"
              loading="lazy"
              :placeholder-src="placeholderImage"
              spinner-color="primary"
              spinner-size="42px"
              no-spinner-fade
            >
              <template v-slot:loading>
                <q-spinner-dots color="white" />
              </template>
            </q-img>
          </div>

          <!-- Page index badge - bottom right inside the image wrapper -->
          <q-badge
            v-if="image.page_index"
            color="grey-9"
            class="page-index-badge"
          >
            {{ image.page_index }}
            <q-tooltip>
              Page Number: {{ image.page_index }}
              <div v-if="image.page_index_confidence">
                Confidence: {{ formatConfidence(image.page_index_confidence) }}
              </div>
            </q-tooltip>
          </q-badge>

          <ConfidenceIndicator
            :hasLowConfidence="flags.hasLowConfidence"
            :hasMediumConfidence="flags.hasMediumConfidence"
          />
        </div>

        <!-- Image name - truncated with reduced height -->
        <div class="image-name-compact">
          <div class="truncated-name">{{ truncatedName }}</div>

          <!-- Progress bar for annotations -->
          <q-linear-progress
            v-if="image.detection_count > 0"
            :value="annotationProgressPercentage / 100"
            :color="annotationProgressClass.replace('text-', '')"
            class="q-mt-xs"
            size="xs"
          >
            <q-tooltip>
              Annotation progress: {{ annotationProgressPercentage }}%
            </q-tooltip>
          </q-linear-progress>
        </div>
      </div>

      <!-- Details view - shown when toggled -->
      <div class="details-view" v-else>
        <div class="image-details text-caption q-pa-md">
          <!-- Image name -->
          <div class="row q-mb-sm">
            <q-icon
              name="drive_file_rename_outline"
              size="xs"
              class="q-mr-xs"
            />
            <span class="text-weight-medium">Name: </span>
            <span class="q-ml-xs full-name">{{ image.name }}</span>
          </div>

          <!-- Verification status right under name -->
          <div class="row q-mb-sm" v-if="flags.hasUnverifiedDetections">
            <q-icon name="check_circle_outline" size="xs" class="q-mr-xs" />
            <span class="text-weight-medium">Verification: </span>
            <span class="text-grey-7 q-ml-xs">Unverified</span>
          </div>

          <!-- Page Information row -->
          <div class="row q-mb-sm">
            <div class="col-6">
              <q-icon name="format_list_numbered" size="xs" class="q-mr-xs" />
              <span class="text-weight-medium">Page: </span>
              <span class="q-ml-xs">{{ image.page_index || 'N/A' }}</span>
              <q-badge
                v-if="image.page_index_confidence"
                class="mini-badge q-ml-xs"
                :color="getConfidenceColor(image.page_index_confidence)"
              >
                {{ formatConfidence(image.page_index_confidence) }}
              </q-badge>
            </div>

            <div class="col-6">
              <q-icon name="sort" size="xs" class="q-mr-xs" />
              <span class="text-weight-medium">Order: </span>
              <span class="q-ml-xs">{{ image.order }}</span>
            </div>
          </div>

          <!-- Page Type row -->
          <div class="row q-mb-sm" v-if="image.page_type">
            <q-icon name="category" size="xs" class="q-mr-xs" />
            <span class="text-weight-medium">Page Type: </span>
            <span class="q-ml-xs">{{ image.page_type }}</span>
            <q-badge
              v-if="image.page_type_confidence"
              class="mini-badge q-ml-xs"
              :color="getConfidenceColor(image.page_type_confidence)"
            >
              {{ formatConfidence(image.page_type_confidence) }}
            </q-badge>
          </div>

          <!-- Confidence row -->
          <div class="row q-mb-sm">
            <q-icon name="equalizer" size="xs" class="q-mr-xs" />
            <span class="text-weight-medium">Overall confidence: </span>
            <span v-if="flags.hasLowConfidence" class="text-red q-ml-xs">
              Low confidence
            </span>
            <span
              v-else-if="flags.hasMediumConfidence"
              class="text-orange q-ml-xs"
            >
              Medium confidence ({{ confidenceThresholds.medium * 100 }}%)
            </span>
            <span
              v-else-if="image.detection_count > 0"
              class="text-green q-ml-xs"
            >
              High confidence
            </span>
            <span v-else class="text-grey q-ml-xs">No detections</span>
          </div>

          <!-- Detection Statistics Section -->
          <div class="detection-stats q-mt-sm">
            <div class="row q-mb-xs">
              <q-icon name="analytics" size="xs" class="q-mr-xs" />
              <span class="text-weight-medium">Detection Stats:</span>
            </div>

            <!-- Stats in two columns -->
            <div class="row q-mb-xs q-pl-sm">
              <div class="col-6">
                <div class="row q-mb-xs">
                  <q-icon name="image_search" size="xs" class="q-mr-xs" />
                  <span class="text-weight-medium">Total Detections: </span>
                  <span class="q-ml-xs">{{ image.detection_count }}</span>
                </div>
              </div>

              <div class="col-6">
                <div class="row q-mb-xs">
                  <q-icon name="edit_note" size="xs" class="q-mr-xs" />
                  <span class="text-weight-medium">Annotated: </span>
                  <span class="q-ml-xs">{{
                    image.annotated_detection_count
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Progress row -->
            <div class="row q-mb-xs q-pl-sm" v-if="image.detection_count > 0">
              <q-icon name="percent" size="xs" class="q-mr-xs" />
              <span class="text-weight-medium">Progress: </span>
              <span class="q-ml-xs" :class="annotationProgressClass">
                {{ annotationProgressPercentage }}%
              </span>
              <q-linear-progress
                :value="annotationProgressPercentage / 100"
                :color="annotationProgressClass.replace('text-', '')"
                class="q-ml-sm q-mt-xs progress-bar"
                size="xs"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Toggle button -->
      <q-btn
        round
        dense
        flat
        :icon="showDetails ? 'image' : 'info'"
        class="toggle-details-btn"
        @click.stop="toggleDetails"
        :color="showDetails ? 'primary' : 'grey'"
        size="sm"
        style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
        "
      >
        <q-tooltip>
          {{ showDetails ? 'Show image' : 'Show details' }}
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.image-thumbnail {
  position: relative;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  overflow: hidden;
  background-color: white;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &.thumbnail-loading::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.3);
    z-index: 2;
  }

  &.thumbnail-active {
    background-color: var(--q-primary);
    color: white;

    .image-wrapper {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .truncated-name {
      color: white;
    }

    .badge-sm,
    .verification-badge {
      background-color: white !important;
      color: var(--q-primary) !important;

      .q-icon {
        color: var(--q-primary) !important;
      }

      .mini-badge {
        background-color: var(--q-primary) !important;
        color: white !important;
        border: 1px solid white !important;
      }
    }

    .image-details {
      color: white;

      .text-grey-7,
      .text-grey {
        color: rgba(255, 255, 255, 0.7) !important;
      }
    }
  }

  &.thumbnail-needs-attention {
    border-color: var(--q-warning);
  }

  // View mode: list-small
  &.thumbnail-list-small {
    margin-bottom: 4px;
    height: 100px !important;

    .thumbnail-content {
      display: flex;
      height: 100%;
    }

    .image-preview-area {
      display: flex;
      width: 100%;
      height: 100%;
    }

    .image-wrapper {
      width: 100px;
      height: 100px;
      flex-shrink: 0;
    }

    .image-name-compact {
      flex: 1;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 40px;
    }

    .details-view {
      width: 100%;
      height: 100%;
      overflow-y: auto;
    }
  }

  // View mode: list-large
  &.thumbnail-list-large {
    margin-bottom: 8px;
    height: 220px !important;

    .thumbnail-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .image-preview-area {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .image-wrapper {
      height: 170px;
      position: relative;
    }

    .order-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 3;
    }

    .image-name-compact {
      padding: 6px 8px;
      height: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .details-view {
      padding: 0;
      height: 100%;
      overflow-y: auto;
    }
  }

  // View mode: grid
  &.thumbnail-grid {
    height: 290px !important;

    .thumbnail-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .image-preview-area {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .image-wrapper {
      flex-grow: 1;
      height: 240px;
      position: relative;
    }

    .order-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 3;
    }

    .image-name-compact {
      padding: 6px 8px;
      height: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .details-view {
      padding: 0;
      height: 100%;
      overflow-y: auto;
    }
  }
}

.selection-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  padding: 2px;
}

.toggle-details-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 5;
  background-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.image-wrapper {
  position: relative;
  overflow: hidden;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f8f8;
  border-radius: 4px;
}

.image-center-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Badge styles */
.badge-sm {
  font-size: 10px;
  padding: 2px 6px;
}

.order-badge {
  font-weight: 600;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 12px;
}

.page-index-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 3;
  font-size: 10px;
  padding: 2px 6px;
  display: inline-flex;
  align-items: center;
  border-radius: 12px;
}

.verification-badge {
  font-size: 10px;
  padding: 2px 6px;
  display: inline-flex;
  align-items: center;
}

.mini-badge {
  font-size: 9px;
  padding: 0 4px;
  height: 16px;
  min-height: 16px;
}

/* Name display */
.truncated-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
}

.full-name {
  word-break: break-word;
}

.progress-bar {
  flex: 1;
  max-width: 100px;
}

.image-details {
  height: 100%;
  overflow-y: auto;

  .row {
    display: flex;
    align-items: flex-start;
  }
}

/* QImg styling */
:deep(.image-cache) {
  will-change: opacity;
  transition: opacity 0.3s ease;
}

:deep(.q-img) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

:deep(.q-img__content) {
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

:deep(.q-img__image) {
  object-fit: contain !important;
  max-height: 100%;
  max-width: 100%;
  height: auto !important;
  width: auto !important;
  position: relative !important;
  margin: auto !important;
  transform: none !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
}

// Apply blue background to the image-name-compact div when selected
.thumbnail-active .image-name-compact {
  background-color: var(--q-primary);
  color: white; // Ensure text is readable on blue background
}
</style>
