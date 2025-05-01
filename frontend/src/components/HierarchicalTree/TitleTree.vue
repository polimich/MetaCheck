<script setup lang="ts">
import {
  HierarchialTreeTitleType,
  HierarchialTreeVolumeType,
} from 'src/stores';
import { computed, ref } from 'vue';
import VolumeTree from './VolumeTree.vue';

defineOptions({
  name: 'TitleTree',
});

const { tree } = defineProps<{
  tree: HierarchialTreeTitleType;
}>();

// Define confidence thresholds
const CONFIDENCE_THRESHOLD_LOW = 0.7; // Below this is critical (red)
const CONFIDENCE_THRESHOLD_MEDIUM = 0.85; // Below this is warning (orange), above is good (green)

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

// Helper function to safely get value from a detection
const getDetectionValue = (detection: unknown): string => {
  if (!detection) return '';
  if (
    typeof detection === 'object' &&
    detection !== null &&
    'value' in detection
  ) {
    return (detection as { value: string }).value || '';
  }
  return '';
};

// Helper function to get confidence from a detection
const getDetectionConfidence = (detection: unknown): number => {
  if (!detection) return 1;
  if (
    typeof detection === 'object' &&
    detection !== null &&
    'confidence' in detection
  ) {
    const conf = (detection as { confidence?: number }).confidence;
    return conf !== undefined ? conf : 1;
  }
  return 1;
};

// Helper function to get confidence color
const getConfidenceColor = (confidence: number): string => {
  if (confidence < CONFIDENCE_THRESHOLD_LOW) return 'negative';
  if (confidence < CONFIDENCE_THRESHOLD_MEDIUM) return 'warning';
  return 'positive';
};

// Helper function to get field value
const getFieldValue = (field: FieldItem): string => {
  const value = tree[field.key];
  if (!value) return '';

  if (field.isArray && Array.isArray(value)) {
    return value.map((v) => getDetectionValue(v)).join(', ');
  }

  return getDetectionValue(value);
};

// Helper function to check if field has a value
const hasValue = (field: FieldItem): boolean => {
  const value = tree[field.key];
  if (!value) return false;

  if (field.isArray && Array.isArray(value)) {
    return value.length > 0 && value.some((v) => !!getDetectionValue(v));
  }

  return !!getDetectionValue(value);
};

// Helper function to get items count for array fields
const getItemsCount = (field: FieldItem): number => {
  const value = tree[field.key];
  if (!value || !Array.isArray(value)) return 0;
  return value.length;
};

// Helper function to get average confidence for a field
const getFieldConfidence = (field: FieldItem): number => {
  const value = tree[field.key];
  if (!value) return 1;

  if (field.isArray && Array.isArray(value)) {
    if (value.length === 0) return 1;
    const sum = value.reduce((acc, v) => acc + getDetectionConfidence(v), 0);
    return sum / value.length;
  }

  return getDetectionConfidence(value);
};

