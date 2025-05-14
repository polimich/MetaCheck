<script setup lang="ts">
import { HierarchialTreeMonograph } from 'src/stores';
import VolumeTree from './VolumeTree.vue';

defineOptions({
  name: 'MonographTree',
});

const { tree } = defineProps<{
  tree: HierarchialTreeMonograph;
}>();
</script>

<template>
  <div class="monograph-tree">
    <VolumeTree :volume="tree" />
  </div>
</template>

<style scoped>
.monograph-tree {
  width: 100%;
  height: 100%;
  overflow: auto;
  max-height: calc(100vh - 160px);
}

/* Apply nested styling to make the tree more compact */
:deep(.volume-tree) {
  border: none !important;
  margin: 0 !important;
}

:deep(.q-expansion-item__content) {
  padding: 0 !important;
}

:deep(.q-item) {
  min-height: 32px;
  padding: 4px 8px;
}

:deep(.q-item__section--avatar) {
  min-width: 24px;
}

:deep(.field-section) {
  margin-bottom: 4px !important;
  max-height: 300px;
  overflow-y: auto;
}

:deep(.field-item) {
  padding: 2px 4px !important;
}

:deep(.confidence-chip) {
  height: 16px !important;
  font-size: 10px !important;
}
</style>
