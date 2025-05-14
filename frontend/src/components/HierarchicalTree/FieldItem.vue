<!--
@author Michael Polívka (xpoliv07)
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  DetectionItem,
  formatConfidence,
  getConfidenceColor,
  CONFIDENCE_THRESHOLD_LOW,
  CONFIDENCE_THRESHOLD_MEDIUM,
} from './utils';

defineOptions({
  name: 'FieldItem',
});

const props = defineProps<{
  detection: DetectionItem;
  icon: string;
  isInactive?: boolean;
  clickable?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', detection: DetectionItem): void;
}>();

const needsConfidenceIndicator = computed(
  () => props.detection.confidence < CONFIDENCE_THRESHOLD_MEDIUM,
);

const iconColorClass = computed(() => {
  if (props.isInactive) return 'text-grey-5';
  return props.detection.confidence < CONFIDENCE_THRESHOLD_LOW
    ? 'text-negative'
    : props.detection.confidence < CONFIDENCE_THRESHOLD_MEDIUM
      ? 'text-warning'
      : 'text-positive';
});

const handleClick = () => {
  if (props.clickable) {
    emit('click', props.detection);
  }
};
</script>

<template>
  <div
    class="field-item-wrapper"
    :class="{
      'inactive-field': isInactive,
      'clickable-item': clickable,
    }"
    @click="clickable && handleClick()"
    :data-detection-id="detection.id"
    :data-image-id="detection.imageId"
    :data-confidence="detection.confidence"
  >
    <q-item dense class="field-item">
      <q-item-section avatar>
        <q-icon :name="icon" size="xs" :class="iconColorClass" />
      </q-item-section>
      <q-item-section>
        <q-item-label caption class="field-value">
          {{ detection.value }}
        </q-item-label>
      </q-item-section>
      <q-item-section side v-if="needsConfidenceIndicator">
        <q-chip
          :color="getConfidenceColor(detection.confidence)"
          text-color="white"
          size="xs"
          dense
          class="confidence-chip"
        >
          {{ formatConfidence(detection.confidence) }}
        </q-chip>
      </q-item-section>
    </q-item>
  </div>
</template>

<style scoped>
.field-item-wrapper {
  padding: 2px 8px;
}

.field-item {
  padding: 0;
}

.inactive-field {
  opacity: 0.7;
}

.clickable-item {
  cursor: pointer;
}

.clickable-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

/* Add visual indicator for empty but clickable fields */
.inactive-field.clickable-item {
  border: 1px dashed transparent;
}

.inactive-field.clickable-item:hover {
  border-color: rgba(0, 0, 0, 0.2);
  background-color: rgba(0, 0, 0, 0.03);
}

.inactive-field.clickable-item .field-value::after {
  content: ' (click to add)';
  font-size: 0.8em;
  color: #999;
  font-style: italic;
}

.field-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.confidence-chip {
  height: 16px;
  font-size: 10px;
}
</style>
