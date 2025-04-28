<script setup lang="ts">
import { DetectionState } from 'src/types/frontend-state';
import { ref, computed, watch } from 'vue';
import { useImageStore } from 'src/stores/image/storeImages';
import { useLoadingState } from 'src/stores/app/loadingState';
import { useNotificationStore } from 'src/stores/app/notificationService';
import { updateDetectionWithMetaRole } from 'src/api/detectionApiService';
import { ANNOTATION_EVENTS } from 'src/constants/events';

const props = defineProps<{
  detection: DetectionState;
  loading?: boolean;
}>();

// Define emits for parent component communication
const emit = defineEmits([
  ANNOTATION_EVENTS.SCROLL_TO,
  ANNOTATION_EVENTS.SELECT,
]);

// Stores
const imageStore = useImageStore();
const loadingState = useLoadingState();
const notificationStore = useNotificationStore();

// Local state
const detection = ref<DetectionState>(props.detection);
const selectValue = ref({
  value: detection.value.computed_type,
  label: detection.value.computed_display_type,
  id: detection.value.computed_type,
  color: detection.value.computed_color,
});

// DOM ref for scrolling
const itemRef = ref<HTMLElement | null>(null);

// Check if this detection is selected
const isSelected = computed(() => {
  return imageStore.selectedDetectionId === detection.value.id;
});

// Watch for selection changes from store
watch(
  () => imageStore.selectedDetectionId,
  (newSelectedId) => {
    if (newSelectedId === detection.value.id && itemRef.value) {
      // When our item gets selected, ensure it's visible
      itemRef.value.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  },
);

// Get confidence value with a default of 0
const getConfidence = computed(() => detection.value.confidence ?? 0);

// Format confidence as percentage for display
const confidencePercent = computed(() => Math.round(getConfidence.value * 100));

// Computed property for confidence class using Quasar color palette
const confidenceColorClass = computed(() => {
  const confidence = getConfidence.value;
  if (confidence < 0.5) return 'red-8'; // High priority (low confidence)
  if (confidence < 0.8) return 'orange-8'; // Medium priority
  return 'green-8'; // Low priority (high confidence)
});

// Calculate attention level based on confidence (0-1 scale)
const attentionLevel = computed(() => {
  const confidence = getConfidence.value;
  if (confidence < 0.5) return 'high-attention';
  if (confidence < 0.8) return 'medium-attention';
  return 'low-attention';
});

// Use availableMetaRoles from detection
const optionsValue = computed(() => {
  return imageStore.availableMetaRolesOptions;
});

// Computed property for loading state
const isLoading = computed(() => {
  // Create reactive dependencies explicitly
  const propsLoading = props.loading;
  const metaRolesLoading = detection.value.loadingMetaRoles;
  const detectionId = detection.value.id;
  const metaRoleUpdateLoading = loadingState.isSourceLoading(
    `metaRoleUpdate-${detectionId}`,
  );

  return propsLoading || metaRolesLoading || metaRoleUpdateLoading;
});

// Handle clicking on the item to select it
const handleSelectDetection = () => {
  if (isSelected.value) {
    // If already selected, deselect it
    imageStore.selectDetection(null);
  } else {
    // Otherwise select this detection
    imageStore.selectDetection(detection.value.id);

    // Emit event to notify parent about selection (without zoom)
    emit(ANNOTATION_EVENTS.SELECT, detection.value);
  }
};

// Handle the zoom action specifically
const handleZoomToDetection = (event: Event) => {
  // Stop event propagation to prevent triggering the parent div's click handler
  event.stopPropagation();

  // Select this detection if not already selected
  if (!isSelected.value) {
    imageStore.selectDetection(detection.value.id);
  }

  // Emit event for parent to handle zooming to this annotation
  emit(ANNOTATION_EVENTS.SCROLL_TO, detection.value);
};

const saveDetection = async () => {
  loadingState.startLoading(
    `saveDetection-${detection.value.id}`,
    'Saving annotation...',
  );
  try {
    console.log(`Saving changes for detection ${detection.value.id}`);

    // Call the API to update the detection's meta role and value
    const { success, error } = await updateDetectionWithMetaRole(
      detection.value.id,
      selectValue.value.id, // meta role ID
      detection.value.value, // current value
    );

    if (success) {
      console.log(`Detection ${detection.value.id} saved successfully`);
      // Mark as no longer edited after save
      detection.value.edited = false;
      // Show success notification
      notificationStore.success('Annotation saved successfully');
    } else {
      console.error(`Error saving detection ${detection.value.id}: ${error}`);
      // Show error notification
      notificationStore.error(`Failed to save annotation: ${error}`);
      throw new Error(error);
    }
  } catch (error) {
    console.error(
      `Error saving changes for detection ${detection.value.id}:`,
      error,
    );
    // Show error notification
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    notificationStore.error(`Error saving annotation: ${errorMessage}`);
  } finally {
    loadingState.stopLoading(`saveDetection-${detection.value.id}`);
  }
};

const updateSelectValue = (value: {
  value: string;
  label: string;
  id: string;
  color: string;
}) => {
  // Update local state immediately for responsive UI
  detection.value.computed_type = value.value;
  detection.value.edited = true;
  detection.value.computed_color = value.color;

  // When the user makes any change, set confidence to 1 (100%) and mark as annotated
  detection.value.confidence = 1;
  detection.value.annotated = true;

  console.log(`Updated detection ${detection.value.id} type to ${value.value}`);
};

const updateDetection = () => {
  // Update local state immediately for responsive UI
  detection.value.edited = true;

  // When the user makes any change, set confidence to 1 (100%) and mark as annotated
  detection.value.confidence = 1;
  detection.value.annotated = true;

  console.log(
    `Marked detection ${detection.value.id} as edited with value: ${detection.value.value}`,
  );
};
</script>

<template>
  <div
    ref="itemRef"
    class="annotation-item q-mb-md"
    :class="[attentionLevel, { selected: isSelected }]"
    @click="handleSelectDetection"
  >
    <!-- Confidence indicator bar at the top -->
    <div class="confidence-bar">
      <div
        class="confidence-progress"
        :class="`bg-${confidenceColorClass}`"
        :style="{
          width: `${confidencePercent}%`,
        }"
      ></div>
    </div>

    <!-- Main content area with white background -->
    <div class="content-area q-px-sm q-py-sm">
      <!-- Main row: All content in one line -->
      <div class="row items-center q-col-gutter-sm no-wrap">
        <!-- Type selector -->
        <div class="col-5">
          <q-select
            v-model="selectValue"
            :options="optionsValue"
            label="Type"
            outlined
            :loading="isLoading"
            @update:model-value="(value) => updateSelectValue(value)"
            hide-bottom-space
            options-dense
            @click.stop
          >
            <template v-slot:selected>
              <div v-if="selectValue" class="row items-center no-wrap">
                <q-badge
                  style="min-width: 8px; min-height: 8px"
                  :style="{ backgroundColor: selectValue.color }"
                  class="q-mr-sm"
                />
                <div class="ellipsis">{{ selectValue.label }}</div>
              </div>
            </template>

            <template v-slot:option="scope">
              <q-item dense v-bind="scope.itemProps">
                <q-item-section avatar>
                  <q-badge
                    style="min-width: 8px; min-height: 8px"
                    :style="{ backgroundColor: scope.opt.color }"
                  />
                </q-item-section>
                <q-item-section>{{ scope.opt.label }}</q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- Value input -->
        <div class="col-5">
          <q-input
            v-model="detection.value"
            label="Value"
            outlined
            @update:model-value="updateDetection"
            hide-bottom-space
            @click.stop
          />
        </div>

        <!-- Save button -->
        <div class="col-2">
          <div class="row justify-center">
            <q-badge :color="confidenceColorClass">
              {{ confidencePercent }}%
            </q-badge>
          </div>
          <div class="row justify-center">
            <q-btn
              flat
              round
              dense
              color="secondary"
              icon="zoom_in"
              @click.stop="handleZoomToDetection"
              size="md"
            >
              <q-tooltip>Zoom to annotation</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              dense
              color="primary"
              icon="save"
              @click.stop="saveDetection"
              size="sm"
              :loading="
                loadingState.isSourceLoading(`saveDetection-${detection.id}`)
              "
            >
              <q-tooltip>Save changes</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.annotation-item {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  border-left: 3px solid $primary;
  cursor: pointer;
}

