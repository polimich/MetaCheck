<script setup lang="ts">
import { DetectionState, DetectionTypeState } from 'src/types/frontend-state';
import { ref } from 'vue';

const props = defineProps<{
  detection: DetectionState;
  options: {
    value: string;
    label: string;
    id: string;
  }[];
}>();

const detection = ref<DetectionState>(props.detection);
const selectValue = ref({
  value: detection.value.type.id,
  label: detection.value.type.display_name,
  id: detection.value.type.id,
});

const saveDetection = async () => {
  console.log(detection.value);
};

const updateSelectValue = (value: {
  value: string;
  label: string;
  id: string;
  type: DetectionTypeState;
}) => {
  detection.value.type = value.type;
  detection.value.type_id = value.id;
  detection.value.edited = true;
};
</script>

<template>
  <q-card
    class="q-ma-sm"
    :style="{ backgroundColor: detection.type.color + '80' }"
  >
    <q-card-section>
      <q-form @submit.prevent="saveDetection">
        <div class="row q-col-gutter-md">
          <q-select
            v-model="selectValue"
            :options="options"
            label="Annotation Type"
            dense
            filled
            class="col"
            @update:model-value="(value) => updateSelectValue(value)"
          />
          <q-input
            v-model="detection.type.color"
            label="Value"
            dense
            filled
            class="col"
          />
          <q-input
            v-model="detection.confidence"
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
          <q-toggle
            v-model="detection.annotated"
            label="Annotated"
            class="col"
          />
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
