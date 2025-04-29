<script setup lang="ts">
import { computed } from 'vue';
import { getPreviewImage } from 'src/utils/imageUtils';
import ConfidenceIndicator from './ConfidenceIndicator.vue';
import ImageMetadata from './ImageMetadata.vue';
import OrderBadge from './OrderBadge.vue';

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

function handleClick(event: MouseEvent) {
  emit('click', props.image.id, event.shiftKey);
}

function handleSelect(event: MouseEvent | null = null) {
  const shiftKey = event ? event.shiftKey : false;
  emit('select', props.image.id, shiftKey);
}

// Calculate image dimensions based on view mode
const imageHeight = computed(() => {
  const heights: Record<string, string> = {
    'list-small': '120px',
    'list-large': '200px',
    grid: '160px',
  };
  return heights[props.viewMode] || '200px';
});

const thumbnailClass = computed(() => {
  return {
    'thumbnail-list-small': props.viewMode === 'list-small',
    'thumbnail-list-large': props.viewMode === 'list-large',
    'thumbnail-grid': props.viewMode === 'grid',
    'thumbnail-active': props.isActive,
    'thumbnail-selected': props.isSelected,
    'thumbnail-needs-attention': props.flags.needsAttention,
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
      <!-- Image wrapper with confidence indicators -->
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

        <!-- Extracted confidence indicators -->
        <ConfidenceIndicator
          :hasLowConfidence="flags.hasLowConfidence"
          :hasMediumConfidence="flags.hasMediumConfidence"
        />
      </div>

      <!-- Extracted order badge -->
      <OrderBadge :order="image.order" :isActive="isActive" />

      <!-- Extracted image metadata -->
      <ImageMetadata
        :image="image"
        :isActive="isActive"
        :flags="flags"
        :annotationProgressPercentage="annotationProgressPercentage"
        :annotationProgressClass="annotationProgressClass"
        :confidenceThresholds="confidenceThresholds"
        @click.stop
      />
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
</style>