// Helper function to format confidence as percentage
const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`;
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

// Function to get the count of fields with values in a group
const getGroupValueCount = (group: FieldGroup): number => {
  return group.fields.filter((field) => hasValue(field)).length;
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

// Count groups with critical confidence
const criticalGroupsCount = computed((): number => {
  return fieldGroups.value.filter((group) => hasGroupCriticalConfidence(group))
    .length;
});

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
  // Check volume title
  if (
    volume.title &&
    getDetectionConfidence(volume.title) < CONFIDENCE_THRESHOLD_LOW
  ) {
    return true;
  }

  // Check basic fields
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

  // Check array fields
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
        (item) => getDetectionConfidence(item) < CONFIDENCE_THRESHOLD_LOW,
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

  // Check volume title
  if (
    volume.title &&
    getDetectionConfidence(volume.title) < CONFIDENCE_THRESHOLD_MEDIUM
  ) {
    return true;
  }

  // Check basic fields
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

  // Check array fields
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
        (item) => getDetectionConfidence(item) < CONFIDENCE_THRESHOLD_MEDIUM,
      )
    ) {
      return true;
    }
  }

  // Check issues if present
  if (volume.issues?.length) {
    for (const issue of volume.issues) {
      // Check basic issue fields
      if (
        issue.dateIssued &&
        getDetectionConfidence(issue.dateIssued) < CONFIDENCE_THRESHOLD_MEDIUM
      ) {
        return true;
      }
      if (
        issue.title &&
        getDetectionConfidence(issue.title) < CONFIDENCE_THRESHOLD_MEDIUM
      ) {
        return true;
      }

      // Check issue array fields
      if (
        issue.publisher?.some(
          (item) => getDetectionConfidence(item) < CONFIDENCE_THRESHOLD_MEDIUM,
        )
      ) {
        return true;
      }
      if (
        issue.redaktor?.some(
          (item) => getDetectionConfidence(item) < CONFIDENCE_THRESHOLD_MEDIUM,
        )
      ) {
        return true;
      }
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

// Expand/collapse all groups
const expandAll = ref(false);

const toggleExpandAll = () => {
  expandAll.value = !expandAll.value;
};

// Get series title for display
const seriesTitle = computed((): string => {
  if (tree.title) {
    return getDetectionValue(tree.title);
  }
  return tree.periodical ? 'Periodical Series' : 'Multi-Part Monograph';
});

// Compute publication years range
const publicationYearsRange = computed((): string => {
  if (!tree.volumes || tree.volumes.length === 0) return '';

  const years = tree.volumes
    .map((vol) => (vol.dateIssued ? getDetectionValue(vol.dateIssued) : ''))
    .filter((date) => date)
    .map((date) => {
      // Extract year from date string (assuming format like YYYY or YYYY-MM-DD)
      const yearMatch = date.match(/\b\d{4}\b/);
      return yearMatch ? parseInt(yearMatch[0]) : null;
    })
    .filter((year): year is number => year !== null);

  if (years.length === 0) return '';

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  return minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
});
</script>

<template>
  <q-card flat bordered class="title-tree">
    <!-- Title header -->
    <q-card-section
      :class="
        criticalGroupsCount || volumesWithCriticalConfidence
          ? 'bg-negative text-white'
          : 'bg-primary text-white'
      "
    >
      <div class="row items-center no-wrap">
        <div class="col">
          <div class="text-h6">{{ seriesTitle }}</div>
          <div v-if="publicationYearsRange" class="text-subtitle2">
            {{ publicationYearsRange }}
          </div>
          <div class="text-caption q-mt-xs">
            <q-badge color="white" text-color="primary" outline>
              <q-icon name="collections_bookmark" size="xs" class="q-mr-xs" />
              {{ tree.volumes?.length || 0 }} volumes
            </q-badge>
            <q-badge
              v-if="volumesWithCriticalConfidence"
              color="white"
              text-color="negative"
              outline
              class="q-ml-sm"
            >
              <q-icon name="error" size="xs" class="q-mr-xs" />
              {{ volumesWithCriticalConfidence }} volumes critical
            </q-badge>
            <q-badge
              v-if="volumesWithLowConfidence > volumesWithCriticalConfidence"
              color="white"
              text-color="warning"
              outline
              class="q-ml-sm"
            >
              <q-icon name="warning" size="xs" class="q-mr-xs" />
              {{ volumesWithLowConfidence - volumesWithCriticalConfidence }}
              volumes warning
            </q-badge>
            <q-badge
              v-if="criticalFieldsCount"
              color="white"
              text-color="negative"
              outline
              class="q-ml-sm"
            >
              <q-icon name="priority_high" size="xs" class="q-mr-xs" />
              {{ criticalFieldsCount }} fields need attention
            </q-badge>
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            flat
            round
            dense
            :icon="expandAll ? 'unfold_less' : 'unfold_more'"
            @click="toggleExpandAll"
          />
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Tree structure with expandable groups -->
    <q-list padding>
      <!-- Series Metadata -->
      <q-expansion-item
        v-for="(group, groupIndex) in fieldGroups"
        :key="groupIndex"
        :icon="group.icon"
        :label="group.label"
        :caption="
          hasGroupValues(group)
            ? `${getGroupValueCount(group)} values found`
            : 'No values'
        "
        :default-opened="expandAll || hasGroupLowConfidence(group)"
        group="title-metadata"
        :class="{
          'critical-confidence': hasGroupCriticalConfidence(group),
          'low-confidence':
            hasGroupLowConfidence(group) && !hasGroupCriticalConfidence(group),
        }"
        :header-class="{
          'text-primary':
            hasGroupValues(group) && !hasGroupLowConfidence(group),
          'text-grey-7': !hasGroupValues(group),
          'bg-red-1': hasGroupCriticalConfidence(group),
          'bg-orange-1':
            hasGroupLowConfidence(group) && !hasGroupCriticalConfidence(group),
        }"
        :expand-icon-class="{
          'text-primary': !hasGroupLowConfidence(group),
          'text-negative': hasGroupCriticalConfidence(group),
          'text-warning':
            hasGroupLowConfidence(group) && !hasGroupCriticalConfidence(group),
        }"
      >
        <template #header>
          <q-item-section avatar>
            <q-icon
              :name="group.icon"
              :color="
                hasGroupCriticalConfidence(group)
                  ? 'negative'
                  : hasGroupLowConfidence(group)
                    ? 'warning'
                    : 'primary'
              "
            />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ group.label }}</q-item-label>
            <q-item-label caption>
              {{
                hasGroupValues(group)
                  ? `${getGroupValueCount(group)} values found`
                  : 'No values'
              }}
            </q-item-label>
          </q-item-section>

          <q-item-section side v-if="hasGroupLowConfidence(group)">
            <q-chip
              dense
              :color="
                hasGroupCriticalConfidence(group) ? 'negative' : 'warning'
              "
              text-color="white"
              icon="warning"
            >
              {{ formatConfidence(getGroupConfidence(group)) }}
            </q-chip>
          </q-item-section>
        </template>

        <q-card>
          <q-card-section>
            <q-list dense padding>
              <!-- Fields within each group -->
              <q-expansion-item
                v-for="field in group.fields"
                :key="field.key.toString()"
                :default-opened="expandAll || hasLowConfidence(field)"
                :disable="!hasValue(field)"
                :class="{
                  'critical-confidence':
                    hasCriticalConfidence(field) && hasValue(field),
                  'low-confidence':
                    hasLowConfidence(field) &&
                    !hasCriticalConfidence(field) &&
                    hasValue(field),
                }"
              >
                <template #header>
                  <q-item-section avatar>
                    <q-icon
                      :name="field.icon"
                      :color="
                        !hasValue(field)
                          ? 'grey-7'
                          : hasCriticalConfidence(field)
                            ? 'negative'
                            : hasLowConfidence(field)
                              ? 'warning'
                              : 'primary'
                      "
                    />
                  </q-item-section>

                  <q-item-section>
                    <q-item-label>{{ field.label }}</q-item-label>
                    <q-item-label caption>
                      {{
                        hasValue(field)
                          ? field.isArray
                            ? `${getItemsCount(field)} items`
                            : getFieldValue(field)
                          : 'Not specified'
                      }}
                    </q-item-label>
                  </q-item-section>

                  <q-item-section
                    side
                    v-if="hasValue(field) && hasLowConfidence(field)"
                  >
                    <q-badge
                      :color="
                        hasCriticalConfidence(field) ? 'negative' : 'warning'
                      "
                      outline
                    >
                      {{ formatConfidence(getFieldConfidence(field)) }}
                    </q-badge>
                  </q-item-section>
                </template>

                <!-- Array field content -->
                <q-card v-if="field.isArray && hasValue(field)" flat bordered>
                  <q-card-section>
                    <div class="row items-start q-gutter-sm">
                      <div
                        v-for="(item, index) in tree[field.key]"
                        :key="index"
                        class="confidence-item"
                      >
                        <q-badge
                          :color="
                            getConfidenceColor(getDetectionConfidence(item))
                          "
                          :label="
                            formatConfidence(getDetectionConfidence(item))
                          "
                          class="q-mb-xs confidence-badge"
                        />
                        <q-badge
                          :color="
                            getConfidenceColor(getDetectionConfidence(item))
                          "
                          :label="getDetectionValue(item)"
                          outline
                          class="confidence-value"
                        />
                      </div>
                    </div>
                  </q-card-section>
                </q-card>

                <!-- Single field content -->
                <q-card v-else-if="hasValue(field)" flat bordered>
                  <q-card-section>
                    <div class="confidence-item">
                      <q-badge
                        :color="getConfidenceColor(getFieldConfidence(field))"
                        :label="formatConfidence(getFieldConfidence(field))"
                        class="q-mb-xs confidence-badge"
                      />
                      <q-badge
                        :color="getConfidenceColor(getFieldConfidence(field))"
                        :label="getFieldValue(field)"
                        outline
                        class="confidence-value"
                      />
                    </div>
                  </q-card-section>
                </q-card>
              </q-expansion-item>
            </q-list>
          </q-card-section>
        </q-card>
      </q-expansion-item>

      <!-- Volumes section -->
      <q-expansion-item
        v-if="tree.volumes?.length"
        icon="inventory_2"
        :label="`Volumes (${tree.volumes.length})`"
        :default-opened="expandAll || volumesWithLowConfidence > 0"
        group="title-volumes"
        :header-class="{
          'text-primary': volumesWithLowConfidence === 0,
          'bg-red-1': volumesWithCriticalConfidence > 0,
          'bg-orange-1':
            volumesWithLowConfidence > 0 && volumesWithCriticalConfidence === 0,
        }"
        :expand-icon-class="{
          'text-primary': volumesWithLowConfidence === 0,
          'text-negative': volumesWithCriticalConfidence > 0,
          'text-warning':
            volumesWithLowConfidence > 0 && volumesWithCriticalConfidence === 0,
        }"
      >
        <template #header>
          <q-item-section avatar>
            <q-icon
              name="inventory_2"
              :color="
                volumesWithCriticalConfidence > 0
                  ? 'negative'
                  : volumesWithLowConfidence > 0
                    ? 'warning'
                    : 'primary'
              "
            />
          </q-item-section>

          <q-item-section>
            <q-item-label>Volumes ({{ tree.volumes.length }})</q-item-label>
            <q-item-label caption v-if="volumesWithLowConfidence > 0">
              {{ volumesWithLowConfidence }} volumes need attention
            </q-item-label>
          </q-item-section>

          <q-item-section side v-if="volumesWithLowConfidence > 0">
            <q-chip
              dense
              :color="
                volumesWithCriticalConfidence > 0 ? 'negative' : 'warning'
              "
              text-color="white"
              icon="warning"
            >
              {{ volumesWithLowConfidence }} / {{ tree.volumes.length }}
            </q-chip>
          </q-item-section>
        </template>

        <q-card>
          <q-card-section>
            <div class="volume-list">
              <div
                v-for="volume in tree.volumes"
                :key="volume.id"
                class="volume-item q-mb-md"
                :class="{
                  'critical-confidence-container':
                    hasVolumeCriticalConfidence(volume),
                  'low-confidence-container':
                    hasVolumeLowConfidence(volume) &&
                    !hasVolumeCriticalConfidence(volume),
                }"
              >
                <!-- We use VolumeTree component to render each volume -->
                <VolumeTree :tree="volume" />
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </q-list>
  </q-card>
</template>

<style scoped>
.title-tree {
  max-width: 1200px;
  margin: 0 auto;
}

.confidence-chip {
  font-size: 0.9rem;
  padding: 8px 12px;
}

.critical-confidence {
  border-left: 4px solid var(--q-negative);
}

.low-confidence {
  border-left: 4px solid var(--q-warning);
}

.critical-confidence-container {
  border: 3px solid var(--q-negative);
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(255, 0, 0, 0.15);
}

.low-confidence-container {
  border: 3px solid var(--q-warning);
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(255, 150, 0, 0.15);
}

.bg-red-1 {
  background-color: rgba(255, 0, 0, 0.1);
}

.bg-orange-1 {
  background-color: rgba(255, 153, 0, 0.1);
}

.confidence-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 8px;
}

.confidence-badge {
  font-size: 0.8rem;
  margin-bottom: 4px;
}

.confidence-value {
  font-size: 0.9rem;
  padding: 8px 12px;
}

.volume-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.volume-item {
  border-radius: 8px;
  overflow: hidden;
}
</style>
