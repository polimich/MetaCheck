<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCollection } from 'src/stores/data/useCollection';
import { useImage } from 'src/stores/data/useImage';
import { useLoadingState } from 'src/stores/app/loadingState';

defineOptions({
  name: 'MainLayout',
});

const router = useRouter();
const route = useRoute();
const collectionStore = useCollection();
const imageStore = useImage();
const loadingState = useLoadingState();

// Determine current route
const isOnImageDetailPage = computed(() => route.name === 'image');
const isOnCollectionPage = computed(() => route.name === 'collection');
const isOnCollectionsPage = computed(() => route.name === 'collections');

// Get collection and image data for breadcrumbs
const currentCollectionId = computed(
  () => (route.params.collectionId as string) || null,
);

const currentCollectionName = computed(
  () => collectionStore.collection?.name || 'Collection',
);

const currentImageName = computed(() => imageStore.image?.name || 'Image');

// Navigation functions
function navigateToCollections() {
  if (!isOnCollectionsPage.value) {
    // Check if we're already in a navigating state
    if (
      loadingState.currentOperation &&
      loadingState.currentOperation.startsWith('navigating')
    ) {
      console.log('Navigation already in progress, ignoring request');
      return;
    }

    // Show loading state for collections navigation
    loadingState.startLoading(
      'navigatingToCollections',
      'Loading collections...',
    );

    // Add a slight delay to ensure loading state is displayed
    setTimeout(() => {
      router
        .push('/collections')
        .then(() => {
          // Give time for router afterEach to handle this
          setTimeout(() => {
            // Fallback in case the router's afterEach doesn't handle it
            if (loadingState.currentOperation === 'navigatingToCollections') {
              console.log('Fallback: manually stopping navigation loading');
              loadingState.stopLoading('navigatingToCollections');
            }
          }, 1500);
        })
        .catch((error) => {
          console.error('Navigation error:', error);
          loadingState.stopLoading('navigatingToCollections');
        });
    }, 100);
  }
}

function navigateToCollection() {
  if (!isOnCollectionPage.value && currentCollectionId.value) {
    // Show loading state for collection navigation
    loadingState.startLoading(
      'navigatingToCollection',
      'Loading collection...',
    );

    // Add a slight delay to ensure loading state is displayed
    setTimeout(() => {
      router
        .push({
          name: 'collection',
          params: { collectionId: currentCollectionId.value },
        })
        .catch((error) => {
          console.error('Navigation error:', error);
          loadingState.stopLoading('navigatingToCollection');
        });
    }, 100);
  }
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <div class="app-title">MetaCheck</div>

        <!-- Navigation with breadcrumb style -->
        <div class="navigation-container">
          <!-- Collections (first level) -->
          <q-btn
            flat
            no-caps
            :class="{ 'current-page': isOnCollectionsPage }"
            :disable="isOnCollectionsPage"
            @click="navigateToCollections"
          >
            Collections
          </q-btn>

          <!-- Separator -->
          <q-icon
            v-if="isOnCollectionPage || isOnImageDetailPage"
            name="chevron_right"
            size="1.2em"
            class="q-mx-xs"
          />

          <!-- Collection level -->
          <q-btn
            v-if="isOnCollectionPage || isOnImageDetailPage"
            flat
            no-caps
            :class="{ 'current-page': isOnCollectionPage }"
            :disable="isOnCollectionPage"
            @click="navigateToCollection"
          >
            {{ 'Collection: ' + currentCollectionName }}
          </q-btn>

          <!-- Separator -->
          <q-icon
            v-if="isOnImageDetailPage"
            name="chevron_right"
            size="1.2em"
            class="q-mx-xs"
          />

          <!-- Image level -->
          <q-btn
            v-if="isOnImageDetailPage"
            flat
            no-caps
            class="current-page"
            disable
          >
            {{ 'Image: ' + currentImageName }}
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.app-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin-right: 24px;
  white-space: nowrap;
}

.navigation-container {
  display: flex;
  align-items: center;
}

/* Style for current page */
.current-page {
  font-weight: bold;
  color: white !important;
  opacity: 1 !important;
}

/* Make disabled buttons visible but non-clickable */
:deep(.q-btn--disable) {
  opacity: 1 !important;
}
</style>
