<script setup lang="ts">
import {
  HierarchicalTree,
  isMonograph,
  isMultiPartMonograph,
  isPeriodical,
} from 'src/stores';
import MonographTree from './MonographTree.vue';
import MultiPartMonographTree from './MultiPartMonographTree.vue';
import PeriodicalTree from './PeriodicalTree.vue';
import { computed } from 'vue';

defineOptions({
  name: 'HierarchicalTree',
});

const { tree } = defineProps<{
  tree?: HierarchicalTree;
}>();

const treeType = computed(() => {
  console.log('tree', tree);
  if (!tree) return null;
  if (isMonograph(tree))
    return { label: 'Single Volume Monograph', color: 'primary', icon: 'book' };
  if (isMultiPartMonograph(tree))
    return {
      label: 'Multi-Part Monograph',
      color: 'secondary',
      icon: 'library_books',
    };
  if (isPeriodical(tree))
    return { label: 'Periodical', color: 'accent', icon: 'newspaper' };
  return { label: 'Unknown Type', color: 'grey', icon: 'help' };
});
</script>

<template>
  <q-card flat bordered class="hierarchical-tree q-pa-md">
    <!-- Type indicator -->
    <div class="type-indicator q-mb-md" v-if="tree">
      <q-chip
        :color="treeType?.color"
        text-color="white"
        :icon="treeType?.icon"
        size="md"
      >
        {{ treeType?.label }}
      </q-chip>
    </div>

    <!-- Loading state -->
    <div v-if="!tree" class="text-center q-pa-md">
      <q-spinner color="primary" size="2em" />
      <div class="text-grey q-mt-sm">Loading tree data...</div>
    </div>

    <!-- Tree content -->
    <div v-else class="tree-content">
      <template v-if="isMonograph(tree)">
        <MonographTree :tree="tree" />
      </template>

      <template v-else-if="isMultiPartMonograph(tree)">
        <MultiPartMonographTree :tree="tree" />
      </template>

      <template v-else-if="isPeriodical(tree)">
        <PeriodicalTree :tree="tree" />
      </template>

      <template v-else>
        <q-banner class="bg-warning text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="warning" />
          </template>
          Unknown tree type
        </q-banner>
      </template>
    </div>
  </q-card>
</template>

<style scoped>
.hierarchical-tree {
  max-width: 1200px;
  margin: 0 auto;
}

.type-indicator {
  display: flex;
  justify-content: center;
}

.tree-content {
  margin-top: 1rem;
}
</style>
