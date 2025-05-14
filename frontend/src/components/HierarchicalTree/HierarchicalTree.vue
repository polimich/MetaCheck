<!--
@author Michael Polívka (xpoliv07)
-->
<script setup lang="ts">
import {
  HierarchicalTree,
  isMonograph,
  isMultiPartMonograph,
  useHierarchicalTree,
} from 'src/stores';
import { computed, watch, onMounted } from 'vue';
import MonographTree from './MonographTree.vue';
import MultiPartMonographTree from './MultiPartMonographTree.vue';
import { useCollection } from 'src/stores/data/useCollection';
import { storeToRefs } from 'pinia';

defineOptions({
  name: 'HierarchicalTree',
});

const props = defineProps<{
  tree?: HierarchicalTree;
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

// Get references to our stores
const collectionStore = useCollection();
const { collection } = storeToRefs(collectionStore);

const hierarchicalTreeStore = useHierarchicalTree();
const { tree: storeTree, loading, error } = storeToRefs(hierarchicalTreeStore);

// If a tree prop is passed, use that, otherwise use the store
const activeTree = computed(() => props.tree || storeTree.value);

onMounted(() => {
  if (collection.value?.id && !storeTree.value) {
    hierarchicalTreeStore.loadHierarchicalTree(collection.value.id);
  }

  const treeContainer = document.querySelector('.hierarchical-tree');
  if (treeContainer) {
    treeContainer.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const clickableItem = target.closest('.clickable-item');

      if (clickableItem) {
        emit('click', event as MouseEvent);
      }
    });
  }
});

watch(
  () => collection.value?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      hierarchicalTreeStore.loadHierarchicalTree(newId);
    }
  },
);

// Determine tree type for better rendering decisions
const treeType = computed(() => {
  if (loading.value) return 'loading';
  if (error.value) return 'error';
  if (!activeTree.value) return 'loading';

  if (isMonograph(activeTree.value)) return 'monograph';
  if (isMultiPartMonograph(activeTree.value)) return 'multiPartMonograph';
  return 'unknown';
});
</script>

<template>
  <div class="hierarchical-tree">
    <!-- Loading state -->
    <div
      v-if="treeType === 'loading'"
      class="text-center q-pa-sm full-height flex flex-center column"
    >
      <q-spinner color="primary" size="1.5em" />
      <div class="text-grey text-caption q-mt-xs">Loading...</div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="treeType === 'error'"
      class="text-center q-pa-sm full-height flex flex-center column"
    >
      <q-icon name="error" color="negative" size="1.5em" />
      <div class="text-negative text-caption q-mt-xs">{{ error }}</div>
    </div>

    <!-- Tree content -->
    <div v-else class="tree-content">
      <MonographTree
        v-if="treeType === 'monograph' && activeTree"
        :tree="activeTree"
        @click="emit('click', $event)"
      />

      <MultiPartMonographTree
        v-else-if="treeType === 'multiPartMonograph' && activeTree"
        :tree="activeTree"
        @click="emit('click', $event)"
      />

      <q-banner v-else class="bg-warning text-white text-caption" dense>
        <template v-slot:avatar>
          <q-icon name="warning" size="xs" />
        </template>
        {{
          activeTree
            ? `Unknown tree type: ${activeTree.type}`
            : 'No tree data available'
        }}
      </q-banner>
    </div>
  </div>
</template>

<style scoped>
.hierarchical-tree {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0.25rem;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
  max-height: calc(
    100vh - 150px
  ); /* Set maximum height with space for headers */
}

/* Ensure responsive behavior in narrow containers */
:deep(.q-tree),
:deep(.q-list) {
  width: 100%;
}

:deep(.q-tree__node-header),
:deep(.q-expansion-item__content .q-item) {
  padding: 2px 4px;
  min-height: 28px;
}

:deep(.q-tree__node-body),
:deep(.field-section) {
  padding-left: 20px;
}

:deep(.q-tree__children),
:deep(.q-expansion-item__content) {
  padding-left: 8px;
}

:deep(.q-tree__node--child) {
  padding-left: 0;
}

/* Tighter spacing for nodes */
:deep(.q-tree__node),
:deep(.field-item) {
  margin-top: 1px;
  margin-bottom: 1px;
}

/* Critical/Warning highlighting */
:deep(.critical-header) {
  border-left: 3px solid var(--q-negative);
  background-color: rgba(255, 0, 0, 0.05);
}

:deep(.warning-header) {
  border-left: 3px solid var(--q-warning);
  background-color: rgba(255, 186, 0, 0.05);
}

:deep(.inactive-field) {
  opacity: 0.7;
}

:deep(.q-expansion-item__content) {
  padding: 0;
}

:deep(.clickable) {
  cursor: pointer;
}
</style>
