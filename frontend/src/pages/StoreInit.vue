<script setup lang="ts">
import { useImageStore } from 'src/stores';
import { useCollectionDataAccess } from 'stores/data-access';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useCollectionStore } from 'stores/collection';
import { useLoadingState } from 'src/stores/app/loadingState';
import { useStateManager } from 'src/stores/app/stateManager';
import { checkApiHealth } from 'src/api/services';
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';

defineOptions({
  name: 'StoreInitPage',
});

// Initialize all stores
const loadingState = useLoadingState();
const stateManager = useStateManager();
const imageStore = useImageStore();
const collectionDA = useCollectionDataAccess();
const currentCollection = useCurrentCollectionState();
const collectionStore = useCollectionStore();
const $q = useQuasar();

// State for connection status
const connectionError = ref('');
const retryCount = ref(0);
const maxRetries = 3;

// Function to check API health with retries
const checkConnection = async (): Promise<boolean> => {
  while (retryCount.value < maxRetries) {
    const { isHealthy, error } = await checkApiHealth();
    if (isHealthy) {
      connectionError.value = '';
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

  // Show error notification after all retries failed
  $q.notify({
    type: 'negative',
    message:
      'Unable to connect to the server. Please check if the backend is running.',
    timeout: 0,
    actions: [
      {
        label: 'Retry',
        color: 'white',
        handler: () => {
          retryCount.value = 0;
          stateManager.clearState(); // Clear state on connection errors
          window.location.reload();
        },
      },
    ],
  });

  return false;
};

// Perform initialization tasks
onMounted(async () => {
  console.log('Initializing application stores...');

  // Start loading
  loadingState.startLoading('appInit', 'Checking server connection...');

  try {
    // First check API health
    if (!(await checkConnection())) {
      return; // Stop initialization if connection fails
    }

    loadingState.startLoading('appInit', 'Initializing application...');

    // Initialize state manager first (centralizes state)
    const state = stateManager.init();

    // Initialize all stores without loading data yet
    await Promise.all([
      collectionDA.init(),
      collectionStore.init(),
      currentCollection.init(),
      imageStore.init(),
    ]);

    console.log('All stores initialized');

    // Check if we need to restore any state - now using centralized state manager
    if (state.lastCollectionId && stateManager.stateValid) {
      loadingState.startLoading(
        'stateRestore',
        'Restoring previous session...',
      );
      console.log(`Restoring collection ${state.lastCollectionId}`);

      try {
        await currentCollection.loadCollection(state.lastCollectionId);

        // Only try to load image if collection loaded successfully
        if (state.lastImageId && currentCollection.loaded) {
          console.log(`Restoring image ${state.lastImageId}`);

          try {
            await imageStore.loadImage(
              state.lastImageId,
              state.lastCollectionId,
            );

            if (imageStore.image.id) {
              console.log(
                `Restoring detections for image ${state.lastImageId}`,
              );
              await imageStore.loadDetections(state.lastImageId);

              // Update state manager with successful load
              stateManager.updateState(
                state.lastCollectionId,
                state.lastImageId,
              );
            }
          } catch (error) {
            // Handle image loading error
            console.error('Error loading image:', error);

            // Since image failed but collection is ok, keep collection but clear image
            stateManager.updateState(state.lastCollectionId, null);
            $q.notify({
              type: 'warning',
              message: 'Could not restore previous image',
              timeout: 3000,
            });
          }
        }
      } catch (error) {
        // Handle collection loading error
        console.error('Error loading collection:', error);
        stateManager.clearState(); // Clear state on critical errors
        $q.notify({
          type: 'warning',
          message: 'Could not restore previous session',
          timeout: 3000,
        });
      } finally {
        loadingState.stopLoading('stateRestore');
      }
    }
  } catch (error) {
    console.error('Error during store initialization:', error);
    stateManager.handleError(error, 'Error initializing application');
    $q.notify({
      type: 'negative',
      message: 'Error initializing application. Please refresh the page.',
      timeout: 0,
      actions: [
        {
          label: 'Refresh',
          color: 'white',
          handler: () => {
            stateManager.clearState(); // Clear state on critical errors
            window.location.reload();
          },
        },
      ],
    });
  } finally {
    loadingState.stopLoading('appInit');
    console.log('Application stores initialization complete');
  }
});
</script>

<template>
  <div>
    <div v-if="loadingState.isLoading" class="store-init-loading">
      <q-spinner color="primary" size="3em" />
      <div class="q-mt-sm">{{ loadingState.currentLoadingMessage }}</div>
      <div v-if="connectionError" class="q-mt-sm text-negative">
        {{ connectionError }}
      </div>
      <div v-if="stateManager.stateError" class="q-mt-sm text-warning">
        {{ stateManager.stateError }}
      </div>
    </div>
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
