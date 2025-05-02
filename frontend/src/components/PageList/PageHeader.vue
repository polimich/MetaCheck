<script setup lang="ts">
import { useViewMode, useGridColumns, useFilters } from './composables';
import { computed, watch, ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';

const props = defineProps({
  searchQuery: {
    type: String,
    required: true,
  },
  sortBy: {
    type: String,
    required: true,
  },
  filterVerified: {
    type: String,
    required: true,
  },
  confidenceFilters: {
    type: Object,
    required: true,
  },
  viewMode: {
    type: String,
    required: true,
  },
  userGridColumns: {
    type: Number,
    required: true,
  },
  layoutMode: {
    type: String,
    default: 'sidebar',
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'update:searchQuery',
  'update:sortBy',
  'update:filterVerified',
  'update:confidenceFilters',
  'update:viewMode',
  'update:userGridColumns',
  'locate-active-image',
]);

// Use view mode composable
const { currentViewMode, isGridView } = useViewMode(
  props.viewMode as 'list-small' | 'list-large' | 'grid',
  (mode: string) => emit('update:viewMode', mode),
);

// Watch for changes to viewMode prop to ensure reactivity
watch(
  () => props.viewMode,
  (newMode) => {
    if (newMode !== currentViewMode.value) {
      currentViewMode.value = newMode as 'list-small' | 'list-large' | 'grid';
    }
  },
);

// Use grid columns composable
const { currentGridColumns, gridColumnOptions } = useGridColumns(
  props.userGridColumns,
  (cols: number) => emit('update:userGridColumns', cols),
);

// Watch for changes to userGridColumns prop to ensure reactivity
watch(
  () => props.userGridColumns,
  (newValue) => {
    if (newValue !== currentGridColumns.value) {
      currentGridColumns.value = newValue;
    }
  },
);

// Use filters composable
const { confidenceOptions, getColorValue } = useFilters(
  props.sortBy,
  props.filterVerified,
  props.confidenceFilters as Record<string, boolean>,
  (sort) => emit('update:sortBy', sort),
  (filter) => emit('update:filterVerified', filter),
  (filters) => emit('update:confidenceFilters', filters),
);

const updateGridColumns = (cols: number) => {
  currentGridColumns.value = cols;
  emit('update:userGridColumns', cols);
};

// Create a local searchQuery ref for debouncing
const localSearchQuery = ref(props.searchQuery);

// Create a debounced function to update the parent component
const debouncedSearchUpdate = useDebounceFn((value: string) => {
  emit('update:searchQuery', value);
}, 300); // 300ms debounce delay

// Watch for local search query changes to debounce
watch(localSearchQuery, (newValue) => {
  debouncedSearchUpdate(newValue);
});

// Create computed properties with two-way binding for the template
const sortByComputed = computed({
  get: () => props.sortBy,
  set: (value: string) => emit('update:sortBy', value),
});

const filterVerifiedComputed = computed({
  get: () => props.filterVerified,
  set: (value: string) => emit('update:filterVerified', value),
});

// Create computed for confidence filters
const confidenceFiltersComputed = computed({
  get: () => props.confidenceFilters as Record<string, boolean>,
  set: (value: Record<string, boolean>) =>
    emit('update:confidenceFilters', value),
});

// Create a wrapper for toggleConfidenceFilter that prevents unnecessary re-renders
const handleToggleConfidence = (level: string) => {
  const newFilters = { ...confidenceFiltersComputed.value };
  if (newFilters[level] === !newFilters[level]) return; // Skip if no change
  newFilters[level] = !newFilters[level];
  emit('update:confidenceFilters', newFilters);
};

// Watch for props changes with shallow comparison to reduce reactivity overhead
watch(
  () => props.sortBy,
  (newValue) => {
    if (sortByComputed.value !== newValue) {
      sortByComputed.value = newValue;
    }
  },
);

watch(
  () => props.filterVerified,
  (newValue) => {
    if (filterVerifiedComputed.value !== newValue) {
      filterVerifiedComputed.value = newValue;
    }
  },
);

// Watch for searchQuery prop changes
watch(
  () => props.searchQuery,
  (newValue) => {
    if (localSearchQuery.value !== newValue) {
      localSearchQuery.value = newValue;
    }
  },
);

// Replace deep watching with targeted watching only for changed properties
// to avoid unnecessary reactivity cascades
watch(
  () => props.confidenceFilters,
  (newValue, oldValue) => {
    const typedValue = newValue as Record<string, boolean>;
    const typedOldValue = oldValue as Record<string, boolean>;

    // Only update if actual changes occurred
    let hasChanged = false;
    for (const key in typedValue) {
      if (typedValue[key] !== typedOldValue?.[key]) {
        hasChanged = true;
        break;
      }
    }

    if (hasChanged) {
      confidenceFiltersComputed.value = { ...typedValue };
    }
  },
  { deep: false }, // Remove deep watching which is expensive
);
</script>

<template>
  <div
    class="page-header"
    :class="{ 'header-fullwidth': layoutMode === 'full-width' }"
  >
    <!-- Optimized single-row layout for full-width mode -->
    <div
      v-if="layoutMode === 'full-width'"
      class="header-row super-compact-row q-pa-sm"
    >
      <div class="row items-center q-col-gutter-sm no-wrap">
        <!-- View Mode Controls - fixed width -->
        <div class="col-auto view-selector-wrapper" style="width: 200px">
          <div class="row items-center justify-between no-wrap">
            <!-- List Small Button -->
            <q-btn
              flat
              :color="currentViewMode === 'list-small' ? 'primary' : 'grey-7'"
              icon="view_list"
              dense
              @click="currentViewMode = 'list-small'"
            >
              <q-tooltip>Compact List View</q-tooltip>
            </q-btn>

            <!-- List Large Button -->
            <q-btn
              flat
              :color="currentViewMode === 'list-large' ? 'primary' : 'grey-7'"
              icon="view_headline"
              dense
              @click="currentViewMode = 'list-large'"
            >
              <q-tooltip>Detailed List View</q-tooltip>
            </q-btn>

            <!-- Grid Button with Column Dropdown -->
            <q-btn
              flat
              :color="currentViewMode === 'grid' ? 'primary' : 'grey-7'"
              icon="grid_view"
              dense
              @click="currentViewMode = 'grid'"
            >
              <q-tooltip>Grid View</q-tooltip>
            </q-btn>

            <!-- Grid Column Dropdown -->
            <q-btn-dropdown
              v-if="isGridView"
              flat
              dense
              :label="currentGridColumns.toString()"
              class="q-ml-xs grid-columns-dropdown"
            >
              <q-list>
                <q-item
                  v-for="cols in gridColumnOptions"
                  :key="cols"
                  clickable
                  v-close-popup
                  @click="updateGridColumns(cols)"
                  :active="currentGridColumns === cols"
                >
                  <q-item-section>
                    <q-item-label>{{ cols }} columns</q-item-label>
                  </q-item-section>
                  <q-item-section avatar v-if="currentGridColumns === cols">
                    <q-icon name="check" color="primary" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
        </div>

        <!-- Search Box - fixed width - use debounced local value -->
        <div class="col-auto search-box-container" style="width: 500px">
          <q-input
            v-model="localSearchQuery"
            dense
            outlined
            placeholder="Search images..."
            class="full-width"
          >
            <template v-slot:prepend>
              <q-icon name="search" size="xs" />
            </template>
            <template v-slot:append v-if="localSearchQuery">
              <q-icon
                name="close"
                class="cursor-pointer"
                @click="localSearchQuery = ''"
              />
            </template>
          </q-input>
        </div>

        <!-- Expanded Filters Container -->
        <div class="col-12 col-sm-8 filters-container" style="min-width: 600px">
          <div class="row items-center justify-start q-gutter-md">
            <!-- Sort dropdown -->
            <div class="col-auto">
              <q-select
                v-model="sortByComputed"
                dense
                outlined
                :options="[
                  { label: 'Order', value: 'order' },
                  { label: 'Name (A-Z)', value: 'name_asc' },
                  { label: 'Name (Z-A)', value: 'name_desc' },
                  { label: 'Newest first', value: 'date_desc' },
                  { label: 'Oldest first', value: 'date_asc' },
                  {
                    label: 'Confidence (Low to High)',
                    value: 'confidence_asc',
                  },
                  {
                    label: 'Confidence (High to Low)',
                    value: 'confidence_desc',
                  },
                  {
                    label: 'Most Detections',
                    value: 'detection_count_desc',
                  },
                ]"
                option-label="label"
                option-value="value"
                map-options
                emit-value
                label="Sort By"
                class="sort-select"
              />
            </div>

            <!-- Filter verified dropdown -->
            <div class="col-auto">
              <q-select
                v-model="filterVerifiedComputed"
                dense
                outlined
                :options="[
                  { label: 'All verification', value: 'all' },
                  { label: 'Verified only', value: 'verified' },
                  { label: 'Unverified only', value: 'unverified' },
                ]"
                option-label="label"
                option-value="value"
                map-options
                emit-value
                label="Verification"
                class="verification-select"
              />
            </div>

            <!-- Confidence Filters -->
            <div class="col-auto confidence-filters">
              <div class="confidence-buttons">
                <div
                  v-for="option in confidenceOptions"
                  :key="option.value"
                  class="confidence-filter-btn"
                  :style="{
                    backgroundColor: confidenceFiltersComputed[option.value]
                      ? getColorValue(option.color)
                      : 'transparent',
                    color: confidenceFiltersComputed[option.value]
                      ? 'white'
                      : '#555',
                    borderColor: confidenceFiltersComputed[option.value]
                      ? getColorValue(option.color)
                      : '#ddd',
                  }"
                  @click="handleToggleConfidence(option.value)"
                >
                  {{ option.label }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Standard sidebar layout -->
    <template v-else>
      <!-- Row 1: View Mode Selection & Grid Controls -->

      <!-- Row 2: Search Bar -->
      <div class="header-row search-row q-px-md q-py-sm">
        <q-input
          v-model="localSearchQuery"
          dense
          outlined
          placeholder="Search images..."
          class="full-width"
        >
          <template v-slot:prepend>
            <q-icon name="search" size="xs" />
          </template>
          <template v-slot:append v-if="localSearchQuery">
            <q-icon
              name="close"
              class="cursor-pointer"
              @click="localSearchQuery = ''"
            />
          </template>
        </q-input>
      </div>

      <!-- Row 3: Sort and Verification Dropdowns -->
      <div class="header-row filter-row q-px-md q-py-sm">
        <!-- Sort dropdown -->
        <q-select
          v-model="sortByComputed"
          dense
          outlined
          :options="[
            { label: 'Order', value: 'order' },
            { label: 'Name (A-Z)', value: 'name_asc' },
            { label: 'Name (Z-A)', value: 'name_desc' },
            { label: 'Newest first', value: 'date_desc' },
            { label: 'Oldest first', value: 'date_asc' },
            { label: 'Confidence (Low to High)', value: 'confidence_asc' },
            { label: 'Confidence (High to Low)', value: 'confidence_desc' },
            { label: 'Most Detections', value: 'detection_count_desc' },
          ]"
          option-label="label"
          option-value="value"
          map-options
          emit-value
          label="Sort By"
          class="sort-select"
        />

        <!-- Filter verified dropdown -->
        <q-select
          v-model="filterVerifiedComputed"
          dense
          outlined
          :options="[
            { label: 'All verification', value: 'all' },
            { label: 'Verified only', value: 'verified' },
            { label: 'Unverified only', value: 'unverified' },
          ]"
          option-label="label"
          option-value="value"
          map-options
          emit-value
          label="Verification"
          class="verification-select"
        />
      </div>

      <!-- Row 4: Confidence Level Filters -->
      <div class="header-row confidence-row q-px-md q-py-sm">
        <div class="row items-center">
          <div class="col-auto text-body2 text-weight-medium q-mr-md">
            Page Confidence:
          </div>
          <div class="col">
            <div class="confidence-buttons">
              <div
                v-for="option in confidenceOptions"
                :key="option.value"
                class="confidence-filter-btn"
                :style="{
                  backgroundColor: confidenceFiltersComputed[option.value]
                    ? getColorValue(option.color)
                    : 'transparent',
                  color: confidenceFiltersComputed[option.value]
                    ? 'white'
                    : '#555',
                  borderColor: confidenceFiltersComputed[option.value]
                    ? getColorValue(option.color)
                    : '#ddd',
                }"
                @click="handleToggleConfidence(option.value)"
              >
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-auto view-selector-wrapper q-px-md q-py-sm">
        <div class="row items-center no-wrap full-width">
          <div class="col-auto text-body2 text-weight-medium q-mr-md">
            View Mode:
          </div>
          <!-- List Small Button -->
          <q-btn
            flat
            :color="currentViewMode === 'list-small' ? 'primary' : 'grey-7'"
            icon="view_list"
            dense
            @click="currentViewMode = 'list-small'"
          >
            <q-tooltip>Compact List View</q-tooltip>
          </q-btn>

          <!-- List Large Button -->
          <q-btn
            flat
            :color="currentViewMode === 'list-large' ? 'primary' : 'grey-7'"
            icon="view_headline"
            dense
            @click="currentViewMode = 'list-large'"
          >
            <q-tooltip>Detailed List View</q-tooltip>
          </q-btn>

          <!-- Grid Button with Column Dropdown -->
          <q-btn
            flat
            :color="currentViewMode === 'grid' ? 'primary' : 'grey-7'"
            icon="grid_view"
            dense
            @click="currentViewMode = 'grid'"
          >
            <q-tooltip>Grid View</q-tooltip>
          </q-btn>

          <!-- Grid Column Dropdown -->
          <q-btn-dropdown
            v-if="isGridView"
            flat
            dense
            :label="currentGridColumns.toString()"
            class="q-ml-xs grid-columns-dropdown"
          >
            <q-list>
              <q-item
                v-for="cols in gridColumnOptions"
                :key="cols"
                clickable
                v-close-popup
                @click="updateGridColumns(cols)"
                :active="currentGridColumns === cols"
              >
                <q-item-section>
                  <q-item-label>{{ cols }} columns</q-item-label>
                </q-item-section>
                <q-item-section avatar v-if="currentGridColumns === cols">
                  <q-icon name="check" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <div class="col"></div>

          <q-btn
            flat
            dense
            icon="my_location"
            class="locate-btn"
            @click="emit('locate-active-image')"
          >
            <q-tooltip>Locate active image</q-tooltip>
          </q-btn>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.page-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  background-color: white;
  z-index: 10;

  &.header-fullwidth {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
}

.header-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);

  &:last-child {
    border-bottom: none;
  }

  &.super-compact-row {
    padding: 8px;
    background-color: #f8f8f8;
  }
}

.search-box-container {
  @media (max-width: 767px) {
    order: -1; // Move search to top on mobile
  }
}

.grid-columns-dropdown {
  min-width: 40px;

  :deep(.q-btn__content) {
    padding-left: 4px;
    padding-right: 4px;
  }
}

.filter-row {
  display: flex;
  gap: 12px;
  flex: 1;

  @media (max-width: 1100px) {
    flex-direction: column;
    gap: 8px;
  }

  .sort-select,
  .verification-select {
    flex: 1;
  }
}

.confidence-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  @media (max-width: 991px) {
    gap: 4px;
  }
}

.confidence-filter-btn {
  min-width: 80px;
  height: 32px;
  border-radius: 16px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0 12px;

  &:hover {
    opacity: 0.9;
  }

  @media (max-width: 991px) {
    min-width: 60px;
    height: 28px;
    font-size: 11px;
    padding: 0 8px;
  }
}

.full-width {
  width: 100%;
}
</style>
