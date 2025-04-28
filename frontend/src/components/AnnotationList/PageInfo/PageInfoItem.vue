<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLoadingState } from 'src/stores/app/loadingState';
import {
  getConfidencePercent,
  getConfidenceColorClass,
  getAttentionLevel,
} from '../utils/confidenceUtils';

const props = defineProps<{
  type: 'page_index' | 'page_type';
  value: string;
  confidence: number;
  imageId?: string;
  loading?: boolean;
}>();

// Events for parent component
const emit = defineEmits(['update:value', 'save']);

// Local state to track edits
const localValue = ref(props.value);
const isEdited = ref(false);

// Stores
const loadingState = useLoadingState();

// Format confidence as percentage for display
const confidencePercent = computed(() =>
  getConfidencePercent(props.confidence),
);

// Get confidence color class
const confidenceColorClass = computed(() =>
  getConfidenceColorClass(props.confidence),
);

// Get attention level
const attentionLevel = computed(() => getAttentionLevel(props.confidence));

// Display properties based on type
const displayInfo = computed(() => {
  if (props.type === 'page_index') {
    return {
      icon: 'format_list_numbered',
      label: 'Page Number',
      title: 'Page Number',
      color: '#3f51b5',
    };
  } else {
    return {
      icon: 'category',
      label: 'Page Type',
      title: 'Page Type',
      color: '#9c27b0',
    };
  }
});

// Handle value changes
const handleValueChange = () => {
  isEdited.value = true;
  emit('update:value', localValue.value);
};

// Save changes
const saveChanges = () => {
  const operationId = `save-${props.type}-${props.imageId || 'unknown'}`;
  loadingState.startLoading(
    operationId,
    `Saving ${displayInfo.value.label}...`,
  );

  try {
    emit('save', {
      type: props.type,
      value: localValue.value,
      confidence: 1, // Set to 100% when manually edited
    });

    isEdited.value = false;
  } catch (error) {
    console.error(`Error saving ${props.type}:`, error);
  } finally {
    loadingState.stopLoading(operationId);
  }
};
</script>

<template>
  <div class="page-info-item q-mb-sm" :class="[attentionLevel]">
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

    <!-- Main content area -->
    <div class="content-area q-px-md q-py-sm">
      <!-- Main row with all content -->
      <div class="row items-center q-col-gutter-sm no-wrap">
        <!-- Icon and title -->
        <div class="col-auto">
          <q-icon :name="displayInfo.icon" color="primary" size="sm" />
        </div>

        <!-- Value input -->
        <div class="col">
          <q-input
            v-model="localValue"
            :label="displayInfo.label"
            dense
            outlined
            @update:model-value="handleValueChange"
            hide-bottom-space
          />
        </div>

        <!-- Save button -->
        <div class="col-auto">
          <q-btn
            flat
            round
            dense
            color="primary"
            icon="save"
            @click="saveChanges"
            size="sm"
            :loading="
              loadingState.isSourceLoading(
                `save-${props.type}-${props.imageId || 'unknown'}`,
              )
            "
            :disable="!isEdited"
          >
            <q-tooltip>Save changes</q-tooltip>
          </q-btn>
        </div>

        <!-- Edited indicator -->
        <div v-if="isEdited" class="col-auto">
          <q-badge color="amber" text-color="black" class="q-pa-xs">
            Edited
          </q-badge>
        </div>
      </div>

      <!-- Confidence badge -->
      <q-badge floating :color="confidenceColorClass" class="confidence-badge">
        {{ confidencePercent }}%
      </q-badge>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-info-item {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  border-left: 3px solid $primary;
}

.page-info-item:hover {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
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
