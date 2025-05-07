<script setup lang="ts">
import { HierarchialTreeVolumeType } from 'src/stores';
import { computed, defineEmits, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useImage } from 'src/stores/data/useImage';
import { useCollection } from 'src/stores/data/useCollection';
import {
  DetectionItem,
  getDetectionValue,
  getDetectionConfidence,
  navigateToDetection as navigateToDetectionUtil,
  CONFIDENCE_THRESHOLD_LOW,
  CONFIDENCE_THRESHOLD_MEDIUM,
} from './utils';
import FieldGroup from './FieldGroup.vue';
import FieldItem from './FieldItem.vue';

defineOptions({
  name: 'VolumeTree',
});

const props = defineProps<{
  tree: HierarchialTreeVolumeType;
}>();

// Get router for navigation
const router = useRouter();
const imageStore = useImage();
const collectionStore = useCollection();

// Define field item type
interface FieldItem {
  key: keyof HierarchialTreeVolumeType;
  label: string;
  icon: string;
  isArray: boolean;
}

// Define field group type
interface FieldGroup {
  label: string;
  icon: string;
  fields: FieldItem[];
}

// Emit critical count changes
const emit = defineEmits<{
  (e: 'critical-count-changed', volumeId: string, count: number): void;
}>();

// Group fields by category for better organization
const fieldGroups = computed<FieldGroup[]>(() => [
  {
    label: 'Volume Information',
    icon: 'info',
    fields: [
      {
        key: 'title',
        label: 'Volume Title',
        icon: 'inventory_2',
        isArray: false,
      },
      {
        key: 'subTitle',
        label: 'Volume Subtitle',
        icon: 'subtitles',
        isArray: false,
      },
      {
        key: 'partNumber',
        label: 'Part Number',
        icon: 'tag',
        isArray: false,
      },
      { key: 'partName', label: 'Part Name', icon: 'label', isArray: false },
      {
        key: 'dateIssued',
        label: 'Date Issued',
        icon: 'event',
        isArray: false,
      },
      { key: 'edition', label: 'Edition', icon: 'bookmark', isArray: false },
    ],
  },
  {
    label: 'Publication Details',
    icon: 'book',
    fields: [
      { key: 'placeTerm', label: 'Place', icon: 'place', isArray: false },
      { key: 'publisher', label: 'Publisher', icon: 'business', isArray: true },
      {
        key: 'manufacturePublisher',
        label: 'Manufacture Publisher',
        icon: 'factory',
        isArray: true,
      },
      {
        key: 'manufacturePlaceTerm',
        label: 'Manufacture Place',
        icon: 'location_city',
        isArray: true,
      },
    ],
  },
  {
    label: 'Contributors',
    icon: 'people',
    fields: [
      { key: 'author', label: 'Author', icon: 'person', isArray: true },
      {
        key: 'illustrator',
        label: 'Illustrator',
        icon: 'brush',
        isArray: true,
      },
      {
        key: 'translator',
        label: 'Translator',
        icon: 'translate',
        isArray: true,
      },
      { key: 'editor', label: 'Editor', icon: 'edit', isArray: true },
    ],
  },
  {
    label: 'Series Information',
    icon: 'collections_bookmark',
    fields: [
      {
        key: 'seriesName',
        label: 'Series Name',
        icon: 'collections_bookmark',
        isArray: true,
      },
      {
        key: 'seriesNumber',
        label: 'Series Number',
        icon: 'filter_1',
        isArray: true,
      },
    ],
  },
]);

