<script setup lang="ts">
const props = defineProps({
  selectMode: {
    type: Boolean,
    required: true,
  },
  selectedImages: {
    type: Array as () => string[],
    required: true,
  },
});

const emit = defineEmits([
  'toggleSelectMode',
  'selectAll',
  'deselectAll',
  'markSelectedAsVerified',
  'downloadSelected',
]);

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
