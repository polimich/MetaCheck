<script setup lang="ts">
import { useHierarchicalTree } from 'src/stores';
import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { HierarchicalTree } from 'src/components';
defineOptions({
  name: 'DevPage',
});

const route = useRoute();
const hierarchicalTree = useHierarchicalTree();

async function loadDataAccess() {
  const collectionId = route.params.collectionId as string;
  if (collectionId) {
  }
}

onMounted(() => {
  loadDataAccess();
});

watch(
  () => route.params.collectionId,
  async () => {
    loadDataAccess();
  },
);
</script>

<template>
  <div class="dev-page">
    <h1>Dev Page</h1>
    <HierarchicalTree :tree="hierarchicalTree.tree" />
  </div>
</template>