// Helper function to check if field has a value, supporting both camelCase and dot notation
const hasValue = (field: FieldItem): boolean => {
  // Check camelCase version
  const camelValue = props.tree[field.key];
  // Check dot notation version (e.g., 'volume.title' instead of 'title')
  const dotKey =
    `volume.${field.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof HierarchialTreeVolumeType;
  const dotValue = props.tree[dotKey];

  // Use whichever version has a value
  const value = camelValue || dotValue;

  if (!value) return false;

  if (field.isArray && Array.isArray(value)) {
    return value.length > 0 && value.some((v) => !!getDetectionValue(v));
  }

  return !!getDetectionValue(value);
};

// Helper function to get field value, supporting both camelCase and dot notation
const getFieldValue = (field: FieldItem): string => {
  // Check camelCase version
  const camelValue = props.tree[field.key];
  // Check dot notation version (e.g., 'volume.title' instead of 'title')
  const dotKey =
    `volume.${field.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof HierarchialTreeVolumeType;
  const dotValue = props.tree[dotKey];

  // Use whichever version has a value
  const value = camelValue || dotValue;

  if (!value) return '';

  if (field.isArray && Array.isArray(value)) {
    return value.map((v) => getDetectionValue(v)).join(', ');
  }

  return getDetectionValue(value);
};

// Helper function to get average confidence for a field, supporting both camelCase and dot notation
const getFieldConfidence = (field: FieldItem): number => {
  // Check camelCase version
  const camelValue = props.tree[field.key];
  // Check dot notation version (e.g., 'volume.title' instead of 'title')
  const dotKey =
    `volume.${field.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof HierarchialTreeVolumeType;
  const dotValue = props.tree[dotKey];

  // Use whichever version has a value
  const value = camelValue || dotValue;

  if (!value) return 1;

  if (field.isArray && Array.isArray(value)) {
    if (value.length === 0) return 1;
    const sum = value.reduce((acc, v) => acc + getDetectionConfidence(v), 0);
    return sum / value.length;
  }

  return getDetectionConfidence(value);
};

// Function to check if a field has critical confidence (red)
const hasCriticalConfidence = (field: FieldItem): boolean => {
  return getFieldConfidence(field) < CONFIDENCE_THRESHOLD_LOW;
};

// Function to check if a field has low confidence (orange)
const hasLowConfidence = (field: FieldItem): boolean => {
  return getFieldConfidence(field) < CONFIDENCE_THRESHOLD_MEDIUM;
};

// Function to check if a group has any fields with values
const hasGroupValues = (group: FieldGroup): boolean => {
  return group.fields.some((field) => hasValue(field));
};

// Function to get average group confidence
const getGroupConfidence = (group: FieldGroup): number => {
  const fieldsWithValues = group.fields.filter((field) => hasValue(field));
  if (fieldsWithValues.length === 0) return 1;

  const sum = fieldsWithValues.reduce(
    (acc, field) => acc + getFieldConfidence(field),
    0,
  );
  return sum / fieldsWithValues.length;
};

// Function to check if a group has critical confidence (red)
const hasGroupCriticalConfidence = (group: FieldGroup): boolean => {
  return (
    getGroupConfidence(group) < CONFIDENCE_THRESHOLD_LOW ||
    group.fields.some(
      (field) => hasValue(field) && hasCriticalConfidence(field),
    )
  );
};

// Function to check if a group has low confidence (orange)
const hasGroupLowConfidence = (group: FieldGroup): boolean => {
  return (
    getGroupConfidence(group) < CONFIDENCE_THRESHOLD_MEDIUM ||
    group.fields.some((field) => hasValue(field) && hasLowConfidence(field))
  );
};

// Count fields with critical confidence
const criticalFieldsCount = computed((): number => {
  let count = 0;
  for (const group of fieldGroups.value) {
    count += group.fields.filter(
      (field) => hasValue(field) && hasCriticalConfidence(field),
    ).length;
  }
  return count;
});

// Function to handle detection click
const handleDetectionClick = (detection: DetectionItem) => {
  console.log('[TREE-DEBUG] VolumeTree: handleDetectionClick received event', {
    detection,
    hasRouter: !!router,
    hasStores: {
      imageStore: !!imageStore,
      collectionStore: !!collectionStore,
    },
  });
  navigateToDetectionUtil(detection, router, collectionStore, imageStore);
};

// Function to emit critical count
const emitCriticalCount = () => {
  // Generate a unique ID for the volume
  const volumeId =
    props.tree.title?.value ||
    props.tree.partNumber?.value ||
    props.tree.partName?.value ||
    'unknown';

  // Emit the count of critical fields for this volume
  emit('critical-count-changed', volumeId, criticalFieldsCount.value);
};

// Emit critical count when mounted
onMounted(() => {
  emitCriticalCount();
});

// Watch for field changes that might affect critical counts
watch(
  criticalFieldsCount,
  () => {
    emitCriticalCount();
  },
  { immediate: true },
);
</script>

<template>
  <div class="volume-tree">
    <!-- Volume header -->
    <div
      class="volume-header q-py-xs q-px-md"
      :class="{
        'critical-header': criticalFieldsCount > 0,
        'warning-header':
          criticalFieldsCount === 0 && hasGroupValues(fieldGroups[0]),
      }"
    >
      <q-item dense class="q-pa-none">
        <q-item-section avatar>
          <q-icon name="inventory_2" size="xs" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium text-caption">
            {{ getFieldValue(fieldGroups[0].fields[0]) || 'Untitled Volume' }}
            <span v-if="getFieldValue(fieldGroups[0].fields[2])">
              ({{ getFieldValue(fieldGroups[0].fields[2]) }})
            </span>
          </q-item-label>
          <q-item-label caption v-if="hasValue(fieldGroups[0].fields[1])">
            {{ getFieldValue(fieldGroups[0].fields[1]) }}
          </q-item-label>
        </q-item-section>

        <!-- Badge showing number of critical issues -->
        <q-item-section side v-if="criticalFieldsCount > 0">
          <q-badge color="negative" text-color="white" size="sm">
            {{ criticalFieldsCount }}
          </q-badge>
        </q-item-section>
      </q-item>
    </div>

    <!-- Field groups -->
    <FieldGroup
      v-for="(group, index) in fieldGroups"
      :key="index"
      :group="group"
      :tree-object="tree"
      :has-critical="hasGroupCriticalConfidence(group)"
      :has-warning="hasGroupLowConfidence(group)"
      :has-values="hasGroupValues(group)"
      :default-open="hasGroupCriticalConfidence(group)"
      group-name="volume-tree"
      @detection-click="handleDetectionClick"
    />
  </div>
</template>

<style scoped>
.volume-tree {
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  margin: 4px 0;
  max-height: 80vh; /* Limit maximum height to prevent overflow issues */
}

.volume-header {
  background-color: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 5;
}

.critical-header {
  background-color: rgba(255, 0, 0, 0.05);
  border-left: 3px solid var(--q-negative);
}

.warning-header {
  background-color: rgba(255, 186, 0, 0.05);
  border-left: 3px solid var(--q-warning);
}

:deep(.q-expansion-item__content) {
  padding: 0;
}
</style>
