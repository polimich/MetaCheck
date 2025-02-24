<template>
  <q-card class="q-ma-sm" :style="{ backgroundColor: annotation.color + '80' }">
    <q-card-section>
      <q-form @submit.prevent="submit">
        <div class="row q-col-gutter-md">
          <div class="col">
            <q-select
              filled
              v-model="annotationType"
              :options="options"
              label="Annotation Type"
              dense
              options-dense
              class="q-mb-md"
              @update:model-value="
                async (val) => {
                  imageStore.annotations.find(
                    (annotation) => annotation.id === props.annotation.id,
                  ).type_id = val.id;
                  await imageStore.createOrUpdateDetections(
                    imageStore.image.id,
                  );
                  await imageStore.loadDetections(imageStore.image.id);
                }
              "
            />
          </div>
          <div class="col">
            <q-input
              filled
              v-model="value"
              label="Value"
              dense
              class="q-mb-md"
            />
          </div>
          <div class="col">
            <q-input
              filled
              v-model="confidence"
              label="Confidence"
              dense
              type="number"
              min="0"
              max="100"
              class="q-md"
              :rules="[
                (val) => val >= 0 || 'Confidence must be greater than 0',
                (val) => val <= 100 || 'Confidence must be less than 100',
              ]"
            />
          </div>
        </div>
        <div class="row">
          <div class="col-8">
            <q-toggle v-model="annotated" label="Annotated" class="q-mb-md" />
          </div>
          <div class="col">
            <q-btn
              label="Submit"
              type="submit"
              color="primary"
              class="full-width"
            />
          </div>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue';
import { Annotation } from 'src/service/annotation.ts';
import { useImageStore } from 'src/stores/index.ts';

const props = defineProps({
  annotation: Annotation,
  options: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue']);

const annotationType = ref(props.annotation?.type.name || null);
const value = ref(props.annotation?.color || '');
const confidence = ref(props.annotation?.confidence || 0);
const annotated = ref(props.annotation.annotated || false);
const imageStore = useImageStore();

watch(
  () => props.modelValue,
  (newVal) => {
    annotationType.value = newVal.annotationType;
    value.value = newVal.value;
    confidence.value = newVal.confidence;
    annotated.value = newVal.annotated;
  },
  { deep: true },
);

const submit = () => {
  emit('update:modelValue', {
    annotationType: annotationType.value,
    value: value.value,
    confidence: confidence.value,
    annotated: annotated.value,
  });
};
</script>

<style scoped></style>