.annotation-item:hover {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

/* Selected state styling */
.annotation-item.selected {
  box-shadow:
    0 0 0 2px $primary,
    0 2px 5px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
  background-color: rgba($primary, 0.05);
}

.content-area {
  background-color: white;
  position: relative;
}

.confidence-bar {
  height: 3px;
  background-color: #f5f5f5;
  width: 100%;
}

.confidence-progress {
  height: 100%;
  transition:
    width 0.3s ease,
    background-color 0.3s ease;
}

.confidence-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 1px 4px;
  font-size: 10px;
}

/* Attention levels */
.high-attention {
  border-left: 3px solid $red-8;
  animation: pulse-red 2s infinite;
}

.medium-attention {
  border-left: 3px solid $orange-8;
}

.low-attention {
  border-left: 3px solid $green-8;
}

/* Adjust pulse animation for selected items */
.selected.high-attention {
  animation: pulse-red-selected 2s infinite;
}

@keyframes pulse-red {
  0% {
    box-shadow: 0 0 4px 1px rgba($red-8, 0.2);
  }
  50% {
    box-shadow: 0 0 6px 2px rgba($red-8, 0.4);
  }
  100% {
    box-shadow: 0 0 4px 1px rgba($red-8, 0.2);
  }
}

@keyframes pulse-red-selected {
  0% {
    box-shadow:
      0 0 4px 1px rgba($red-8, 0.2),
      0 0 0 2px $primary;
  }
  50% {
    box-shadow:
      0 0 6px 2px rgba($red-8, 0.4),
      0 0 0 2px $primary;
  }
  100% {
    box-shadow:
      0 0 4px 1px rgba($red-8, 0.2),
      0 0 0 2px $primary;
  }
}
</style>
