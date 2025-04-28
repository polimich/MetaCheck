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

const pageIndexConfidenceLevel = computed(() => {
  const confidence = props.image.page_index_confidence;
  if (!confidence) return '';
  if (confidence >= 0.8) return 'text-green';
  if (confidence >= 0.5) return 'text-orange';
  return 'text-red';
});

const pageTypeConfidenceLevel = computed(() => {
  const confidence = props.image.page_type_confidence;
  if (!confidence) return '';
  if (confidence >= 0.8) return 'text-green';
  if (confidence >= 0.5) return 'text-orange';
  return 'text-red';
});

const hasPageInfo = computed(() => {
  return props.image.page_index || props.image.page_type;
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

      <!-- Status indicator -->
      <div class="status-indicator">
        <q-badge :color="verificationStatusColor" rounded>
          <q-tooltip>{{ verificationTooltip }}</q-tooltip>
        </q-badge>
      </div>

      <!-- Order indicator badge -->
      <div class="order-badge">
        <q-badge color="primary" class="order-number">
          {{ image.order }}
          <q-tooltip>Page order: {{ image.order }}</q-tooltip>
        </q-badge>
      </div>

      <!-- Image metadata -->
      <div class="image-metadata">
        <q-icon name="drive_file_rename_outline" size="xs" class="q-mr-xs" />
        <span class="text-weight-medium">Name: </span>
        <div class="image-name text-weight-medium">
          {{ image.name }}
        </div>

        <div class="image-details text-caption">
          <q-icon name="equalizer" size="xs" class="q-mr-xs" />
          <span class="text-weight-medium">Overall confidence: </span>
          <span v-if="hasLowConfidence" class="text-red">
            Low confidence ({{ LOW_CONFIDENCE_THRESHOLD }}%)
          </span>
          <span v-else-if="hasMediumConfidence" class="text-orange">
            Medium confidence ({{ MEDIUM_CONFIDENCE_THRESHOLD }}%)
          </span>
          <span v-else class="text-green"> High confidence </span>
          <template v-if="hasUnverifiedDetections">
            • <span class="text-grey-7">Unverified</span>
          </template>
        </div>

        <!-- Page info section -->
        <div v-if="hasPageInfo" class="page-info text-caption q-mt-xs">
          <div v-if="image.page_index" class="q-mb-xs">
            <q-icon name="format_list_numbered" size="xs" class="q-mr-xs" />
            <span class="text-weight-medium">Page: </span>
            <span>{{ image.page_index }}</span>
            <span
              v-if="image.page_index_confidence"
              class="q-ml-xs"
              :class="pageIndexConfidenceLevel"
            >
              ({{ formatConfidence(image.page_index_confidence) }})
            </span>
          </div>
          <div v-if="image.page_type">
            <q-icon name="category" size="xs" class="q-mr-xs" />
            <span class="text-weight-medium">Type: </span>
            <span>{{ image.page_type }}</span>
            <span
              v-if="image.page_type_confidence"
              class="q-ml-xs"
              :class="pageTypeConfidenceLevel"
            >
              ({{ formatConfidence(image.page_type_confidence) }})
            </span>
          </div>
        </div>
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

.status-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
}

.image-metadata {
  padding: 8px;
}

.image-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-details {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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
  bottom: 8px;
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
</style>
