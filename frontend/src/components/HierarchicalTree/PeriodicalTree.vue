<script setup lang="ts">
import { HierarchialTreePeriodicalType } from 'src/stores';
import TitleTree from './TitleTree.vue';

defineOptions({
  name: 'PeriodicalTree',
});

const { tree } = defineProps<{
  tree: HierarchialTreePeriodicalType;
}>();
</script>

<template>
  <div class="periodical-tree">
    <TitleTree :tree="tree" />
  </div>
</template>

<style scoped>
.periodical-tree {
  width: 100%;
}
</style>
