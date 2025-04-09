<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { DetectionState, MetaRoleOption } from 'src/types/frontend-state';
import { AnnotationListItem } from './AnnotationListItem';

const props = defineProps<{
  detections: DetectionState[];
  options?: MetaRoleOption[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'load-meta-roles', id: string): void;
}>();

// Filter settings
const sortBy = ref('confidence-asc'); // 'confidence-asc', 'confidence-desc', 'default'
const filterVerification = ref('all'); // 'all', 'unverified', 'verified'
const filterType = ref(''); // Filter by detection type, empty string means all
const filterConfidence = ref('all'); // 'all', 'low', 'medium', 'high'
const filterEdited = ref(false); // Show only edited detections

// Add debounced detections to prevent showing temporary ones
const debouncedDetections = ref<DetectionState[]>([]);
const debounceTimeoutId = ref<number | null>(null);

// Update debounced detections with a delay
watch(
  () => props.detections,
  (newDetections) => {
    // Cancel any pending debounce
    if (debounceTimeoutId.value !== null) {
      clearTimeout(debounceTimeoutId.value);
    }

    // Set a timeout to update the detections after a delay
    debounceTimeoutId.value = setTimeout(() => {
      debouncedDetections.value = newDetections;
    }, 300) as unknown as number; // 300ms delay
  },
  { immediate: true },
);

// Reset filters when detections change completely (new image loaded)
watch(
  () => props.detections,
  () => {
    // Only reset if the detection count changes significantly (new image)
    // This prevents resetting when a single detection is updated
    if (
      previousDetectionCount.value > 0 &&
      Math.abs(props.detections.length - previousDetectionCount.value) > 3
    ) {
      resetFilters();
    }
    previousDetectionCount.value = props.detections.length;
  },
  { deep: false },
);

const previousDetectionCount = ref(0);

// Compute sorted and filtered detection list
const filteredDetections = computed(() => {
  // Start with debounced detections instead of props.detections
  let result = [...debouncedDetections.value];

  // Filter by verification status
  if (filterVerification.value !== 'all') {
    const shouldBeVerified = filterVerification.value === 'verified';
    result = result.filter(
      (detection) => detection.annotated === shouldBeVerified,
    );
  }

  // Filter by type
  if (filterType.value) {
    result = result.filter(
      (detection) => detection.computed_type === filterType.value,
    );
  }

  // Filter by confidence level
  if (filterConfidence.value !== 'all') {
    result = result.filter((detection) => {
      const confidence = detection.confidence ?? 0;
      switch (filterConfidence.value) {
        case 'low':
          return confidence < 0.5;
        case 'medium':
          return confidence >= 0.5 && confidence < 0.8;
        case 'high':
          return confidence >= 0.8;
        default:
          return true;
      }
    });
  }

  // Filter by edited status
  if (filterEdited.value) {
    result = result.filter((detection) => detection.edited);
  }

  // Sort the detections
  switch (sortBy.value) {
    case 'confidence-asc':
      // Sort from least confident (critical) to most confident
      return result.sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
    case 'confidence-desc':
      // Sort from most confident to least confident
      return result.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    case 'position':
      // Sort by position (y coordinate, then x coordinate)
      return result.sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });
    default:
      // Default sorting
      return result;
  }
});

// Get unique detection types for the type filter
const uniqueTypes = computed(() => {
  const types = new Set<string>();
  debouncedDetections.value.forEach((detection) => {
    if (detection.computed_type) {
      types.add(detection.computed_type);
    }
  });
  return Array.from(types);
});

// Compute statistics about detections
const statistics = computed(() => {
  const total = debouncedDetections.value.length;
  const verified = debouncedDetections.value.filter((d) => d.annotated).length;
  const unverified = total - verified;
  const edited = debouncedDetections.value.filter((d) => d.edited).length;

  const lowConfidence = debouncedDetections.value.filter(
    (d) => (d.confidence ?? 0) < 0.5,
  ).length;
  const mediumConfidence = debouncedDetections.value.filter((d) => {
    const conf = d.confidence ?? 0;
    return conf >= 0.5 && conf < 0.8;
  }).length;
  const highConfidence = debouncedDetections.value.filter(
    (d) => (d.confidence ?? 0) >= 0.8,
  ).length;

  return {
    total,
    verified,
    unverified,
    edited,
    lowConfidence,
    mediumConfidence,
    highConfidence,
  };
});

// Handle load meta roles event from child component
const handleLoadMetaRoles = (id: string) => {
  emit('load-meta-roles', id);
};

// Reset all filters
const resetFilters = () => {
  sortBy.value = 'confidence-asc';
  filterVerification.value = 'all';
  filterType.value = '';
  filterConfidence.value = 'all';
  filterEdited.value = false;
};
</script>

