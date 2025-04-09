<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  statistics: {
    type: Object,
    required: true,
  },
  filterVerified: {
    type: String,
    required: true,
  },
  searchQuery: {
    type: String,
    required: true,
  },
  filteredImagesCount: {
    type: Number,
    required: true,
  },
  totalImagesCount: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['resetFilters']);

function resetFilters() {
  emit('resetFilters');
}

// Determine if any filters are active
const hasActiveFilters = computed(() => {
  return props.searchQuery || props.filterVerified !== 'all';
});

// Check if we need to show the reset filters button
const showResetButton = computed(() => {
  return hasActiveFilters.value;
});
</script>

<template>
  <div class="q-px-sm q-mb-sm text-caption text-grey-8">
    <!-- Simplified unified stats summary -->
    <div class="stats-summary q-pa-xs rounded-borders">
      <div class="row q-mb-xs">
        <div class="col-12">
          <div class="text-caption text-grey-8 q-mb-xs">
            Confidence & Verification Summary
          </div>

          <!-- Single unified progress bar -->
          <div class="stacked-progress q-mb-sm">
            <!-- High confidence (green) -->
            <div
              class="progress-segment high-confidence"
              :style="`width: ${((statistics.total - statistics.lowConfidence - statistics.mediumConfidence) / (statistics.total || 1)) * 100}%`"
            >
              <q-tooltip
                >{{
                  statistics.total -
                  statistics.lowConfidence -
                  statistics.mediumConfidence
                }}
                high confidence pages (≥ 90%)</q-tooltip
              >
            </div>

            <!-- Medium confidence (orange) -->
            <div
              class="progress-segment medium-confidence"
              :style="`width: ${(statistics.mediumConfidence / (statistics.total || 1)) * 100}%`"
            >
              <q-tooltip
                >{{ statistics.mediumConfidence }} medium confidence pages
                (70-90%)</q-tooltip
              >
            </div>

            <!-- Low confidence (red) -->
            <div
              class="progress-segment low-confidence"
              :style="`width: ${(statistics.lowConfidence / (statistics.total || 1)) * 100}%`"
            >
              <q-tooltip
                >{{ statistics.lowConfidence }} low confidence pages (&lt;
                70%)</q-tooltip
              >
            </div>
          </div>

          <!-- Simplified legend with badges in a single row -->
          <div class="legend-row">
            <q-badge color="green-8" outline class="legend-badge">
              <q-icon name="verified" size="xs" class="q-mr-xs" />
              <span
                >{{ statistics.total - statistics.unverified }} Verified</span
              >
            </q-badge>

            <q-badge color="orange-8" outline class="legend-badge">
              <q-icon name="pending_actions" size="xs" class="q-mr-xs" />
              <span>{{ statistics.unverified }} Unverified</span>
            </q-badge>

            <q-badge color="green-8" outline class="legend-badge">
              <div class="color-dot high-confidence-dot q-mr-xs"></div>
              <span
                >{{
                  statistics.total -
                  statistics.lowConfidence -
                  statistics.mediumConfidence
                }}
                High</span
              >
            </q-badge>

            <q-badge color="orange-6" outline class="legend-badge">
              <q-icon name="trending_down" size="xs" class="q-mr-xs" />
              <span>{{ statistics.mediumConfidence }} Medium</span>
            </q-badge>

            <q-badge color="red-8" outline class="legend-badge">
              <q-icon name="warning" size="xs" class="q-mr-xs" />
              <span>{{ statistics.lowConfidence }} Low</span>
            </q-badge>

            <div class="spacer"></div>

            <q-btn
              v-if="showResetButton"
              flat
              dense
              size="sm"
              color="primary"
              label="Reset"
              @click="resetFilters"
              icon="filter_alt_off"
              class="reset-btn"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.stats-summary {
  border-radius: 4px;
}

.stacked-progress {
  display: flex;
  height: 8px;
  width: 100%;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.progress-segment {
  height: 100%;
  transition: width 0.3s ease;
}

/* Add styles for the simplified legend row */
.legend-row {
  display: flex;
  margin-top: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.legend-badge {
  margin-right: 8px;
  margin-bottom: 4px;
  padding: 2px 8px;
}

.spacer {
  flex-grow: 1;
}

.reset-btn {
  margin-bottom: 4px;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.high-confidence,
.high-confidence-dot {
  background-color: #2e7d32; /* green-8 */
}

.medium-confidence {
  background-color: #fb8c00; /* orange-6 */
}

.low-confidence {
  background-color: #d32f2f; /* red-8 */
}
</style>
