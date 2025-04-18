<script setup lang="ts">
import { watch, toRef, ref, onMounted } from 'vue';
import { DetectionState } from 'src/types/frontend-state';
import { AnnotationListItem } from './AnnotationListItem';
import { useAnnotationFilters } from './composables/useAnnotationFilters';
import { useAnnotationStatistics } from './composables/useAnnotationStatistics';
import { useDebouncedDetections } from './composables/useDebouncedDetections';
import { ANNOTATION_EVENTS } from 'src/constants/events';

const props = defineProps<{
  detections: DetectionState[];
  loading?: boolean;
}>();

// Define emits for parent component
const emit = defineEmits([
  ANNOTATION_EVENTS.SCROLL_TO,
  ANNOTATION_EVENTS.SELECT,
]);

// Handle scroll to annotation event from list item
const handleScrollToAnnotation = (detection: DetectionState) => {
  console.log(
    `Forwarding ${ANNOTATION_EVENTS.SCROLL_TO} event for detection:`,
    detection.id,
  );
  emit(ANNOTATION_EVENTS.SCROLL_TO, detection);
};

// Handle select annotation event from list item
const handleSelectAnnotation = (detection: DetectionState) => {
  console.log(
    `Forwarding ${ANNOTATION_EVENTS.SELECT} event for detection:`,
    detection.id,
  );
  emit(ANNOTATION_EVENTS.SELECT, detection);
};

// For debugging
onMounted(() => {
  console.log(
    `AnnotationList mounted with ${props.detections.length} detections`,
  );
});

// Watch for changes in the detections prop
watch(
  () => props.detections,
  (newDetections) => {
    console.log(`Detections changed: ${newDetections?.length || 0} items`);
  },
  { immediate: true },
);

// Convert props to refs for proper reactivity
const detectionsRef = toRef(() => props.detections);

// Keep track if we've seen detections
const hasSeenDetections = ref(props.detections.length > 0);

// Watch to update the flag when detections are loaded
watch(
  () => props.detections.length,
  (newLength) => {
    if (newLength > 0) {
      hasSeenDetections.value = true;
    }
  },
);

// Setup composables
const { debouncedDetections } = useDebouncedDetections(detectionsRef);
const { statistics } = useAnnotationStatistics(debouncedDetections);
const {
  sortBy,
  filterVerification,
  filterType,
  filterConfidence,
  filterEdited,
  uniqueTypes,
  filteredDetections,
  resetFilters,
} = useAnnotationFilters(debouncedDetections);

// Watch for significant changes in detections to reset filters
watch(
  detectionsRef,
  (newDetections, oldDetections) => {
    if (
      Math.abs((newDetections?.length || 0) - (oldDetections?.length || 0)) > 3
    ) {
      resetFilters();
    }
  },
  { deep: true },
);
</script>

<template>
  <div class="annotation-list">
    <!-- Loading state -->
    <div v-if="props.loading" class="q-pa-md">
      <div class="text-subtitle1 q-pb-md">Loading annotations...</div>

      <!-- Skeleton loaders -->
      <q-item v-for="n in 5" :key="n" class="q-mb-sm">
        <q-item-section>
          <q-skeleton type="QChip" class="q-mb-xs" />
          <q-skeleton type="text" width="85%" class="q-mb-xs" />
          <q-skeleton type="text" width="65%" />
        </q-item-section>
        <q-item-section avatar>
          <q-skeleton type="QAvatar" />
        </q-item-section>
      </q-item>
    </div>

    <!-- Empty state when no detections are available -->
    <div
      v-else-if="!debouncedDetections.length"
      class="empty-state q-pa-md text-center"
    >
      <q-icon name="inbox" size="48px" color="grey-5" />
      <div class="text-subtitle1 q-mt-sm">No annotations available</div>
      <div class="text-caption text-grey-7">
        This image doesn't have any annotations yet
      </div>
    </div>

    <!-- Main content when detections are available -->
    <template v-else-if="debouncedDetections.length">
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
                { label: 'Default order', value: 'default' },
                { label: 'Critical first', value: 'confidence-asc' },
                { label: 'Confident first', value: 'confidence-desc' },
                { label: 'By position', value: 'position' },
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
              :options="[{ label: 'All types', value: '' }, ...uniqueTypes]"
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
      <div
        class="q-pa-xs q-mb-sm text-caption text-grey-8 flex justify-between"
      >
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

      <!-- Empty state for filtered results -->
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

      <!-- List of annotations with virtual scrolling -->
      <div class="annotation-items q-px-md q-pt-sm q-pb-xl">
        <div v-for="detection in filteredDetections" :key="detection.id">
          <AnnotationListItem
            :detection="detection"
            :loading="props.loading"
            @scrollToAnnotation="handleScrollToAnnotation"
            @selectAnnotation="handleSelectAnnotation"
          />
        </div>
      </div>
    </template>
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
