<!--
@author Michael Polívka (xpoliv07)
-->
<script setup lang="ts">
import {
  HierarchialTreeTitleType,
  HierarchialTreeVolumeType,
} from 'src/stores';
import { computed, ref, onMounted } from 'vue';
import VolumeTree from './VolumeTree.vue';
import { useRouter } from 'vue-router';
import { useImage } from 'src/stores/data/useImage';
import { useCollection } from 'src/stores/data/useCollection';
import {
  DetectionItem,
  getDetectionValue,
  getDetectionConfidence,
  CONFIDENCE_THRESHOLD_LOW,
  CONFIDENCE_THRESHOLD_MEDIUM,
  navigateToDetection as navigateToDetectionUtil,
} from './utils';
import FieldGroup from './FieldGroup.vue';

defineOptions({
  name: 'TitleTree',
});

const { tree } = defineProps<{
  tree: HierarchialTreeTitleType;
}>();

// Get router for navigation
const router = useRouter();
const imageStore = useImage();
const collectionStore = useCollection();

// Define field item type
interface FieldItem {
  key: keyof HierarchialTreeTitleType;
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

// Group fields by category for better organization
const fieldGroups = computed<FieldGroup[]>(() => [
  {
    label: 'Basic Information',
    icon: 'info',
    fields: [
      { key: 'title', label: 'Title', icon: 'title', isArray: false },
      { key: 'subTitle', label: 'Subtitle', icon: 'subtitles', isArray: false },
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

// Helper function to get field value, supporting both camelCase and dot notation
const getFieldValue = (field: FieldItem): string => {
  const camelValue = tree[field.key];
  const dotKey =
    `title.${field.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof HierarchialTreeTitleType;
  const dotValue = tree[dotKey];

  const value = camelValue || dotValue;

  if (!value) return '';

  if (field.isArray && Array.isArray(value)) {
    return value.map((v) => getDetectionValue(v)).join(', ');
  }

  return getDetectionValue(value);
};

// Helper function to check if field has a value, supporting both camelCase and dot notation
const hasValue = (field: FieldItem): boolean => {
  const camelValue = tree[field.key];
  const dotKey =
    `title.${field.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof HierarchialTreeTitleType;
  const dotValue = tree[dotKey];

  const value = camelValue || dotValue;

  if (!value) return false;

  if (field.isArray && Array.isArray(value)) {
    return value.length > 0 && value.some((v) => !!getDetectionValue(v));
  }

  return !!getDetectionValue(value);
};

// Helper function to get average confidence for a field, supporting both camelCase and dot notation
const getFieldConfidence = (field: FieldItem): number => {
  const camelValue = tree[field.key];
  const dotKey =
    `title.${field.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof HierarchialTreeTitleType;
  const dotValue = tree[dotKey];

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

// Function to navigate to detection with debug logs
const navigateToDetection = (detection: DetectionItem) => {
  navigateToDetectionUtil(detection, router, collectionStore, imageStore);
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

// Function to check if a volume has critical confidence (red)
const hasVolumeCriticalConfidence = (
  volume: HierarchialTreeVolumeType,
): boolean => {
  if (
    volume.title &&
    getDetectionConfidence(volume.title) < CONFIDENCE_THRESHOLD_LOW
  ) {
    return true;
  }

  const basicFields = [
    'dateIssued',
    'subTitle',
    'partNumber',
    'partName',
    'edition',
    'placeTerm',
  ];
  for (const field of basicFields) {
    if (
      volume[field as keyof HierarchialTreeVolumeType] &&
      getDetectionConfidence(volume[field as keyof HierarchialTreeVolumeType]) <
        CONFIDENCE_THRESHOLD_LOW
    ) {
      return true;
    }
  }

  const arrayFields = [
    'publisher',
    'manufacturePublisher',
    'manufacturePlaceTerm',
    'author',
    'illustrator',
    'translator',
    'editor',
    'seriesName',
    'seriesNumber',
  ];
  for (const field of arrayFields) {
    const arrayField = volume[
      field as keyof HierarchialTreeVolumeType
    ] as unknown as Array<unknown>;
    if (
      arrayField?.some(
        (item: unknown) =>
          getDetectionConfidence(item) < CONFIDENCE_THRESHOLD_LOW,
      )
    ) {
      return true;
    }
  }

  return false;
};

// Function to check if a volume has low confidence (orange)
const hasVolumeLowConfidence = (volume: HierarchialTreeVolumeType): boolean => {
  if (hasVolumeCriticalConfidence(volume)) return true;

  if (
    volume.title &&
    getDetectionConfidence(volume.title) < CONFIDENCE_THRESHOLD_MEDIUM
  ) {
    return true;
  }

  const basicFields = [
    'dateIssued',
    'subTitle',
    'partNumber',
    'partName',
    'edition',
    'placeTerm',
  ];
  for (const field of basicFields) {
    if (
      volume[field as keyof HierarchialTreeVolumeType] &&
      getDetectionConfidence(volume[field as keyof HierarchialTreeVolumeType]) <
        CONFIDENCE_THRESHOLD_MEDIUM
    ) {
      return true;
    }
  }

  const arrayFields = [
    'publisher',
    'manufacturePublisher',
    'manufacturePlaceTerm',
    'author',
    'illustrator',
    'translator',
    'editor',
    'seriesName',
    'seriesNumber',
  ];
  for (const field of arrayFields) {
    const arrayField = volume[
      field as keyof HierarchialTreeVolumeType
    ] as unknown as Array<unknown>;
    if (
      arrayField?.some(
        (item: unknown) =>
          getDetectionConfidence(item) < CONFIDENCE_THRESHOLD_MEDIUM,
      )
    ) {
      return true;
    }
  }

  return false;
};

// Volumes with critical confidence (red)
const volumesWithCriticalConfidence = computed((): number => {
  if (!tree.volumes) return 0;
  return tree.volumes.filter((volume) => hasVolumeCriticalConfidence(volume))
    .length;
});

// Volumes with low confidence (orange or red)
const volumesWithLowConfidence = computed((): number => {
  if (!tree.volumes) return 0;
  return tree.volumes.filter((volume) => hasVolumeLowConfidence(volume)).length;
});

// Computed property to check if any field has low confidence
const hasAnyLowConfidence = computed(() => {
  for (const group of fieldGroups.value) {
    for (const field of group.fields) {
      if (hasValue(field) && hasLowConfidence(field)) {
        return true;
      }
    }
  }
  return volumesWithLowConfidence.value > 0;
});

// Track volume critical counts separately for real-time updates from child components
const volumeCriticalCounts = ref(new Map<string, number>());

// Update volume critical counts when children report changes
const updateVolumeCriticalCounts = (volumeId: string, count: number) => {
  volumeCriticalCounts.value.set(volumeId, count);
};

// Add this after computed properties but before the navigateToDetection function
onMounted(() => {
  const titleTree = document.querySelector('.title-tree');
  if (titleTree) {
    titleTree.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const clickableItem = target.closest('.clickable-item');

      if (clickableItem) {
        const detectionId = clickableItem.getAttribute('data-detection-id');
        const imageId = clickableItem.getAttribute('data-image-id');

        if (detectionId && imageId) {
          const detection: DetectionItem = {
            id: detectionId,
            imageId: imageId,
            value: clickableItem.textContent?.trim() || '',
            confidence: 1,
          };

          navigateToDetection(detection);
        }
      }
    });
  }
});
</script>

<template>
  <div class="title-tree">
    <!-- Title section with confidence indicators -->
    <div
      class="title-header q-mb-xs"
      :class="{
        'critical-header': criticalFieldsCount > 0,
        'warning-header': criticalFieldsCount === 0 && hasAnyLowConfidence,
      }"
    >
      <q-item dense class="q-pa-none">
        <q-item-section avatar>
          <q-icon name="book" size="xs" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium text-body2">
            {{ getFieldValue(fieldGroups[0].fields[0]) || 'Untitled' }}
          </q-item-label>
          <q-item-label caption v-if="hasValue(fieldGroups[0].fields[1])">
            {{ getFieldValue(fieldGroups[0].fields[1]) }}
          </q-item-label>
        </q-item-section>

        <!-- Badge showing number of critical issues -->
        <q-item-section
          side
          v-if="criticalFieldsCount > 0 || volumesWithCriticalConfidence > 0"
        >
          <q-badge color="negative" text-color="white" size="sm">
            {{ criticalFieldsCount + volumesWithCriticalConfidence }}
          </q-badge>
        </q-item-section>
      </q-item>
    </div>

    <!-- Compact field groups -->
    <FieldGroup
      v-for="(group, index) in fieldGroups"
      :key="index"
      :group="group"
      :meta-element-object="tree"
      :has-critical="hasGroupCriticalConfidence(group)"
      :has-warning="hasGroupLowConfidence(group)"
      :has-values="hasGroupValues(group)"
      :default-open="hasGroupCriticalConfidence(group)"
      :parent-id="tree.id"
      group-name="title-tree"
      @detection-click="navigateToDetection"
    />

    <!-- Volumes -->
    <div
      v-if="tree.volumes && tree.volumes.length > 0"
      class="volumes-section q-mt-xs"
    >
      <q-expansion-item
        icon="inventory_2"
        label="Volumes"
        dense
        :default-opened="volumesWithLowConfidence > 0"
        group="title-tree"
        :header-class="[
          volumesWithCriticalConfidence > 0
            ? 'text-negative'
            : volumesWithLowConfidence > 0
              ? 'text-warning'
              : '',
        ]"
      >
        <div class="volumes-container">
          <VolumeTree
            v-for="(volume, index) in tree.volumes"
            :key="index"
            :volume="volume"
            class="volume-item"
            @critical-count-changed="updateVolumeCriticalCounts"
          />
        </div>
      </q-expansion-item>
    </div>
  </div>
</template>

<style scoped>
.title-tree {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(
    100vh - 170px
  ); /* Maximum height with space for UI elements */
}

.title-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 4px;
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: white;
}

.critical-header {
  background-color: rgba(255, 0, 0, 0.05);
  border-left: 3px solid var(--q-negative);
}

.warning-header {
  background-color: rgba(255, 186, 0, 0.05);
  border-left: 3px solid var(--q-warning);
}

.title-group {
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}

.field-item {
  padding: 2px 8px;
}

.field-section {
  margin-bottom: 8px;
}

.inactive-field {
  opacity: 0.7;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  background-color: rgba(0, 0, 0, 0.03);
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

.volumes-container {
  padding: 0 4px;
  max-height: 60vh; /* Limit the volumes container height */
  overflow-y: auto;
}

.volume-item {
  margin-bottom: 4px;
}

:deep(.q-expansion-item__content) {
  padding: 0;
}
</style>
