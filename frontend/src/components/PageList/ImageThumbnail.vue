<script setup lang="ts">
import { computed } from 'vue';
import { getPreviewImage } from 'src/utils/imageUtils';

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
  needsAttention: {
    type: Boolean,
    required: true,
  },
  hasLowConfidence: {
    type: Boolean,
    required: true,
  },
  hasMediumConfidence: {
    type: Boolean,
    required: true,
  },
  hasUnverifiedDetections: {
    type: Boolean,
    required: true,
  },
  verificationStatusColor: {
    type: String,
    required: true,
  },
  verificationTooltip: {
    type: String,
    required: true,
  },
  viewMode: {
    type: String,
    required: true,
  },
  LOW_CONFIDENCE_THRESHOLD: {
    type: Number,
    required: true,
  },
  MEDIUM_CONFIDENCE_THRESHOLD: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['click', 'select']);

function handleClick(event: MouseEvent) {
  // Pass the event's shift key state to the parent
  emit('click', props.image.id, event.shiftKey);
}

function handleSelect(event: MouseEvent | null = null) {
  // Also pass shift key if available
  const shiftKey = event ? event.shiftKey : false;
  emit('select', props.image.id, shiftKey);
}

// Calculate image dimensions based on view mode
const imageHeight = computed(() => {
  switch (props.viewMode) {
    case 'list-small':
      return '120px';
    case 'list-large':
      return '200px';
    case 'grid':
      return '160px';
    default:
      return '200px';
  }
});

const thumbnailClass = computed(() => {
  return {
    'thumbnail-list-small': props.viewMode === 'list-small',
    'thumbnail-list-large': props.viewMode === 'list-large',
    'thumbnail-grid': props.viewMode === 'grid',
    'thumbnail-active': props.isActive,
    'thumbnail-selected': props.isSelected,
    'thumbnail-needs-attention': props.needsAttention,
  };
});

// Helper functions for page information
const formatConfidence = (confidence: number) => {
  return confidence ? `${Math.round(confidence * 100)}%` : '';
};

const hasPageInfo = computed(() => {
  return props.image.page_index || props.image.page_type;
});

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'green-8';
  if (confidence >= 0.5) return 'orange-8';
  return 'red-8';
};

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
</script>

