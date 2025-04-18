<script setup lang="ts">
import { CSSProperties } from 'vue';

// Accept any detection type to avoid conflicts with the parent component
interface DetectionBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // No other required fields to make it more flexible
}

const props = defineProps<{
  pendingAnnotation: DetectionBase | null;
  metaRoles: Array<{
    value: string;
    label: string;
    id?: string;
    color?: string;
  }>;
  position: CSSProperties;
  visible: boolean;
  modelValue: string | null; // Add for v-model binding
  valueText: string | null; // Fix to allow null values
}>();

const emit = defineEmits<{
  (e: 'confirm', metaRole: string | null, value: string): void;
  (e: 'cancel'): void;
  (e: 'update:modelValue', value: string | null): void; // Add for v-model binding
  (e: 'update:valueText', value: string | null): void; // Add for v-model binding
}>();

// Handle confirm button click
function handleConfirm() {
  emit('confirm', props.modelValue, props.valueText || '');
}

// Handle cancel button click
function handleCancel() {
  emit('cancel');
}

// Update handlers for v-model binding
function updateMetaRole(
  value: string | null | { value: string; label: string },
) {
  // Ensure we only emit a string or null
  if (value === null) {
    emit('update:modelValue', null);
  } else if (typeof value === 'object' && 'value' in value) {
    // If it's an object with a value property, extract just the value
    emit('update:modelValue', value.value);
  } else if (typeof value === 'string') {
    emit('update:modelValue', value);
  } else {
    // Fallback
    emit('update:modelValue', null);
  }
}

function updateValue(value: string | number | null) {
  emit('update:valueText', value as string | null);
}
</script>

<template>
  <div
    v-if="visible && pendingAnnotation"
    :style="position"
    class="metadata-input-panel"
    @click.stop
  >
    <q-select
      :model-value="modelValue"
      @update:model-value="updateMetaRole"
      :options="metaRoles"
      label="Meta Role"
      dense
      options-dense
      clearable
      use-input
      hide-selected
      fill-input
      input-debounce="0"
      class="q-mb-sm"
    />
    <q-input
      :model-value="valueText"
      @update:model-value="updateValue"
      label="Value"
      dense
      outlined
      class="q-mb-sm"
      @keyup.enter="handleConfirm"
    />
    <div class="row justify-end q-gutter-sm">
      <q-btn
        label="Cancel"
        color="negative"
        flat
        dense
        @click="handleCancel"
        size="sm"
      />
      <q-btn
        label="Confirm"
        color="primary"
        dense
        @click="handleConfirm"
        size="sm"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.metadata-input-panel {
  position: absolute;
  z-index: 1100;
  background-color: white;
  padding: 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  min-width: 250px;
  animation: fade-in 0.2s ease-out;
  transform-origin: top center;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