<template>
  <div class="annotation-list">
    <!-- Filters section -->
    <div class="filter-bar q-pa-sm q-mb-sm">
      <div class="row q-col-gutter-sm">
        <!-- Sort dropdown -->
        <div class="col-12 col-sm-6 col-md-3">
          <q-select
            v-model="sortBy"
            label="Sort by"
            dense
            outlined
            :options="[
              { label: 'Critical first', value: 'confidence-asc' },
              { label: 'Confident first', value: 'confidence-desc' },
              { label: 'By position', value: 'position' },
              { label: 'Default order', value: 'default' },
            ]"
            map-options
            emit-value
          />
        </div>

        <!-- Type filter -->
        <div class="col-12 col-sm-6 col-md-3">
          <q-select
            v-model="filterType"
            label="Filter by type"
            dense
            outlined
            :options="[
              { label: 'All types', value: '' },
              ...uniqueTypes.map((type) => ({ label: type, value: type })),
            ]"
            map-options
            emit-value
          />
        </div>

        <!-- Verification filter -->
        <div class="col-12 col-sm-6 col-md-3">
          <q-select
            v-model="filterVerification"
            label="Verification"
            dense
            outlined
            :options="[
              { label: 'All annotations', value: 'all' },
              {
                label: 'Unverified only',
                value: 'unverified',
                color: 'orange',
                count: statistics.unverified,
              },
              {
                label: 'Verified only',
                value: 'verified',
                color: 'green',
                count: statistics.verified,
              },
            ]"
            emit-value
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                </q-item-section>
                <q-item-section side v-if="scope.opt.count !== undefined">
                  <q-chip
                    dense
                    :color="scope.opt.color"
                    text-color="white"
                    size="sm"
                  >
                    {{ scope.opt.count }}
                  </q-chip>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- Confidence filter -->
        <div class="col-12 col-sm-6 col-md-3">
          <q-select
            v-model="filterConfidence"
            label="Confidence"
            dense
            outlined
            :options="[
              { label: 'All confidence levels', value: 'all' },
              {
                label: 'Low confidence',
                value: 'low',
                color: 'red-8',
                count: statistics.lowConfidence,
              },
              {
                label: 'Medium confidence',
                value: 'medium',
                color: 'orange-8',
                count: statistics.mediumConfidence,
              },
              {
                label: 'High confidence',
                value: 'high',
                color: 'green-8',
                count: statistics.highConfidence,
              },
            ]"
            emit-value
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                </q-item-section>
                <q-item-section side v-if="scope.opt.count !== undefined">
                  <q-chip
                    dense
                    :color="scope.opt.color"
                    text-color="white"
                    size="sm"
                  >
                    {{ scope.opt.count }}
                  </q-chip>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- Additional filters row -->
        <div class="col-12 q-mt-xs flex items-center justify-between">
          <q-checkbox
            v-model="filterEdited"
            label="Show edited only"
            class="q-mr-md"
          >
            <q-tooltip>
              Show only annotations that have been modified ({{
                statistics.edited
              }})
            </q-tooltip>
          </q-checkbox>

          <!-- Clear filters button -->
          <q-btn
            flat
            outline
            color="primary"
            label="Reset filters"
            size="sm"
            @click="resetFilters"
            icon="filter_alt_off"
            class="q-ml-auto"
          />
        </div>
      </div>
    </div>

    <!-- Results count -->
    <div class="q-pa-xs q-mb-sm text-caption text-grey-8 flex justify-between">
      <div>
        Showing {{ filteredDetections.length }} of
        {{ debouncedDetections.length }} annotations
        <template v-if="filterVerification !== 'all'">
          ({{ filterVerification === 'verified' ? 'verified' : 'unverified' }}
          only)
        </template>
        <template v-if="filterType"> (type: {{ filterType }}) </template>
        <template v-if="filterConfidence !== 'all'">
          ({{ filterConfidence }} confidence)
        </template>
        <template v-if="filterEdited"> (edited only) </template>
      </div>

      <!-- Stats summary -->
      <div class="annotation-stats">
        <q-badge outline color="red-8" class="q-mr-xs">{{
          statistics.lowConfidence
        }}</q-badge>
        <q-badge outline color="orange-8" class="q-mr-xs">{{
          statistics.mediumConfidence
        }}</q-badge>
        <q-badge outline color="green-8">{{
          statistics.highConfidence
        }}</q-badge>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="filteredDetections.length === 0"
      class="empty-state q-pa-md text-center"
    >
      <q-icon name="search_off" size="48px" color="grey-5" />
      <div class="text-subtitle1 q-mt-sm">No matching annotations</div>
      <div class="text-caption text-grey-7">Try adjusting your filters</div>
      <q-btn
        flat
        color="primary"
        class="q-mt-sm"
        label="Reset filters"
        @click="resetFilters"
      />
    </div>

    <!-- List of annotation items -->
    <div v-else class="annotation-items">
      <AnnotationListItem
        v-for="detection in filteredDetections"
        :key="detection.id"
        :detection="detection"
        :options="props.options"
        :loading="props.loading"
        @load-meta-roles="() => handleLoadMetaRoles(detection.id)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.annotation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.filter-bar {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.annotation-items {
  overflow-y: auto;
  flex: 1;
  padding: 0 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.annotation-stats {
  display: flex;
  align-items: center;
}
</style>
