<script setup lang="ts">
// @author Michael Polívka (xpoliv07)
// Define props directly without assigning to a variable
defineProps({
  image: {
    type: Object,
    required: true,
  },
  isActive: {
    type: Boolean,
    required: true,
  },
  flags: {
    type: Object,
    required: true,
  },
  annotationProgressPercentage: {
    type: Number,
    required: true,
  },
  annotationProgressClass: {
    type: String,
    required: true,
  },
  confidenceThresholds: {
    type: Object,
    required: true,
  },
});

// Add emit for expansion state change
const emit = defineEmits(['expansion-change']);

// Handle expansion change
function handleExpansionChange(expanded: boolean) {
  emit('expansion-change', expanded);
}

// Helper functions for page information
const formatConfidence = (confidence: number) => {
  return confidence ? `${Math.round(confidence * 100)}%` : '';
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'green-8';
  if (confidence >= 0.5) return 'orange-8';
  return 'red-8';
};
</script>

<template>
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
              v-if="flags.hasLowConfidence"
              color="red-8"
              text-color="white"
              class="q-mr-xs badge-sm"
              >Low</q-badge
            >
            <q-badge
              v-else-if="flags.hasMediumConfidence"
              color="orange-8"
              text-color="white"
              class="q-mr-xs badge-sm"
              >Medium</q-badge
            >
            <q-badge
              v-else-if="image.detection_count > 0"
              color="green-8"
              text-color="white"
              class="q-mr-xs badge-sm"
              >High</q-badge
            >
            <q-badge
              v-if="flags.hasUnverifiedDetections"
              color="grey-7"
              text-color="white"
              class="badge-sm"
              >Unverified</q-badge
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Expandable details section -->
    <q-expansion-item
      switch-toggle-side
      dense
      class="q-mt-xs details-expansion"
      header-class="text-caption"
      @update:model-value="handleExpansionChange"
      @click.stop
    >
      <template v-slot:header>
        <q-item-section>
          <!-- Page index badge if available -->
          <q-badge
            v-if="image.page_index"
            color="grey-9"
            class="page-info-badge"
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

            <!-- Page type badge if available -->
            <div class="row q-mb-xs" v-if="image.page_type">
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

            <div class="row q-mb-xs">
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
              <span v-else class="text-grey q-ml-xs"> No detections </span>
            </div>

            <div class="row q-mb-xs" v-if="flags.hasUnverifiedDetections">
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

              <div class="row q-mb-xs q-pl-sm" v-if="image.detection_count > 0">
                <q-icon name="percent" size="xs" class="q-mr-xs" />
                <span class="text-weight-medium">Annotation Progress: </span>
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
</template>

<style lang="scss" scoped>
.image-metadata {
  padding: 8px;
  flex: 1;
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

.summary-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge-sm {
  font-size: 10px;
  padding: 2px 6px;
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

// Active state styling
:deep(.thumbnail-active) {
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
</style>
