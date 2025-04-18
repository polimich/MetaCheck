<script setup lang="ts">
import { AnnotationList, PageList, ImageAnnotator } from 'components';
import { useRoute, useRouter } from 'vue-router';
import { ref, onMounted, watch, computed } from 'vue';
import { useImageStore } from 'src/stores';
import { useMetaRoleStore } from 'src/stores/meta-role-store';
import {
  useLoadingState,
  useStateManager,
  useNotificationStore,
} from 'src/stores';
import { useCurrentCollectionState } from 'src/stores/frontend-state';
import { DetectionState } from 'src/types';
import { useSynchronization } from 'src/components/ImageAnnotator/composables/useSynchronization';
import { ANNOTATION_EVENTS, IMAGE_EVENTS } from 'src/constants/events';

// Define the interface for the ImageAnnotator instance
interface ImageAnnotatorInstance {
  handleSelectAnnotation: (id: string, shift?: boolean) => void;
  scrollToAnnotation: (detection: DetectionState) => void;
}

defineOptions({
  name: 'ImageDetailPage',
});

// Setup stores and route
const route = useRoute();
const router = useRouter();
const collectionId = ref(route.params.collectionId as string);
const imageStore = useImageStore();
const metaRoleStore = useMetaRoleStore();
const loadingState = useLoadingState();
const stateManager = useStateManager();
const notificationStore = useNotificationStore();
const currentCollection = useCurrentCollectionState();

// Use the synchronization composable
const synchronization = useSynchronization();

// Computed properties
const detections = computed(() => imageStore.detectionsGetter);
const loadingMessage = computed(() => loadingState.currentLoadingMessage);

// Component ID for loading state
const componentId = computed(() => {
  const currentImageId = currentCollection.selectedImageId;
  return `annotator_${currentImageId}`;
});

// Use both route params and store state for the imageId
const imageId = computed({
  get: () => currentCollection.selectedImageId,
  set: (value: string) => {
    // Update collection state
    currentCollection.selectImage(value);

    // Update route if different from current route params
    if (value !== route.params.imageId) {
      router.push({
        name: route.name as string,
        params: {
          ...route.params,
          imageId: value,
        },
      });
    }
  },
});

// Refs for component instances - properly typed now
const annotatorRef = ref<ImageAnnotatorInstance | null>(null);

// Set the annotator ref in the synchronization composable once it's mounted
watch(annotatorRef, (newRef) => {
  if (newRef) {
    synchronization.setAnnotatorRef(newRef);
  }
});

// Load image and detections when component mounts
onMounted(async () => {
  if (collectionId.value) {
    console.log(`Component mounted, loading collection ${collectionId.value}`);

    // Validate collection ID
    if (!stateManager.validateIds({ lastCollectionId: collectionId.value })) {
      notificationStore.error('Invalid collection ID');
      return;
    }

    // First load the collection
    await currentCollection.loadCollection(collectionId.value);

    // If imageId is provided in route, select that image
    const routeImageId = route.params.imageId as string;
    if (routeImageId) {
      currentCollection.selectImage(routeImageId);
      await loadImageData();
    }
  } else {
    notificationStore.error('Missing required parameters');
    console.error('Missing required route parameter: collectionId');
  }
});

// Watch for route changes
watch(
  () => route.params.imageId,
  async (newImageId) => {
    if (newImageId && newImageId !== imageId.value) {
      console.log(`Route image ID changed to ${newImageId}`);
      currentCollection.selectImage(newImageId as string);
      await loadImageData();
    }
  },
);

watch(
  () => route.params.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== collectionId.value) {
      console.log(`Collection ID changed to ${newCollectionId}`);
      collectionId.value = newCollectionId as string;

      // Load the new collection
      await currentCollection.loadCollection(collectionId.value);

      // If route has imageId, select that image in the new collection
      const routeImageId = route.params.imageId as string;
      if (routeImageId) {
        currentCollection.selectImage(routeImageId);
        await loadImageData();
      }
    }
  },
);

