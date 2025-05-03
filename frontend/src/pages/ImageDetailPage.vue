<script setup lang="ts">
import { AnnotationList, PageList, ImageAnnotator } from 'components';
import { useRoute, useRouter } from 'vue-router';
import { ref, onMounted, watch, computed } from 'vue';
import { useImageStore } from 'src/stores/data/useImage';
import { useCollection } from 'src/stores/data/useCollection';
import { useMetaRoleStore } from 'src/stores/meta-role-store';
import {
  useLoadingState,
  useStateManager,
  useNotificationStore,
} from 'src/stores';
import { useSynchronization } from 'src/components/ImageAnnotator/composables/useSynchronization';
import { ANNOTATION_EVENTS, IMAGE_EVENTS } from 'src/constants/events';
import { DetectionState, ImageState } from 'src/types/frontend-state';

// Define the interface for the ImageAnnotator instance - using the same type as in useSynchronization
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
const collectionStore = useCollection();
const metaRoleStore = useMetaRoleStore();
const loadingState = useLoadingState();
const stateManager = useStateManager();
const notificationStore = useNotificationStore();

// Use the synchronization composable
const synchronization = useSynchronization();

// Computed properties
const detections = computed(() => {
  return imageStore.detections || [];
});
const loadingMessage = computed(() => loadingState.currentLoadingMessage);

// Convert imageStore.image to the expected ImageState for the AnnotationList component
const imageForAnnotationList = computed((): ImageState => {
  // Default empty ImageState
  const defaultImage: ImageState = {
    id: '',
    name: '',
    height: 0,
    width: 0,
    detection_count: 0,
    annotated_detection_count: 0,
    order: 0,
    detections: [],
    edited: false,
    page_index: '',
    page_index_confidence: 0,
    page_type: '',
    page_type_confidence: 0,
  };

  // If no image is loaded, return the default
  if (!imageStore.image) {
    return defaultImage;
  }

  // Map the image properties from ImageType to ImageState
  return {
    id: imageStore.image.id,
    name: imageStore.image.name,
    height: imageStore.image.height,
    width: imageStore.image.width,
    confidence: imageStore.image.confidence,
    detection_count: imageStore.image.detection_count,
    annotated_detection_count: imageStore.image.annotated_detection_count,
    order: imageStore.image.order,
    detections: [], // We use the detections from the separate computed property
    edited: false, // Add the required BaseState property
    page_index: imageStore.image.page_index,
    page_index_confidence: imageStore.image.page_index_confidence,
    page_type: imageStore.image.page_type,
    page_type_confidence: imageStore.image.page_type_confidence,
  };
});

// Component ID for loading state
const componentId = computed(() => {
  return `annotator_${imageStore.currentImageId}`;
});

