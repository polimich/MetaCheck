<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { PageType } from 'src/stores/data/types/enum';

// Create page type options from the enum
const pageTypeOptions = Object.values(PageType).map((value) => ({
  label: value,
  value: value,
}));

// Filter function for the page type select
const filterPageTypes = (val: string, update: (fn: () => void) => void) => {
  if (val === '') {
    update(() => {
      // Return all options when search is empty
      pageTypeFilterOptions.value = pageTypeOptions;
    });
    return;
  }

  update(() => {
    const needle = val.toLowerCase();
    pageTypeFilterOptions.value = pageTypeOptions.filter(
      (v) => v.label.toLowerCase().indexOf(needle) > -1,
    );
  });
};

// Ref to hold filtered options
const pageTypeFilterOptions = ref(pageTypeOptions);

const props = defineProps({
  selectMode: {
    type: Boolean,
    required: true,
  },
  selectedImages: {
    type: Array as () => string[],
    required: true,
  },
  pageTypes: {
    type: Array as () => string[],
    default: () => [],
  },
  layoutMode: {
    type: String,
    default: 'sidebar',
  },
});

const emit = defineEmits([
  'toggleSelectMode',
  'selectAll',
  'deselectAll',
  'markSelectedAsVerified',
  'downloadSelected',
  'changePageIndices',
  'changePageType',
  'refreshData',
]);

// Dialog states
const indexDialogOpen = ref(false);
const pageTypeDialogOpen = ref(false);

// Loading states
const loadingPageIndex = ref(false);
const loadingPageType = ref(false);
const refreshing = ref(false);

// Quasar for notifications
const $q = useQuasar();

// Page index form data
const pageIndexForm = ref({
  prefix: '[',
  suffix: ']',
  startNumber: 1,
  endNumber: null as number | null,
  step: 1,
  pagesPerImage: 1,
});

// Selected page type
const selectedPageType = ref<string | { value: string; label: string }>('');

// Helper function to refresh data
const refreshData = async () => {
  if (refreshing.value) return;

  refreshing.value = true;
  try {
    await emit('refreshData');
    $q.notify({
      type: 'positive',
      message: 'Page data refreshed',
      timeout: 2000,
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error refreshing data',
      timeout: 2000,
    });
  } finally {
    refreshing.value = false;
  }
};

// Form submission handlers
const submitPageIndexChange = async () => {
  if (loadingPageIndex.value) return;

  loadingPageIndex.value = true;

  try {
    // Emit the event but don't use the return value from emit
    emit('changePageIndices', {
      prefix: pageIndexForm.value.prefix,
      suffix: pageIndexForm.value.suffix,
      startNumber: pageIndexForm.value.startNumber,
      endNumber: pageIndexForm.value.endNumber || props.selectedImages.length,
      step: pageIndexForm.value.step,
      pagesPerImage: pageIndexForm.value.pagesPerImage,
    });

    // Show a simple success notification
    $q.notify({
      type: 'positive',
      message: 'Page indices update in progress',
      timeout: 2000,
    });

    // Refresh data after updating
    setTimeout(() => refreshData(), 1000);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Error updating page indices: ${error instanceof Error ? error.message : String(error)}`,
      timeout: 3000,
    });
  } finally {
    loadingPageIndex.value = false;
    indexDialogOpen.value = false;
  }
};

const submitPageTypeChange = async () => {
  if (loadingPageType.value || !selectedPageType.value) return;

  loadingPageType.value = true;

  try {
    // Extract the string value if we have an object
    let pageTypeValue = selectedPageType.value;

    // If we have an object with a value property, use just the string value
    if (
      typeof pageTypeValue === 'object' &&
      pageTypeValue !== null &&
      'value' in pageTypeValue
    ) {
      pageTypeValue = pageTypeValue.value;
    }

    // Emit the event with just the string value
    emit('changePageType', pageTypeValue);

    // Show a simple success notification
    $q.notify({
      type: 'positive',
      message: 'Page types update in progress',
      timeout: 2000,
    });

    // Refresh data after updating
    setTimeout(() => refreshData(), 1000);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Error updating page types: ${error instanceof Error ? error.message : String(error)}`,
      timeout: 3000,
    });
  } finally {
    loadingPageType.value = false;
    pageTypeDialogOpen.value = false;
  }
};

// Using props directly to avoid linter errors
console.log('Select mode is:', props.selectMode);
</script>

