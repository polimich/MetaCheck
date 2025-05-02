<script setup lang="ts">
import { useCollections, useImageStore } from 'src/stores';
import { useCollectionDataAccess, useDataAccess } from 'stores/data-access';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useLoadingState } from 'src/stores/app/loadingState';
import { useStateManager } from 'src/stores/app/stateManager';
import { checkApiHealth } from 'src/api/services';
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { AppLoadingSplash } from 'src/components';

defineOptions({
  name: 'StoreInitPage',
});

// Initialize stores
const loadingState = useLoadingState();
const stateManager = useStateManager();
const collectionsStore = useCollections();
const $q = useQuasar();

// State for connection status
const connectionError = ref('');
const retryCount = ref(0);
const maxRetries = 3;
const showRetry = ref(false);
const initProgress = ref(0);
const loadingMessage = ref('Initializing application...');

// Function to check API health with retries
const checkConnection = async (): Promise<boolean> => {
  loadingMessage.value = 'Checking server connection...';
  initProgress.value = 10;

  while (retryCount.value < maxRetries) {
    const { isHealthy, error } = await checkApiHealth();
    if (isHealthy) {
      connectionError.value = '';
      initProgress.value = 20;
      return true;
    }

    retryCount.value++;
    connectionError.value = `Connection attempt ${retryCount.value}/${maxRetries} failed: ${error}`;
    console.warn(connectionError.value);

    if (retryCount.value < maxRetries) {
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, retryCount.value - 1)),
      );
    }
  }

  // Show retry button after all retries failed
  showRetry.value = true;
  return false;
};

// Retry initialization
const handleRetry = () => {
  retryCount.value = 0;
  connectionError.value = '';
  showRetry.value = false;
  stateManager.clearState(); // Clear state on connection errors
  initApplication();
};

// Perform initialization tasks
const initApplication = async () => {
  console.log('Initializing application stores...');
  initProgress.value = 0;
  loadingMessage.value = 'Initializing application...';

  try {
    // First check API health
    if (!(await checkConnection())) {
      return; // Stop initialization if connection fails
    }

    loadingMessage.value = 'Starting application...';
    initProgress.value = 30;

    // Initialize state manager first (centralizes state)
    const state = stateManager.init();
    initProgress.value = 40;

    // Initialize all stores without loading data yet
    await Promise.all([collectionsStore.init()]);

    initProgress.value = 50;
    console.log('All stores initialized');

    // Check if we need to restore any state - now using centralized state manager
    if (state.lastCollectionId && stateManager.stateValid) {
      loadingMessage.value = 'Restoring previous session...';
      console.log(`Restoring collection ${state.lastCollectionId}`);
      initProgress.value = 60;

      try {
        // 1. Load Collection
        await currentCollection.loadCollection(state.lastCollectionId);
        initProgress.value = 70;

        // Check if collection loaded successfully before proceeding
        if (!currentCollection.loaded || currentCollection.error) {
          throw new Error(
            `Failed to load collection ${state.lastCollectionId}: ${currentCollection.error || 'Unknown error'}`,
          );
        }

        // 2. Load Image (only if collection loaded and we have an image ID)
        if (state.lastImageId) {
          console.log(`Restoring image ${state.lastImageId}`);
          await imageStore.loadImage(state.lastImageId, state.lastCollectionId);
          initProgress.value = 85;

          // Check if image loaded successfully before proceeding
          if (!imageStore.image.id || imageStore.error) {
            // Handle image loading error - Notify user, but don't stop app init completely
            console.error(
              `Error loading image ${state.lastImageId}: ${imageStore.error || 'Unknown error'}`,
            );
            stateManager.updateState(state.lastCollectionId, null); // Keep collection, clear image state
            $q.notify({
              type: 'warning',
              message: 'Could not restore previous image',
              timeout: 3000,
            });
            // Do not proceed to load detections if image failed
          } else {
            // 3. Load Detections (only if image loaded successfully)
            console.log(`Restoring detections for image ${state.lastImageId}`);
            await imageStore.loadDetections(state.lastImageId);
            initProgress.value = 95;
            // Update state manager only after successful image+detection load
            stateManager.updateState(state.lastCollectionId, state.lastImageId);
          }
        }
      } catch (error: unknown) {
        // Catch specific errors from checks above
        // Handle collection loading error or other critical errors during restore
        console.error(
          'Error restoring session:',
          error instanceof Error ? error.message : error,
        );
        stateManager.clearState(); // Clear state on critical errors
        $q.notify({
          type: 'warning',
          message: `Could not restore previous session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timeout: 3000,
        });
      }
    }

    // Set progress to 100% after completion
    initProgress.value = 100;
  } catch (error) {
    console.error('Error during store initialization:', error);
    stateManager.handleError(error, 'Error initializing application');
    connectionError.value =
      'Error initializing application. Please refresh the page.';
    showRetry.value = true;
  } finally {
    loadingState.stopLoading('appInit');
    console.log('Application stores initialization complete');
  }
};

onMounted(initApplication);
</script>

<template>
  <div>
    <AppLoadingSplash
      v-if="initProgress < 100"
      :message="loadingMessage"
      :error="connectionError"
      :progress="initProgress"
      :show-retry="showRetry"
      @retry="handleRetry"
    />
  </div>
</template>

<style scoped>
.store-init-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  z-index: 9999;
}
</style>
