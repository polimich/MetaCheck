<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { ref, watch, onMounted } from 'vue';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useLoadingState } from 'src/stores/app/loadingState';
import { PageList } from 'components';
import { useCollection } from 'src/stores/data/useCollection';

// Define view mode type to match what PageList expects
type ViewMode = 'grid' | 'list-small' | 'list-large';

defineOptions({
  name: 'CollectionDetailPage',
});

const route = useRoute();
const router = useRouter();
const currentCollection = useCurrentCollectionState();
const collectionStore = useCollection(); // Add the hierarchical collection store
const loadingState = useLoadingState();
const collectionId = ref(route.params.collectionId as string);

// Register this component with the loading state
const componentId = 'collectionDetail_' + collectionId.value;

// View mode management - ensure it's properly typed
const savedMode = localStorage.getItem('collection-view-mode');
const defaultMode: ViewMode = 'grid';
const viewMode = ref<ViewMode>(
  savedMode === 'grid' ||
    savedMode === 'list-small' ||
    savedMode === 'list-large'
    ? (savedMode as ViewMode)
    : defaultMode,
);

// Load the collection when component is mounted
onMounted(async () => {
  await loadCurrentCollection();
});

// Watch for route changes to reload data when navigating between collections
watch(
  () => route.params.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== collectionId.value) {
      collectionId.value = newCollectionId as string;
      await loadCurrentCollection();
    }
  },
);

// Function to load the current collection
const loadCurrentCollection = async () => {
  loadingState.setComponentLoading(componentId, true);

  try {
    // Load both the flat view collection data and the hierarchical collection data
    const [standardResult, hierarchicalResult] = await Promise.all([
      currentCollection.loadCollection(collectionId.value),
      collectionStore.loadCollection(collectionId.value),
    ]);

    console.log('Loaded standard collection:', standardResult);
    console.log('Loaded hierarchical collection:', hierarchicalResult);

    // Log detailed information about the hierarchical structure
    if (collectionStore.collection?.global_structure) {
      console.log('Global structure found');
      console.log(
        'Global structure ID:',
        collectionStore.collection.global_structure.id,
      );

      if (collectionStore.collection.global_structure.children) {
        console.log(
          'Children count:',
          collectionStore.collection.global_structure.children.length,
        );
        console.log(
          'First child:',
          collectionStore.collection.global_structure.children[0],
        );
      } else {
        console.log('No children in global structure');
      }
    } else {
      console.log('No global structure in collection');
    }

    // Log meta elements sections
    console.log(
      'Hierarchical meta elements:',
      collectionStore.metaElementSections.length,
    );
  } catch (error) {
    console.error('Error loading collection:', error);
  } finally {
    loadingState.setComponentLoading(componentId, false);
  }
};

// Handle image selection
const handleSelectImage = (imageId: string) => {
  router.push({
    name: 'image',
    params: {
      imageId,
      collectionId: collectionId.value,
    },
  });
};

// Handle view mode changes with string parameter type to match PageList emit type
// We'll validate and cast the string to our ViewMode type internally
const handleViewModeChange = (newMode: string) => {
  // Only update if it's a valid view mode
  if (
    newMode === 'grid' ||
    newMode === 'list-small' ||
    newMode === 'list-large'
  ) {
    viewMode.value = newMode as ViewMode;
    localStorage.setItem('collection-view-mode', newMode);
  }
};
</script>

<template>
  <q-page class="collection-page">
    <!-- Collection Header -->
    <div class="collection-header q-pa-md">
      <div class="row items-center justify-between">
        <div class="col-auto">
          <div class="text-h5">
            {{ currentCollection.collection?.name || 'Collection' }}
          </div>
          <div class="text-caption text-grey-7">
            {{ currentCollection.collection?.images?.length || 0 }} images
          </div>
        </div>
        <div class="col-auto">
          <q-btn color="primary" icon="add" label="Add Images" />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="loadingState.isComponentLoading(componentId)"
      class="loading-state q-pa-md"
    >
      <div class="text-h6 q-mb-md">Loading Collection...</div>
      <div class="row q-col-gutter-md">
        <div v-for="n in 8" :key="n" class="col-xs-12 col-sm-6 col-md-3">
          <q-card bordered>
            <q-skeleton height="200px" square />
            <q-card-section>
              <q-skeleton type="text" />
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Page List Component -->
    <PageList
      v-else
      :collectionId="collectionId"
      layout="full-width"
      :initialViewMode="viewMode"
      :initialHierarchicalMode="true"
      :showHeader="true"
      :showStatistics="true"
      :enableBulkActions="true"
      @select-image="handleSelectImage"
      @view-mode-change="handleViewModeChange"
    />
  </q-page>
</template>

<style lang="scss" scoped>
.collection-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 50px);
  position: relative;
  overflow: hidden;
}

.collection-header {
  background-color: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 10;
  flex-shrink: 0;
}

.loading-state {
  flex: 1;
  overflow: auto;
}

/* Make sure PageList takes up the full available space */
:deep(.page-list-wrapper) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
