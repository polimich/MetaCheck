<script setup lang="ts">
import { ref } from 'vue';

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
});

const emit = defineEmits([
  'toggleSelectMode',
  'selectAll',
  'deselectAll',
  'markSelectedAsVerified',
  'downloadSelected',
  'changePageIndices',
  'changePageType',
]);

// Dialog states
const indexDialogOpen = ref(false);
const pageTypeDialogOpen = ref(false);

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
const selectedPageType = ref('');

// Form submission handlers
const submitPageIndexChange = () => {
  emit('changePageIndices', {
    prefix: pageIndexForm.value.prefix,
    suffix: pageIndexForm.value.suffix,
    startNumber: pageIndexForm.value.startNumber,
    endNumber: pageIndexForm.value.endNumber || props.selectedImages.length,
    step: pageIndexForm.value.step,
    pagesPerImage: pageIndexForm.value.pagesPerImage,
  });
  indexDialogOpen.value = false;
};

const submitPageTypeChange = () => {
  emit('changePageType', selectedPageType.value);
  pageTypeDialogOpen.value = false;
};

// Using props directly to avoid linter errors
console.log('Select mode is:', props.selectMode);
</script>

<template>
  <div class="bulk-actions-container">
    <div class="actions-toolbar q-px-md q-py-sm">
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

        <!-- New action: Change page index -->
        <q-btn
          flat
          round
          icon="123"
          color="primary"
          @click="indexDialogOpen = true"
        >
          <q-tooltip>Change page indices</q-tooltip>
        </q-btn>

        <!-- New action: Change page type -->
        <q-btn
          flat
          round
          icon="category"
          color="primary"
          @click="pageTypeDialogOpen = true"
        >
          <q-tooltip>Change page type</q-tooltip>
        </q-btn>
      </template>

      <!-- Selection counter -->
      <div v-if="selectedImages.length > 0" class="selection-counter q-mx-sm">
        {{ selectedImages.length }} selected
      </div>

      <!-- Show page count when no selection -->
      <div v-else class="page-count q-mx-sm text-caption text-grey">
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
          <q-form @submit="submitPageIndexChange">
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
              <q-btn label="Apply" type="submit" color="primary" />
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
          <q-form @submit="submitPageTypeChange">
            <q-select
              v-model="selectedPageType"
              :options="pageTypes"
              label="Page Type"
              outlined
              dense
              emit-value
              map-options
              :rules="[(val) => !!val || 'Please select a page type']"
            />

            <div class="row q-mt-md">
              <q-space />
              <q-btn label="Cancel" color="grey" flat v-close-popup />
              <q-btn label="Apply" type="submit" color="primary" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<style lang="scss" scoped>
.bulk-actions-container {
  position: sticky;
  bottom: 0;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.95);
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.actions-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.selection-counter {
  margin-left: auto;
  font-weight: 500;
  color: var(--q-primary);
}

.page-count {
  margin-left: auto;
}
</style>