// Use both route params and store state for the imageId
const imageId = computed({
  get: () => imageStore.currentImageId,
  set: (value: string) => {
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

// Refs for component instances
const annotatorRef = ref<ImageAnnotatorInstance | null>(null);

// Set the annotator ref in the synchronization composable once it's mounted
watch(annotatorRef, (newRef) => {
  if (newRef) {
    synchronization.setAnnotatorRef(newRef);
  }
});

// Track collection loading status to prevent multiple calls
const isCollectionLoading = ref(false);

// Load collection data with optimized approach
const loadCollectionData = async (collectionId: string) => {
  if (isCollectionLoading.value) {
    console.log('Collection already loading, skipping redundant load');
    return;
  }

  isCollectionLoading.value = true;
  const loadingKey = `collection_${collectionId}`;
  loadingState.setComponentLoading(loadingKey, true);

  try {
    console.log(`Loading collection ${collectionId}`);
    await collectionStore.loadCollection(collectionId);
    console.log('Collection loaded successfully');
  } catch (error) {
    console.error('Error loading collection:', error);
    notificationStore.error('Error loading collection data');
  } finally {
    loadingState.setComponentLoading(loadingKey, false);
    isCollectionLoading.value = false;
  }
};

// Load image and detections when component mounts
onMounted(async () => {
  if (collectionId.value) {
    console.log(`Component mounted, loading collection ${collectionId.value}`);

    // Validate collection ID
    if (!stateManager.validateIds({ lastCollectionId: collectionId.value })) {
      notificationStore.error('Invalid collection ID');
      return;
    }

    // First load the collection (optimized)
    await loadCollectionData(collectionId.value);

    // If imageId is provided in route, select that image
    const routeImageId = route.params.imageId as string;
    if (routeImageId) {
      console.log(`Route has image ID ${routeImageId}, loading it`);

      // Set loading state to indicate work in progress
      loadingState.setComponentLoading(`annotator_${routeImageId}`, true);

      try {
        // Load image directly using the new store
        const result = await imageStore.loadImage(routeImageId);

        if (!result.success) {
          throw new Error(result.error || 'Error loading image');
        }

        // Update state manager
        stateManager.updateState(collectionId.value, routeImageId);

        console.log(`Successfully loaded image ${routeImageId} on page mount`);
      } catch (error) {
        console.error('Error loading image data on mount:', error);
        notificationStore.error('Error loading image data');
      } finally {
        loadingState.setComponentLoading(`annotator_${routeImageId}`, false);
      }
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
      await loadImageData(newImageId as string);
    }
  },
);

watch(
  () => route.params.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== collectionId.value) {
      console.log(`Collection ID changed to ${newCollectionId}`);
      collectionId.value = newCollectionId as string;

      // Load the new collection with optimized approach
      await loadCollectionData(collectionId.value);

      // If route has imageId, load that image
      const routeImageId = route.params.imageId as string;
      if (routeImageId) {
        await loadImageData(routeImageId);
      }
    }
  },
);

// Function to load image data - optimized for performance
const loadImageData = async (imageIdToLoad?: string) => {
  const targetImageId = imageIdToLoad || (route.params.imageId as string);

  if (!targetImageId) {
    console.log('No image selected, skipping load');
    return;
  }

  // Skip loading if image is already loaded
  if (imageStore.currentImageId === targetImageId && imageStore.image) {
    console.log(
      `Image ${targetImageId} is already loaded in the store, skipping redundant load.`,
    );

    // Ensure state manager is updated
    if (stateManager.lastImageId !== targetImageId) {
      stateManager.updateState(collectionId.value, targetImageId);
    }

    // Still update the UI route/refs if needed
    imageId.value = targetImageId;
    return;
  }

  // Set component-specific loading states
  loadingState.setComponentLoading(`annotator_${targetImageId}`, true);
  loadingState.setComponentLoading(`annotationList_${targetImageId}`, true);

  try {
    console.log(
      `Loading image ${targetImageId} from collection ${collectionId.value}`,
    );

    // Load the image using the new store
    const result = await imageStore.loadImage(targetImageId);

    if (!result.success) {
      throw new Error(result.error || 'Error loading image');
    }

    // Update the UI
    imageId.value = targetImageId;

    // Show appropriate notification based on detection count
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

    // Ensure meta roles are loaded
    if (!metaRoleStore.loaded) {
      loadingState.setComponentLoading(`metaRoles_${targetImageId}`, true);
      await metaRoleStore.loadMetaRoles();
      loadingState.setComponentLoading(`metaRoles_${targetImageId}`, false);
    }

    // Update state manager
    stateManager.updateState(collectionId.value, targetImageId);
  } catch (error) {
    console.error('Error loading image data:', error);
    stateManager.handleError(error, 'Error loading image data');
    notificationStore.error('Error loading image data');
    loadingState.startLoading('criticalError', 'Error loading image data');
    setTimeout(() => loadingState.stopLoading('criticalError'), 2000);
  } finally {
    // Clear component-specific loading states
    loadingState.setComponentLoading(`annotator_${targetImageId}`, false);
    loadingState.setComponentLoading(`annotationList_${targetImageId}`, false);
  }
};

// Handle image selection from PageList
const handleSelectImage = async (selectedImageId: string) => {
  if (selectedImageId !== imageId.value) {
    await loadImageData(selectedImageId);
  }
};

// Create function to save detections - used by child components
const saveDetections = async () => {
  if (!imageStore.hasChanges) {
    console.log('No changes to save');
    return;
  }

  loadingState.startLoading('savingDetections', 'Saving annotations...');

  try {
    const result = await imageStore.saveAllChanges();

    if (!result.success) {
      throw new Error(result.error || 'Error saving changes');
    }

    notificationStore.success('Annotations saved successfully');
  } catch (error) {
    console.error('Error saving detections:', error);
    notificationStore.error('Error saving annotations');
  } finally {
    loadingState.stopLoading('savingDetections');
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
      <div>Detections: {{ detections.length }}</div>
      <div>Component ID: {{ componentId }}</div>
      <div>Loading: {{ loadingState.isComponentLoading(componentId) }}</div>
    </div>

    <div class="row items-stretch" style="min-height: inherit">
      <!-- Page list column -->
      <div class="col-3 flex justify-center">
        <PageList
          :collection-id="collectionId"
          layout="sidebar"
          show-header
          show-statistics
          show-view-mode-selector
          enable-bulk-actions
          @[IMAGE_EVENTS.SELECT]="handleSelectImage"
        />
      </div>

      <!-- Image annotator column -->
      <div class="col-6">
        <div v-if="imageStore.currentImageId" class="fit position-relative">
          <ImageAnnotator
            :image-id="imageStore.currentImageId"
            :collection-id="collectionId"
            ref="annotatorRef"
            @save="saveDetections"
          />
          <div v-show="loadingState.isLoading" class="loading-overlay">
            <q-circular-progress indeterminate color="primary" size="50px" />
            <div class="text-subtitle1 q-mt-sm">{{ loadingMessage }}</div>
          </div>

          <!-- Optional debugging info overlay -->
          <div v-if="false" class="debug-info q-pa-sm bg-grey-1">
            <div>Collection: {{ collectionId }}</div>
            <div>Image: {{ imageStore.currentImageId }}</div>
            <div>Detections: {{ imageStore.detections?.length || 0 }}</div>
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
        <q-scroll-area style="height: 100%; max-width: 100%">
          <AnnotationList
            :detections="detections"
            :loading="
              loadingState.isComponentLoading(
                `annotationList_${imageStore.currentImageId}`,
              )
            "
            :image="imageForAnnotationList"
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