<template>
  <div
    class="bulk-actions-container"
    :class="{ 'layout-full-width': layoutMode === 'full-width' }"
  >
    <div class="actions-toolbar">
      <!-- Selection mode toggle -->
      <q-btn
        flat
        round
        :icon="selectMode ? 'close' : 'select_all'"
        :color="selectMode ? 'negative' : 'primary'"
        @click="emit('toggleSelectMode')"
      >
        <q-tooltip>{{
          selectMode ? 'Exit selection mode' : 'Enter selection mode'
        }}</q-tooltip>
      </q-btn>

      <!-- Selection actions (when in select mode) -->
      <template v-if="selectMode">
        <q-btn
          flat
          round
          icon="done_all"
          color="primary"
          @click="emit('selectAll')"
        >
          <q-tooltip>Select all images</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          icon="remove_done"
          color="primary"
          @click="emit('deselectAll')"
        >
          <q-tooltip>Deselect all images</q-tooltip>
        </q-btn>
      </template>

      <!-- Bulk actions (visible when items are selected) -->
      <template v-if="selectedImages.length > 0">
        <q-separator vertical inset />

        <q-btn
          flat
          round
          icon="verified"
          color="positive"
          @click="emit('markSelectedAsVerified')"
        >
          <q-tooltip>Mark selected as verified</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          icon="download"
          color="primary"
          @click="emit('downloadSelected')"
        >
          <q-tooltip>Download selected</q-tooltip>
        </q-btn>

        <!-- Page index change -->
        <q-btn
          flat
          round
          icon="123"
          color="primary"
          @click="indexDialogOpen = true"
          :loading="loadingPageIndex"
        >
          <q-tooltip>Change page indices</q-tooltip>
        </q-btn>

        <!-- Page type change -->
        <q-btn
          flat
          round
          icon="category"
          color="primary"
          @click="pageTypeDialogOpen = true"
          :loading="loadingPageType"
        >
          <q-tooltip>Change page type</q-tooltip>
        </q-btn>

        <!-- Refresh button -->
        <q-btn
          flat
          round
          icon="refresh"
          color="primary"
          @click="refreshData"
          :loading="refreshing"
        >
          <q-tooltip>Refresh data from server</q-tooltip>
        </q-btn>
      </template>

      <!-- Selection counter -->
      <div v-if="selectedImages.length > 0" class="selection-counter">
        {{ selectedImages.length }} selected
      </div>

      <!-- Show page count when no selection -->
      <div v-else class="page-count text-caption text-grey">
        <slot name="page-count"></slot>
      </div>
    </div>

    <!-- Page Index Dialog -->
    <q-dialog v-model="indexDialogOpen">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Change Page Indices</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="submitPageIndexChange">
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <q-input
                  v-model="pageIndexForm.prefix"
                  label="Prefix"
                  outlined
                  dense
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model="pageIndexForm.suffix"
                  label="Suffix"
                  outlined
                  dense
                />
              </div>
              <div class="col-4">
                <q-input
                  v-model.number="pageIndexForm.startNumber"
                  label="Start"
                  type="number"
                  outlined
                  dense
                  :rules="[
                    (val) => (val !== null && val !== undefined) || 'Required',
                  ]"
                />
              </div>
              <div class="col-4">
                <q-input
                  v-model.number="pageIndexForm.endNumber"
                  label="End (optional)"
                  type="number"
                  outlined
                  dense
                  hint="Default: last item"
                />
              </div>
              <div class="col-4">
                <q-input
                  v-model.number="pageIndexForm.step"
                  label="Step"
                  type="number"
                  outlined
                  dense
                  :rules="[(val) => val > 0 || 'Must be > 0']"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model.number="pageIndexForm.pagesPerImage"
                  type="number"
                  label="Pages per image"
                  outlined
                  dense
                  :rules="[
                    (val) => (val !== null && val !== undefined) || 'Required',
                    (val) => val > 0 || 'Must be greater than 0',
                  ]"
                  hint="Number of pages contained in each image"
                />
              </div>
            </div>

            <div class="row q-mt-md">
              <q-space />
              <q-btn label="Cancel" color="grey" flat v-close-popup />
              <q-btn
                label="Apply"
                type="submit"
                color="primary"
                :loading="loadingPageIndex"
                :disable="loadingPageIndex"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Page Type Dialog -->
    <q-dialog v-model="pageTypeDialogOpen">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">Change Page Type</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="submitPageTypeChange">
            <q-select
              v-model="selectedPageType"
              :options="pageTypeFilterOptions"
              label="Page Type"
              outlined
              dense
              use-input
              input-debounce="0"
              @filter="filterPageTypes"
              :rules="[(val) => !!val || 'Please select a page type']"
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    No results found
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <div class="row q-mt-md">
              <q-space />
              <q-btn label="Cancel" color="grey" flat v-close-popup />
              <q-btn
                label="Apply"
                type="submit"
                color="primary"
                :loading="loadingPageType"
                :disable="loadingPageType || !selectedPageType"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<style lang="scss" scoped>
.bulk-actions-container {
  background-color: white;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  width: 100%;

  /* Only use fixed positioning in full-width layout */
  &.layout-full-width {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
  }
}

.actions-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  padding: 8px 16px;
}

.selection-counter {
  margin-left: auto;
  font-weight: 500;
  color: var(--q-primary);
  padding: 0 8px;
}

.page-count {
  margin-left: auto;
  padding: 0 8px;
}

/* Optimize button spacing for small screens */
@media (max-width: 599px) {
  .actions-toolbar {
    justify-content: space-between;
    padding: 8px;
  }

  /* Stack buttons if needed */
  .q-btn + .q-btn {
    margin-left: 2px;
  }
}
</style>