// Also watch for changes to the selectedImageId in store
watch(
  () => currentCollection.selectedImageId,
  async (newImageId, oldImageId) => {
    if (newImageId && newImageId !== oldImageId) {
      console.log(`Selected image changed in store to ${newImageId}`);

      // Update route if needed
      if (newImageId !== route.params.imageId) {
        router.push({
          name: route.name as string,
          params: {
            ...route.params,
            imageId: newImageId,
          },
        });
      }

      // Load the image data
      await loadImageData();
    }
  },
);

// Function to load image data
const loadImageData = async () => {
  const currentImageId = currentCollection.selectedImageId;
  if (!currentImageId) {
    console.log('No image selected, skipping load');
    return;
  }

  // Check if the specific image we want is already the current one in the store
  // and if its detections are loaded (indicated by isLoaded computed property)
  if (imageStore.image.id === currentImageId && imageStore.isLoaded) {
    console.log(
      `Image ${currentImageId} is already loaded in the store, skipping redundant load.`,
    );
    // Ensure state manager is updated if somehow missed during init
    if (stateManager.lastImageId !== currentImageId) {
      stateManager.updateState(collectionId.value, currentImageId);
    }
    return;
  }

  // Set component-specific loading states
  loadingState.setComponentLoading(`annotator_${currentImageId}`, true);
  loadingState.setComponentLoading(`annotationList_${currentImageId}`, true);

  try {
    console.log(
      `Loading image ${currentImageId} from collection ${collectionId.value}`,
    );

    // First load the image data
    await imageStore.loadImage(currentImageId, collectionId.value);

    // Then load the detections
    if (imageStore.image.id) {
      // Use component loading instead of global loading
      await imageStore.loadDetections(currentImageId);

      if (imageStore.detections.length === 0) {
        console.warn('No detections found for this image');
        notificationStore.warning('No annotations found for this image');
      } else {
        console.log(
          `Successfully loaded ${imageStore.detections.length} detections`,
        );
        notificationStore.success(
          `Loaded ${imageStore.detections.length} annotations`,
        );
      }
    } else {
      throw new Error('Image not loaded correctly');
    }

    // Ensure meta roles are loaded
    if (!metaRoleStore.loaded) {
      // Use component-specific loading
      loadingState.setComponentLoading(`metaRoles_${currentImageId}`, true);
      await metaRoleStore.loadMetaRoles();
      loadingState.setComponentLoading(`metaRoles_${currentImageId}`, false);
    }

    console.log(`Loaded ${imageStore.detections.length} detections`);

    // Update state manager
    stateManager.updateState(collectionId.value, currentImageId);
  } catch (error) {
    console.error('Error loading image data:', error);
    stateManager.handleError(error, 'Error loading image data');
    notificationStore.error('Error loading image data');
    loadingState.startLoading('criticalError', 'Error loading image data');
    setTimeout(() => loadingState.stopLoading('criticalError'), 2000);
  } finally {
    // Clear component-specific loading states
    loadingState.setComponentLoading(`annotator_${currentImageId}`, false);
    loadingState.setComponentLoading(`annotationList_${currentImageId}`, false);
  }
};

// Handle image selection from PageList
const handleSelectImage = async (selectedImageId: string) => {
  if (selectedImageId !== imageId.value) {
    // Update the imageId (which updates currentCollection.selectedImageId)
    imageId.value = selectedImageId;

    // Directly load the image and detections via the imageStore
    // This ensures immediate synchronization between stores
    console.log(
      `Directly loading image ${selectedImageId} from collection ${collectionId.value}`,
    );

    // Set component-specific loading states
    loadingState.setComponentLoading(`annotator_${selectedImageId}`, true);
    loadingState.setComponentLoading(`annotationList_${selectedImageId}`, true);

    try {
      // Load image data directly from the imageStore
      await imageStore.loadImage(selectedImageId, collectionId.value);

      // Then load the detections
      if (imageStore.image.id) {
        await imageStore.loadDetections(selectedImageId);

        // Show appropriate notifications based on detection count
        if (imageStore.detections.length === 0) {
          notificationStore.warning('No annotations found for this image');
        } else {
          notificationStore.success(
            `Loaded ${imageStore.detections.length} annotations`,
          );
        }

        // Update state manager with new IDs
        stateManager.updateState(collectionId.value, selectedImageId);
      }
    } catch (error) {
      console.error('Error loading image data:', error);
      notificationStore.error('Error loading image data');
    } finally {
      // Clear component-specific loading states
      loadingState.setComponentLoading(`annotator_${selectedImageId}`, false);
      loadingState.setComponentLoading(
        `annotationList_${selectedImageId}`,
        false,
      );
    }
  }
};
</script>

