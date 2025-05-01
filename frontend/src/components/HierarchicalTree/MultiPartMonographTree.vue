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
}
</style>
