<!--
@author Michael Polívka (xpoliv07)
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import FieldItem from './FieldItem.vue';
import {
  DetectionItem,
  getDetectionValue,
  getDetectionConfidence,
} from './utils';
import { useHierarchicalTree } from 'src/stores';
import { useImage } from 'src/stores/data/useImage';
import { useNotificationStore } from 'src/stores/app/notificationService';
import { v4 as uuidv4 } from 'uuid';

defineOptions({
  name: 'FieldGroup',
});

interface FieldItem {
  key: string;
  label: string;
  icon: string;
  isArray: boolean;
}

interface FieldGroup {
  label: string;
  icon: string;
  fields: FieldItem[];
}

const props = defineProps<{
  group: FieldGroup;
  metaElementObject: Record<string, unknown>;
  hasCritical?: boolean;
  hasWarning?: boolean;
  hasValues?: boolean;
  defaultOpen?: boolean;
  groupName?: string;
}>();

const emit = defineEmits<{
  (e: 'detectionClick', detection: DetectionItem): void;
}>();

// Get the hierarchicalTree store
const hierarchicalTreeStore = useHierarchicalTree();
// Get the image store for current image ID
const imageStore = useImage();
// Get notification store for showing errors
const notificationStore = useNotificationStore();

// Add dialog state
const showInputDialog = ref(false);
const inputValue = ref('');
const currentField = ref<FieldItem | null>(null);
const isSaving = ref(false);

// Helper functions for extracting field values
const getFieldDetections = (field: FieldItem): DetectionItem[] => {
  const value = props.metaElementObject[field.key];
  if (!value) return [];

  if (field.isArray && Array.isArray(value)) {
    return value
      .filter((item) => !!item && typeof item === 'object')
      .map((item) => ({
        id: (item as { id?: string }).id || '',
        imageId: (item as { image_id?: string }).image_id || '',
        value: getDetectionValue(item),
        confidence: getDetectionConfidence(item),
      }))
      .filter((item) => !!item.id && !!item.imageId && !!item.value);
  } else if (typeof value === 'object' && value !== null) {
    if ('id' in value && 'image_id' in value) {
      return [
        {
          id: (value as { id?: string }).id || '',
          imageId: (value as { image_id?: string }).image_id || '',
          value: getDetectionValue(value),
          confidence: getDetectionConfidence(value),
        },
      ].filter((item) => !!item.id && !!item.imageId && !!item.value);
    }
  }

  return [];
};

const hasValue = (field: FieldItem): boolean => {
  const value = props.metaElementObject[field.key];
  if (!value) return false;

  if (field.isArray && Array.isArray(value)) {
    return value.length > 0 && value.some((v) => !!getDetectionValue(v));
  }

  return !!getDetectionValue(value);
};

// Handle detection click
const handleDetectionClick = (detection: DetectionItem) => {
  emit('detectionClick', detection);
};

// Handle empty field click
const handleEmptyFieldClick = (field: FieldItem) => {
  currentField.value = field;
  inputValue.value = '';
  showInputDialog.value = true;
};

// Handle save from dialog
const handleSaveValue = async () => {
  if (!currentField.value || !inputValue.value.trim()) {
    showInputDialog.value = false;
    return;
  }

  isSaving.value = true;

  const metaElementId = props.metaElementObject.id as string;
  const camelToSnake = (str: string) =>
    str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const attributeName = camelToSnake(currentField.value.key);
  const metaElementName = (
    props.metaElementObject.type as string
  ).toLowerCase();

  try {
    const imageId = imageStore.currentImageId;

    if (!imageId) {
      notificationStore.error('Cannot add detection: No image is selected');
      isSaving.value = false;
      showInputDialog.value = false;
      return;
    }

    const newDetection = {
      id: uuidv4(),
      image_id: imageId,
      bbox: '0,0,100,100',
      value: inputValue.value,
      confidence: 1,
    };

    const success = await hierarchicalTreeStore.addDetection(
      newDetection,
      metaElementId,
      attributeName,
      metaElementName,
    );

    if (success) {
      notificationStore.success(
        `Successfully added ${currentField.value.label}`,
      );
    } else {
      notificationStore.error(`Failed to add ${currentField.value.label}`);
    }
  } catch (error) {
    notificationStore.error(
      `Failed to add detection: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  } finally {
    isSaving.value = false;
    showInputDialog.value = false;
  }
};

// Determine the header class for the group
const headerClass = computed(() => {
  if (props.hasCritical) return 'text-negative';
  if (props.hasWarning) return 'text-warning';
  if (props.hasValues) return 'text-positive';
  return '';
});
</script>

<template>
  <q-expansion-item
    :icon="group.icon"
    :label="group.label"
    dense
    :group="groupName || 'field-group'"
    :header-class="headerClass"
    :default-opened="defaultOpen"
    class="field-group"
  >
    <q-list dense>
      <div
        v-for="(field, fieldIndex) in group.fields"
        :key="fieldIndex"
        class="field-section"
      >
        <q-item-label header class="text-caption q-py-xs q-pl-md">
          {{ field.label }}
        </q-item-label>

        <!-- If no value, show "Not specified" and make it clickable -->
        <FieldItem
          v-if="!hasValue(field)"
          :detection="{
            id: '',
            imageId: '',
            value: 'Not specified',
            confidence: 1,
          }"
          :icon="field.icon"
          :is-inactive="true"
          :clickable="true"
          @click="() => handleEmptyFieldClick(field)"
        />

        <!-- Show each detection as a separate item if field has values -->
        <FieldItem
          v-for="(detection, detIndex) in getFieldDetections(field)"
          :key="`${fieldIndex}-${detIndex}`"
          :detection="detection"
          :icon="field.icon"
          :clickable="true"
          @click="handleDetectionClick"
        />
      </div>
    </q-list>
  </q-expansion-item>

  <!-- Input Dialog for Empty Fields -->
  <q-dialog v-model="showInputDialog">
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">Add {{ currentField?.label }}</div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="inputValue"
          label="Value"
          autofocus
          @keyup.enter="handleSaveValue"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="negative" v-close-popup />
        <q-btn
          flat
          label="Save"
          color="primary"
          @click="handleSaveValue"
          :loading="isSaving"
          :disable="!inputValue.trim()"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.field-group {
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}

.field-section {
  margin-bottom: 8px;
  max-height: 300px;
  overflow-y: auto;
}

:deep(.q-expansion-item__content) {
  padding: 0;
}
</style>
