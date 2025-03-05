<script setup lang="ts">
import { DetectionState, DetectionTypeState } from 'src/types/frontend-state';
import { ref, watch } from 'vue';
import { useDetectionTypesStore, useImageStore } from 'src/stores';

const props = defineProps<{
  detection: DetectionState;
  options: {
    value: string;
    label: string;
    id: string;
  }[];
}>();

const imageStore = useImageStore();
const detectionTypesStore = useDetectionTypesStore();

const annotationType = ref(props.detection.type.name || null);
const value = ref(props.detection.color || '');
const confidence = ref(props.detection.confidence || 0);
const annotated = ref(props.detection.annotated || false);

const emit = defineEmits(['update:modelValue']);

watch(
  () => props.detection,
  (newVal) => {
    annotationType.value = newVal.type.name || null;
    value.value = newVal.color || '';
    confidence.value = newVal.confidence || 0;
    annotated.value = newVal.annotated || false;
  },
  { deep: true, immediate: true },
);

const submit = () => {
  emit('update:modelValue', {
    annotationType: annotationType.value,
    value: value.value,
    confidence: confidence.value,
    annotated: annotated.value,
  });

  imageStore.image.detections = imageStore.image.detections.map((detection) => {
    if (detection.id === props.detection.id) {
      return {
        ...detection,
        type: detectionTypesStore.detectionTypes.find(
          (type) => type.name === annotationType.value,
        ) as DetectionTypeState,
        color: value.value,
        confidence: confidence.value,
        annotated: annotated.value,
      };
    }
    return detection;
  });
};
</script>

<template>
  <q-card class="q-ma-sm" :style="{ backgroundColor: detection.color + '80' }">
    <q-card-section>
      <q-form @submit.prevent="submit">
        <div class="row q-col-gutter-md">
          <q-select
            v-model="annotationType"
            :options="options"
            label="Annotation Type"
            dense
            filled
            class="col"
          />
          <q-input v-model="value" label="Value" dense filled class="col" />
          <q-input
            v-model="confidence"
            label="Confidence"
            type="number"
            dense
            filled
            min="0"
            max="100"
            class="col"
            :rules="[
              (val) => val >= 0 || 'Must be at least 0',
              (val) => val <= 100 || 'Cannot exceed 100',
            ]"
          />
        </div>
        <div class="row q-mt-md">
          <q-toggle v-model="annotated" label="Annotated" class="col" />
          <q-btn
            label="Submit"
            type="submit"
            color="primary"
            class="col full-width"
          />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>
<style scoped></style>
