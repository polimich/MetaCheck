<script setup lang="ts">
import { useCollection } from 'src/stores/data/useCollection';
import { useImageStore } from 'src/stores';
import { useLoadingState } from 'src/stores/app/loadingState';
import { useStateManager } from 'src/stores/app/stateManager';
import { checkApiHealth } from 'src/api/services';
import { onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { AppLoadingSplash } from 'src/components';
import { useRoute } from 'vue-router';

defineOptions({
  name: 'StoreInitPage',
});

// Initialize stores
const loadingState = useLoadingState();
const stateManager = useStateManager();
const collectionStore = useCollection();
const imageStore = useImageStore();
const $q = useQuasar();
const route = useRoute();

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

// Check if the stores are already initialized with the correct data
const checkStoresAlreadyInitialized = (
  collectionId: string,
  imageId?: string | null,
): boolean => {
  // Check if collection is already loaded correctly
  if (
    !collectionStore.loaded ||
    collectionStore.collection?.id !== collectionId
  ) {
    return false;
  }

  // If no image ID is requested, collection check is sufficient
  if (!imageId) {
    return true;
  }

  // Check if the requested image is already loaded - use correct property name
  return imageStore.image?.id === imageId;
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
    await Promise.all([collectionStore.init()]);

    initProgress.value = 50;
    console.log('All stores initialized');

    // Check if we have URL parameters for collection and image
    const urlCollectionId = route.params.collectionId as string;
    const urlImageId = route.params.imageId as string;

    // Use URL parameters if available, otherwise fall back to saved state
    const targetCollectionId = urlCollectionId || state.lastCollectionId;
    const targetImageId =
      urlImageId || (urlCollectionId ? null : state.lastImageId);

    // Check if stores are already initialized with the required data
    if (
      targetCollectionId &&
      checkStoresAlreadyInitialized(targetCollectionId, targetImageId)
    ) {
      console.log(
        'Stores already initialized with the required data, skipping loading',
      );
      initProgress.value = 100;
      return;
    }

    if (
      targetCollectionId &&
      stateManager.validateIds({ lastCollectionId: targetCollectionId })
    ) {
      if (urlCollectionId) {
        loadingMessage.value = 'Loading requested collection...';
      } else {
        loadingMessage.value = 'Restoring previous session...';
      }

      console.log(`Loading collection ${targetCollectionId}`);
      initProgress.value = 60;

      try {
        // 1. Load Collection
        await collectionStore.loadCollection(targetCollectionId);

        // Wait for the collection to be fully ready
        console.log('Waiting for collection to be fully ready...');
        await collectionStore.waitForCollectionReady(targetCollectionId);

        initProgress.value = 70;

        // Check if collection loaded successfully before proceeding
        if (!collectionStore.loaded || collectionStore.error) {
          throw new Error(
            `Failed to load collection ${targetCollectionId}: ${collectionStore.error || 'Unknown error'}`,
          );
        }

        // 2. Load Image (only if collection loaded and we have an image ID)
        if (targetImageId) {
          console.log(`Loading image ${targetImageId}`);

          // First, make sure the image ID is selected in the collection
          collectionStore.selectImage(targetImageId);

          // Then load the image with explicit collection ID
          await imageStore.loadImage(targetImageId, targetCollectionId);
          initProgress.value = 85;

          // Check if image loaded successfully before proceeding
          if (!imageStore.image.id || imageStore.error) {
            // Handle image loading error - Notify user, but don't stop app init completely
            console.error(
              `Error loading image ${targetImageId}: ${imageStore.error || 'Unknown error'}`,
            );
            stateManager.updateState(targetCollectionId, null); // Keep collection, clear image state
            $q.notify({
              type: 'warning',
              message: 'Could not load the requested image',
              timeout: 3000,
            });
            // Do not proceed to load detections if image failed
          } else {
            // 3. Load Detections (only if image loaded successfully)
            console.log(`Loading detections for image ${targetImageId}`);
            await imageStore.loadDetections(targetImageId);
            initProgress.value = 95;
            // Update state manager after successful image+detection load
            stateManager.updateState(targetCollectionId, targetImageId);

            // Ensure image and collection IDs are preserved in the state
            console.log(
              'Collection and image loading complete, preserving IDs in state manager',
            );
          }
        } else {
          // No image requested, just update state with collection
          stateManager.updateState(targetCollectionId, null);
        }
      } catch (error: unknown) {
        // Catch specific errors from checks above
        // Handle collection loading error or other critical errors during restore
        console.error(
          'Error loading collection or image:',
          error instanceof Error ? error.message : error,
        );

        // Don't clear state if using URL parameters - just show error and continue
        if (!urlCollectionId && !urlImageId) {
          stateManager.clearState(); // Only clear state on errors with saved state
        }

        $q.notify({
          type: 'warning',
          message: `Could not load ${urlCollectionId ? 'requested' : 'previous'} session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timeout: 3000,
        });
      }
    } else if (targetCollectionId) {
      // Invalid collection ID
      console.warn(`Invalid collection ID detected: ${targetCollectionId}`);
      stateManager.clearState();
      $q.notify({
        type: 'warning',
        message: 'Invalid collection ID detected',
        timeout: 3000,
      });
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

// Watch for route changes to load new collection/image when URL changes
watch(
  () => [route.params.collectionId, route.params.imageId],
  async ([newCollectionId, newImageId]) => {
    // Skip if app is still initializing
    if (initProgress.value < 100) {
      return;
    }

    const collectionId = newCollectionId as string;
    const imageId = newImageId as string;

    // Check if this is just an image selection change within the same collection
    const isJustImageSelectionChange =
      collectionId === collectionStore.collection?.id &&
      imageId &&
      imageId !== imageStore.image?.id;

    // If this is just switching between images in the same collection
    if (isJustImageSelectionChange) {
      console.log(
        `[StoreInit] Simple image selection change from ${imageStore.image?.id} to ${imageId}, using optimized path`,
      );

      // Check if the image is already in the collection's flattened images
      const imageExistsInCollection = collectionStore.allImagesFlattened.some(
        (img) => img.id === imageId,
      );

      if (imageExistsInCollection) {
        // Just update the selection without triggering full reloads
        collectionStore.selectImage(imageId);

        // Only load image data if not already loaded
        if (imageStore.image?.id !== imageId) {
          console.log(`[StoreInit] Loading minimal image data for ${imageId}`);
          await imageStore.loadImage(imageId, collectionId);
        }

        // Update state manager
        stateManager.updateState(collectionId, imageId);
        return;
      }
    }

    // Full loading process for collection/image changes
    if (collectionId && !checkStoresAlreadyInitialized(collectionId, imageId)) {
      console.log(
        `Route changed to collection ${collectionId}${imageId ? ` and image ${imageId}` : ''}, loading data...`,
      );

      try {
        // Load collection and wait for it to be ready
        await collectionStore.loadCollection(collectionId);
        await collectionStore.waitForCollectionReady(collectionId);

        // Update selection in both stores
        if (imageId) {
          collectionStore.selectImage(imageId);
          await imageStore.loadImage(imageId, collectionId);
        }

        // Update state manager
        stateManager.updateState(collectionId, imageId || null);
      } catch (error) {
        console.error('Error loading data after route change:', error);
        $q.notify({
          type: 'warning',
          message: 'Failed to load requested data',
          timeout: 3000,
        });
      }
    }
  },
  { immediate: false }, // Don't trigger on mount since initApplication handles that
);
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
