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
    <VolumeTree :tree="tree" />
  </div>
</template>

<style scoped>
.monograph-tree {
  width: 100%;
}
</style>