<template>
  <div :class="['image-thumbnail', thumbnailClass]" @click="handleClick">
    <!-- Selection checkbox (visible in select mode) -->
    <div
      v-if="selectMode"
      class="selection-indicator"
      @click.stop="handleSelect($event)"
    >
      <q-checkbox :modelValue="isSelected" @update:modelValue="handleSelect" />
    </div>

    <!-- Image preview with status indicators -->
    <div class="thumbnail-content">
      <!-- Image preview -->
      <div class="image-wrapper">
        <q-img
          :src="getPreviewImage(image.id)"
          :height="imageHeight"
          fit="contain"
        >
          <template v-slot:loading>
            <q-spinner-dots color="white" />
          </template>
        </q-img>

        <!-- Confidence border indicators -->
        <div
          v-if="hasLowConfidence"
          class="confidence-indicator low-confidence-indicator"
        ></div>
        <div
          v-else-if="hasMediumConfidence"
          class="confidence-indicator medium-confidence-indicator"
        ></div>
      </div>

      <!-- Order indicator badge (moved to top right where status indicator was) -->
      <div class="order-badge">
        <q-badge color="primary" class="order-number">
          {{ image.order }}
          <q-tooltip>Page order: {{ image.order }}</q-tooltip>
        </q-badge>
      </div>

      <!-- Image metadata -->
      <div class="image-metadata">
        <!-- Image name and summary row - always visible -->
        <div class="image-summary row items-center">
          <div class="col">
            <!-- Image name with page info inline -->
            <div class="image-name-row">
              <div class="image-name text-weight-medium text-body2">
                {{ image.name }}
              </div>

              <!-- Quick summary badge -->
              <div class="summary-badges q-mt-xs" @click.stop>
                <q-badge
                  v-if="hasLowConfidence"
                  color="red-8"
                  text-color="white"
                  class="q-mr-xs badge-sm"
                  >Low</q-badge
                >
                <q-badge
                  v-else-if="hasMediumConfidence"
                  color="orange-8"
                  text-color="white"
                  class="q-mr-xs badge-sm"
                  >Medium</q-badge
                >
                <q-badge
                  v-else
                  color="green-8"
                  text-color="white"
                  class="q-mr-xs badge-sm"
                  >High</q-badge
                >
                <q-badge
                  v-if="hasUnverifiedDetections"
                  color="grey-7"
                  text-color="white"
                  class="badge-sm"
                  >Unverified</q-badge
                >
              </div>
            </div>

            <!-- Page Info Section (outside accordion) -->
            <div
              v-if="hasPageInfo"
              class="page-info-section q-mt-sm"
              @click.stop
            >
              <!-- Page index badge if available -->
              <q-badge
                v-if="image.page_index"
                color="grey-9"
                class="page-info-badge q-mr-xs"
              >
                <q-icon name="format_list_numbered" size="xs" class="q-mr-xs" />
                Page {{ image.page_index }}
                <q-badge
                  v-if="image.page_index_confidence"
                  class="mini-badge q-ml-xs"
                  :color="getConfidenceColor(image.page_index_confidence)"
                >
                  {{ formatConfidence(image.page_index_confidence) }}
                </q-badge>
              </q-badge>

              <!-- Page type badge if available -->
              <q-badge
                v-if="image.page_type"
                color="grey-8"
                class="page-info-badge"
              >
                <q-icon name="category" size="xs" class="q-mr-xs" />
                {{ image.page_type }}
                <q-badge
                  v-if="image.page_type_confidence"
                  class="mini-badge q-ml-xs"
                  :color="getConfidenceColor(image.page_type_confidence)"
                >
                  {{ formatConfidence(image.page_type_confidence) }}
                </q-badge>
              </q-badge>
            </div>
          </div>
        </div>

        <!-- Expandable details section -->
        <q-expansion-item
          switch-toggle-side
          dense
          class="q-mt-xs details-expansion"
          header-class="text-caption"
          @click.stop
        >
          <template v-slot:header>
            <q-item-section>
              <q-item-label class="text-caption">Details</q-item-label>
            </q-item-section>
          </template>
          <!-- Wrapper div to stop propagation on all expansion content -->
          <template v-slot:default>
            <div @click.stop>
              <div class="image-details text-caption q-pl-sm q-mt-sm">
                <div class="row q-mb-xs">
                  <q-icon
                    name="drive_file_rename_outline"
                    size="xs"
                    class="q-mr-xs"
                  />
                  <span class="text-weight-medium">Name: </span>
                  <span class="q-ml-xs">{{ image.name }}</span>
                </div>

                <div class="row q-mb-xs">
                  <q-icon name="equalizer" size="xs" class="q-mr-xs" />
                  <span class="text-weight-medium">Overall confidence: </span>
                  <span v-if="hasLowConfidence" class="text-red q-ml-xs">
                    Low confidence
                  </span>
                  <span
                    v-else-if="hasMediumConfidence"
                    class="text-orange q-ml-xs"
                  >
                    Medium confidence ({{ MEDIUM_CONFIDENCE_THRESHOLD }}%)
                  </span>
                  <span v-else class="text-green q-ml-xs">
                    High confidence
                  </span>
                </div>

                <div class="row q-mb-xs" v-if="hasUnverifiedDetections">
                  <q-icon name="task_alt" size="xs" class="q-mr-xs" />
                  <span class="text-weight-medium">Verification: </span>
                  <span class="text-grey-7 q-ml-xs">Unverified</span>
                </div>

                <!-- Detection Statistics Section -->
                <div class="detection-stats q-mt-sm">
                  <div class="row q-mb-xs">
                    <q-icon name="analytics" size="xs" class="q-mr-xs" />
                    <span class="text-weight-medium">Detection Stats:</span>
                  </div>

                  <div class="row q-mb-xs q-pl-sm">
                    <q-icon name="image_search" size="xs" class="q-mr-xs" />
                    <span class="text-weight-medium">Total Detections: </span>
                    <span class="q-ml-xs">{{ image.detection_count }}</span>
                  </div>

                  <div class="row q-mb-xs q-pl-sm">
                    <q-icon name="edit_note" size="xs" class="q-mr-xs" />
                    <span class="text-weight-medium">Annotated: </span>
                    <span class="q-ml-xs">{{
                      image.annotated_detection_count
                    }}</span>
                  </div>

                  <div
                    class="row q-mb-xs q-pl-sm"
                    v-if="image.detection_count > 0"
                  >
                    <q-icon name="percent" size="xs" class="q-mr-xs" />
                    <span class="text-weight-medium"
                      >Annotation Progress:
                    </span>
                    <span class="q-ml-xs" :class="annotationProgressClass">
                      {{ annotationProgressPercentage }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </q-expansion-item>
      </div>
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

  &.thumbnail-list-small {
    margin-bottom: 4px;

    .thumbnail-content {
      display: flex;
      align-items: center;

      .image-wrapper {
        width: 120px;
        border-right: 1px solid rgba(0, 0, 0, 0.05);
        position: relative;
      }

      .image-metadata {
        flex: 1;
        padding: 12px;
      }
    }
  }

  &.thumbnail-list-large {
    margin-bottom: 8px;

    .thumbnail-content {
      display: flex;
      flex-direction: column;
    }

    .image-wrapper {
      position: relative;
    }
  }

  &.thumbnail-grid {
    height: 100%;

    .thumbnail-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .image-wrapper {
      position: relative;
      flex-grow: 1;
    }
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &.thumbnail-active {
    border-color: var(--q-primary);
    background-color: var(--q-primary);
    color: white;

    .image-wrapper {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .image-metadata {
      color: white;
    }

    .text-red,
    .text-orange,
    .text-green {
      color: white !important;
    }

    .text-grey-7 {
      color: rgba(255, 255, 255, 0.7) !important;
    }

    .page-badge {
      background-color: white !important;
      color: var(--q-primary) !important;
      border-color: white !important;

      .q-icon {
        color: var(--q-primary) !important;
      }

      .mini-badge {
        background-color: var(--q-primary) !important;
        color: white !important;
        border: 1px solid white !important;
      }
    }

    .page-info-badge {
      background-color: white !important;
      color: var(--q-primary) !important;
      border-color: white !important;

      .q-icon {
        color: var(--q-primary) !important;
      }

      .mini-badge {
        background-color: var(--q-primary) !important;
        color: white !important;
        border: 1px solid white !important;
      }
    }

    .page-info-section {
      border-top-color: rgba(255, 255, 255, 0.2);
    }

    .details-expansion {
      border-top-color: rgba(255, 255, 255, 0.2);

      :deep(.q-item) {
        color: white;
      }
    }
  }

  &.thumbnail-selected {
    border-color: var(--q-primary);
    background-color: rgba(var(--q-primary-rgb), 0.05);
  }

  &.thumbnail-needs-attention {
    border-color: var(--q-warning);
  }
}

.selection-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  padding: 2px;
}

.image-metadata {
  padding: 8px;
}

.image-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.page-badge {
  font-size: 10px;
  padding: 2px 6px;
  display: inline-flex;
  align-items: center;

  &.text-red {
    border: 1px solid rgba(244, 67, 54, 0.7);
  }

  &.text-orange {
    border: 1px solid rgba(255, 152, 0, 0.7);
  }

  &.text-green {
    border: 1px solid rgba(76, 175, 80, 0.7);
  }
}

.mini-badge {
  font-size: 9px;
  padding: 0 4px;
  height: 16px;
  min-height: 16px;
}

.confidence-badge {
  font-size: 10px;
  padding: 0 6px;
  height: 18px;
}

.image-details {
  margin-top: 4px;
}

.details-expansion {
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
  margin-top: 6px;

  :deep(.q-item) {
    padding: 4px 0;
    min-height: 28px;
    border-radius: 4px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.03);
    }
  }

  :deep(.q-expansion-item__content) {
    padding: 0;
  }
}

