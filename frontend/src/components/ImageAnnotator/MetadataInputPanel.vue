<script setup lang="ts">
import { ref, CSSProperties } from 'vue';

// Accept any detection type to avoid conflicts with the parent component
interface DetectionBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // No other required fields to make it more flexible
}

defineProps<{
  pendingAnnotation: DetectionBase | null;
  metaRoles: Array<{
    value: string;
    label: string;
    id?: string;
    color?: string;
  }>;
  position: CSSProperties;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm', metaRole: string | null, value: string): void;
  (e: 'cancel'): void;
}>();

// Local state for the form inputs
const selectedMetaRole = ref<string | null>(null);
const annotationValue = ref<string>('');

// Handle confirm button click
function handleConfirm() {
  emit('confirm', selectedMetaRole.value, annotationValue.value);
  resetForm();
}

// Handle cancel button click
function handleCancel() {
  emit('cancel');
  resetForm();
}

// Reset form state
function resetForm() {
  selectedMetaRole.value = null;
  annotationValue.value = '';
}
</script>

<template>
  <div
    v-if="visible && pendingAnnotation"
    :style="position"
    class="metadata-input-panel"
  >
    <q-select
      v-model="selectedMetaRole"
      :options="metaRoles"
      label="Meta Role"
      dense
      options-dense
      clearable
      use-input
      hide-selected
      fill-input
      input-debounce="0"
      @filter="
        (val, update) => {
          update(() => {});
        }
      "
      class="q-mb-sm"
    />
    <q-input
      v-model="annotationValue"
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
  z-index: 11;
  background-color: white;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  min-width: 250px;
}
</style>
