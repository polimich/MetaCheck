<script setup lang="ts">
import { DetectionState, MetaRoleOption } from 'src/types/frontend-state';
import { ref, onMounted, computed } from 'vue';

const props = defineProps<{
  detection: DetectionState;
  options?: MetaRoleOption[];
  loading?: boolean;
}>();

// Default values for props
const defaultOptions: MetaRoleOption[] = [];
const optionsValue = computed(() => props.options || defaultOptions);

const emit = defineEmits<{
  (e: 'load-meta-roles'): void;
}>();

const detection = ref<DetectionState>(props.detection);
const selectValue = ref({
  value: detection.value.computed_type,
  label: detection.value.computed_display_type,
  id: detection.value.computed_type,
  color: detection.value.computed_color,
});

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

// For option 3: slider for verified status
const verifiedSlider = computed({
  get: () => (detection.value.annotated ? 1 : 0),
  set: (val) => {
    detection.value.annotated = val === 1;
  },
});

const handleVerifiedSlider = (val: number | null) => {
  if (val !== null) {
    detection.value.annotated = val === 1;
    updateDetection();
  }
};

// Load meta roles when component is mounted if options are empty
onMounted(() => {
  if (!props.options || props.options.length === 0) {
    emit('load-meta-roles');
  }
});

const saveDetection = async () => {
  console.log(detection.value);
};

const updateSelectValue = (value: {
  value: string;
  label: string;
  id: string;
  color: string;
}) => {
  detection.value.computed_type = value.value;
  detection.value.edited = true;
  detection.value.computed_color = value.color;

  // When the user makes any change, set confidence to 1 (100%) and mark as annotated
  detection.value.confidence = 1;
  detection.value.annotated = true;
};

const updateDetection = () => {
  detection.value.edited = true;

  // When the user makes any change, set confidence to 1 (100%) and mark as annotated
  detection.value.confidence = 1;
};
</script>

<template>
  <div class="annotation-item q-mb-sm" :class="[attentionLevel]">
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
    <div class="content-area q-px-md q-py-sm">
      <!-- Main row: Type selector and Value on same line -->
      <div class="row items-center q-col-gutter-sm no-wrap">
        <!-- Type selector -->
        <div class="col-6">
          <q-select
            v-model="selectValue"
            :options="optionsValue"
            label="Type"
            dense
            outlined
            :loading="loading"
            @update:model-value="(value) => updateSelectValue(value)"
            hide-bottom-space
            options-dense
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
        <div class="col-6">
          <q-input
            v-model="detection.value"
            label="Value"
            dense
            outlined
            @update:model-value="updateDetection"
            hide-bottom-space
          />
        </div>

        <!-- Confidence badge -->
        <q-badge
          floating
          :color="confidenceColorClass"
          class="confidence-badge"
        >
          {{ confidencePercent }}%
        </q-badge>
      </div>

      <!-- Option 1: Bottom row with action buttons -->
      <div class="row justify-between items-center q-mt-xs action-row">
        <div class="col-auto">
          <q-btn
            flat
            round
            dense
            color="primary"
            icon="save"
            @click="saveDetection"
            size="sm"
          />
        </div>

        <div class="col verified-container options-1">
          <q-chip
            :color="detection.annotated ? 'green' : 'grey-4'"
            :text-color="detection.annotated ? 'white' : 'grey-8'"
            dense
            outline
            clickable
            @click="
              detection.annotated = !detection.annotated;
              updateDetection();
            "
            class="verified-chip"
            size="sm"
          >
            <q-icon
              :name="detection.annotated ? 'check_circle' : 'circle'"
              left
              size="xs"
            />
            <span class="text-caption">Verified</span>
          </q-chip>
        </div>
      </div>

      <!-- Option 2: Hidden, toggle with CSS to display -->
      <div
        class="row justify-between items-center q-mt-xs action-row options-2 hide-option"
      >
        <div class="col-auto">
          <q-btn
            flat
            color="primary"
            icon-right="save"
            @click="saveDetection"
            size="sm"
            class="save-with-status"
          >
            <span class="text-caption">Save</span>
          </q-btn>
        </div>

        <div class="col-auto verified-indicator">
          <q-btn
            :color="detection.annotated ? 'green' : 'grey-5'"
            :icon="detection.annotated ? 'verified' : 'pending'"
            round
            flat
            dense
            @click="
              detection.annotated = !detection.annotated;
              updateDetection();
            "
            size="sm"
          >
            <q-tooltip>{{
              detection.annotated ? 'Verified' : 'Unverified'
            }}</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Option 3: Hidden, toggle with CSS to display -->
      <div class="row items-center q-mt-xs action-row options-3 hide-option">
        <div class="col">
          <div class="verified-slider">
            <q-slider
              v-model="verifiedSlider"
              :min="0"
              :max="1"
              :step="1"
              snap
              markers
              marker-labels
              label-always
              @update:model-value="handleVerifiedSlider"
              color="green"
              track-size="4px"
              thumb-size="18px"
            />
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            round
            color="primary"
            icon="save"
            size="sm"
            dense
            flat
            @click="saveDetection"
          />
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
}

.annotation-item:hover {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
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
  top: 4px;
  right: 4px;
  padding: 1px 4px;
  font-size: 10px;
}

.action-row {
  min-height: 32px;
}

.verified-container {
  display: flex;
  justify-content: flex-end;
}

.verified-chip {
  border-radius: 16px;
  height: 24px;
}

/* Hide options 2 and 3 by default - use CSS to show the one you prefer */
.hide-option {
  display: none;
}

/* Uncomment one of these to show the option you prefer */
.options-1 {
  display: flex;
}
/* .options-2 { display: flex !important; } */
/* .options-3 { display: flex !important; } */

.verified-slider {
  width: 100px;
  margin-right: 8px;
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
</style>