<template>
  <q-page class="column">
    <!-- Only show loading overlay for critical errors -->
    <div
      v-if="loadingState.currentOperation === 'criticalError'"
      class="loading-overlay"
    >
      <q-spinner color="primary" size="3em" />
      <div class="text-subtitle1 q-mt-sm">{{ loadingMessage }}</div>
    </div>

    <!-- Debug info for development -->
    <div class="debug-info q-pa-xs bg-grey-1 text-caption" v-if="false">
      <div>Collection ID: {{ collectionId }}</div>
      <div>Image ID: {{ imageId }}</div>
      <div>Selected Image: {{ currentCollection.selectedImageId }}</div>
      <div>Detections: {{ detections.length }}</div>
      <div>Component ID: {{ componentId }}</div>
      <div>Loading: {{ loadingState.isComponentLoading(componentId) }}</div>
    </div>

    <div class="row items-stretch" style="min-height: inherit">
      <!-- Page list column -->
      <div class="col-3 flex justify-center">
        <PageList
          :collection-id="collectionId"
          @[IMAGE_EVENTS.SELECT]="handleSelectImage"
        />
      </div>

      <!-- Image annotator column -->
      <div class="col-6">
        <div
          v-if="currentCollection.selectedImageId"
          class="fit position-relative"
        >
          <ImageAnnotator
            :image-id="currentCollection.selectedImageId"
            :collection-id="collectionId"
            ref="annotatorRef"
          />
          <div v-show="loadingState.isLoading" class="loading-overlay">
            <q-circular-progress indeterminate color="primary" size="50px" />
            <div class="text-subtitle1 q-mt-sm">{{ loadingMessage }}</div>
          </div>

          <!-- Optional debugging info overlay -->
          <div v-if="false" class="debug-info q-pa-sm bg-grey-1">
            <div>Collection: {{ collectionId }}</div>
            <div>Image: {{ currentCollection.selectedImageId }}</div>
            <div>
              Detections: {{ imageStore.detections?.length || 0 }} ({{
                imageStore.isLoaded ? 'Loaded' : 'Not loaded'
              }})
            </div>
          </div>
        </div>
        <div v-else class="flex flex-center full-height q-pa-md">
          <div class="text-center">
            <q-icon name="image" size="50px" color="grey-5" />
            <div class="text-subtitle1 q-mt-sm">
              Select an image from the list
            </div>
          </div>
        </div>
      </div>

      <!-- Annotation list column -->
      <div class="col-3 justify-center overflow-hidden">
        <div class="text-h6 q-pa-sm">Label Editor</div>
        <q-scroll-area style="height: calc(100vh - 180px); max-width: 100%">
          <AnnotationList
            :detections="detections"
            :loading="
              loadingState.isComponentLoading(
                `annotationList_${currentCollection.selectedImageId}`,
              )
            "
            @[ANNOTATION_EVENTS.SCROLL_TO]="
              synchronization.handleScrollToAnnotation
            "
            @[ANNOTATION_EVENTS.SELECT]="synchronization.handleSelectAnnotation"
          />
        </q-scroll-area>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  z-index: 999;
}

.debug-info {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 900;
  font-family: monospace;
  opacity: 0.7;
}

.full-height {
  height: calc(100vh - 180px);
}
</style>
