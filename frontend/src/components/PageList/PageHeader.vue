<script setup lang="ts">
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
});

// Using props directly to avoid linter error
console.log('Current sort criteria:', props.sortBy);

const emit = defineEmits([
  'update:searchQuery',
  'update:sortBy',
  'update:filterVerified',
  'update:confidenceFilters',
]);

const confidenceOptions = [
  { label: 'Low', value: 'low', color: 'red' },
  { label: 'Medium', value: 'medium', color: 'orange' },
  { label: 'High', value: 'high', color: 'green' },
];

function toggleConfidenceFilter(level: string) {
  const newFilters = { ...props.confidenceFilters };
  newFilters[level] = !newFilters[level];
  emit('update:confidenceFilters', newFilters);
}

function getColorValue(colorName: string): string {
  // Map Quasar color names to hex values
  const colorMap: Record<string, string> = {
    red: '#F44336',
    orange: '#FF9800',
    green: '#4CAF50',
    'grey-5': '#9E9E9E',
  };

  return colorMap[colorName] || '#9E9E9E';
}
</script>

<template>
  <div class="page-header">
    <!-- Row 1: Heading -->
    <div class="header-row heading-row q-px-md q-py-sm">
      <div class="text-h6">Pages</div>
    </div>

    <!-- Row 2: Search Bar -->
    <div class="header-row search-row q-px-md q-py-sm">
      <q-input
        :modelValue="searchQuery"
        dense
        outlined
        placeholder="Search images..."
        class="full-width"
        @update:modelValue="emit('update:searchQuery', $event)"
      >
        <template v-slot:prepend>
          <q-icon name="search" size="xs" />
        </template>
        <template v-slot:append v-if="searchQuery">
          <q-icon
            name="close"
            class="cursor-pointer"
            @click="emit('update:searchQuery', '')"
          />
        </template>
      </q-input>
    </div>

    <!-- Row 3: Sort and Verification Dropdowns -->
    <div class="header-row filter-row q-px-md q-py-sm">
      <!-- Sort dropdown -->
      <q-select
        :modelValue="sortBy"
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
        ]"
        option-label="label"
        option-value="value"
        map-options
        emit-value
        label="Sort By"
        class="sort-select"
        @update:modelValue="emit('update:sortBy', $event)"
      />

      <!-- Filter verified dropdown -->
      <q-select
        :modelValue="filterVerified"
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
        @update:modelValue="emit('update:filterVerified', $event)"
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
                backgroundColor: confidenceFilters[option.value]
                  ? getColorValue(option.color)
                  : 'transparent',
                color: confidenceFilters[option.value] ? 'white' : '#555',
                borderColor: confidenceFilters[option.value]
                  ? getColorValue(option.color)
                  : '#ddd',
              }"
              @click="toggleConfidenceFilter(option.value)"
            >
              {{ option.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  background-color: white;
  z-index: 10;
}

.header-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);

  &:last-child {
    border-bottom: none;
  }
}

.heading-row {
  background-color: #f5f5f5;
}

.filter-row {
  display: flex;
  gap: 12px;

  .sort-select,
  .verification-select {
    flex: 1;
  }
}

.confidence-row {
  background-color: rgba(0, 0, 0, 0.02);
}

.confidence-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
}
</style>
