<script setup lang="ts">
import { HierarchialTreeMultiPartMonograph } from 'src/stores';
import TitleTree from './TitleTree.vue';

defineOptions({
  name: 'MultiPartMonographTree',
});

const { tree } = defineProps<{
  tree: HierarchialTreeMultiPartMonograph;
}>();
</script>

<template>
  <div class="multi-part-tree">
    <TitleTree :tree="tree" />
  </div>
</template>

<style scoped>
.multi-part-tree {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
  max-height: calc(100vh - 160px);
}

/* Apply nested styling to make the tree more compact */
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

:deep(.q-item__section--side) {
  padding-left: 8px;
}

:deep(.q-icon) {
  font-size: 1rem;
}

:deep(.q-item__label) {
  font-size: 0.85rem;
  line-height: 1.2;
}

:deep(.q-item__label--caption) {
  font-size: 0.75rem;
}

/* Preserve colors while making them subtler */
:deep(.text-negative) {
  color: var(--q-negative) !important;
  opacity: 0.9;
}

:deep(.text-warning) {
  color: var(--q-warning) !important;
  opacity: 0.9;
}

:deep(.text-positive) {
  color: var(--q-positive) !important;
  opacity: 0.9;
}

/* Field styling */
:deep(.field-section) {
  margin-bottom: 4px !important;
  max-height: 300px;
  overflow-y: auto;
}

:deep(.field-item) {
  padding: 2px 4px !important;
}

:deep(.field-value) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.confidence-chip) {
  height: 16px !important;
  font-size: 10px !important;
}

/* Support for our new structure */
:deep(.title-header),
:deep(.volume-header) {
  padding: 4px !important;
  margin-bottom: 4px !important;
  position: sticky;
  top: 0;
  z-index: 5;
  background-color: white;
}

/* Ensure tree sections are compact */
:deep(.q-tree__node) {
  margin-top: 0;
  margin-bottom: 0;
}

:deep(.q-tree__node-header) {
  min-height: 28px;
  padding: 2px 4px;
}

:deep(.q-tree__children) {
  padding-left: 16px;
}

:deep(.q-tree__node-body) {
  padding-left: 20px;
}
</style>