.summary-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge-sm {
  font-size: 10px;
  padding: 2px 6px;
}

/* Confidence indicators with pulsating effects */
.confidence-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
  border: 3px solid transparent;
}

.low-confidence-indicator {
  border-color: rgba(244, 67, 54, 0.7);
  animation: pulsate-red 2s infinite;
}

.medium-confidence-indicator {
  border-color: rgba(255, 152, 0, 0.7);
  animation: pulsate-orange 3s infinite;
}

@keyframes pulsate-red {
  0% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
  }
}

@keyframes pulsate-orange {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
  }
}

.order-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;

  .order-number {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    padding: 4px 8px;
    border-radius: 12px;

    &:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
  }
}

// Ensure contrast for order badge in active thumbnail
.thumbnail-active .order-badge {
  .order-number {
    background-color: white !important;
    color: var(--q-primary) !important;
    font-weight: 700;
  }
}

.page-info {
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
  padding-top: 4px;
  margin-top: 4px;
}

.page-info-section {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
}

.page-info-badge {
  font-size: 10px;
  padding: 2px 6px;
  display: inline-flex;
  align-items: center;
  border-radius: 12px;

  .mini-badge {
    background-color: transparent;
    border: 1px solid currentColor;
    font-size: 9px;
    padding: 0 4px;
    height: 16px;
    min-height: 16px;
  }
}
</style>
