<script setup lang="ts">
import { ImageAnnotator, AnnotationList, PageList } from 'components';
import { useRoute, useRouter } from 'vue-router';
import { ref, onMounted, watch, computed } from 'vue';
import { useImageStore } from 'src/stores';
import { useMetaRoleStore } from 'src/stores/meta-role-store';
import { useLoadingState } from 'src/stores/app/loadingState';
import { useStateManager } from 'src/stores/app/stateManager';
import { useNotificationStore } from 'src/stores/app/notificationService';

defineOptions({
  name: 'NewLabelSystemPage',
});

// Setup stores and route
const route = useRoute();
const router = useRouter();
const imageId = ref(route.params.imageId as string);
const collectionId = ref(route.params.collectionId as string);
const imageStore = useImageStore();
const metaRoleStore = useMetaRoleStore();
const loadingState = useLoadingState();
const stateManager = useStateManager();
const notificationStore = useNotificationStore();

// Computed properties
const detections = computed(() => imageStore.detections);
const isLoading = computed(() => loadingState.isLoading);
const loadingMessage = computed(() => loadingState.currentLoadingMessage);

// Load image and detections when component mounts
onMounted(async () => {
  if (imageId.value && collectionId.value) {
    console.log(
      `Component mounted, loading image ${imageId.value} from collection ${collectionId.value}`,
    );

    // Validate IDs
    if (
      !stateManager.validateIds({
        lastCollectionId: collectionId.value,
        lastImageId: imageId.value,
      })
    ) {
      notificationStore.error('Invalid image or collection ID');
      return;
    }

    await loadImageData();
  } else {
    notificationStore.error('Missing required parameters');
    console.error('Missing required route parameters: imageId or collectionId');
  }
});

// Watch for route changes
watch(
  () => route.params.imageId,
  async (newImageId) => {
    if (newImageId && newImageId !== imageId.value) {
      console.log(`Image ID changed to ${newImageId}`);
      imageId.value = newImageId as string;
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
      await loadImageData();
    }
  },
);

// Function to load image data
const loadImageData = async () => {
  // Prevent multiple simultaneous loads
  if (isLoading.value) {
    console.log('Already loading, skipping duplicate load request');
    return;
  }

  // Use the loading state store to manage loading
  loadingState.startLoading('imageLoad', `Loading image ${imageId.value}`);

  try {
    console.log(
      `Loading image ${imageId.value} from collection ${collectionId.value}`,
    );

    // First load the image data
    await imageStore.loadImage(imageId.value, collectionId.value);

    // Then load the detections
    if (imageStore.image.id) {
      loadingState.startLoading('detectionsLoad', 'Loading annotations');
      await imageStore.loadDetections(imageId.value);

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

      loadingState.stopLoading('detectionsLoad');
    } else {
      throw new Error('Image not loaded correctly');
    }

    // Ensure meta roles are loaded
    if (!metaRoleStore.loaded) {
      loadingState.startLoading('metaRoleLoad', 'Loading meta roles');
      await metaRoleStore.loadMetaRoles();
      loadingState.stopLoading('metaRoleLoad');
    }

    console.log(`Loaded ${imageStore.detections.length} detections`);

    // Update state manager
    stateManager.updateState(collectionId.value, imageId.value);
  } catch (error) {
    console.error('Error loading image data:', error);
    stateManager.handleError(error, 'Error loading image data');
    notificationStore.error('Error loading image data');
  } finally {
    loadingState.stopLoading('imageLoad');
  }
};

// Handle loading meta roles for a specific detection
const handleLoadMetaRoles = async (detectionId: string) => {
  loadingState.startLoading(
    'metaRoleUpdate',
    `Loading meta roles for detection ${detectionId}`,
  );
  try {
    await imageStore.updateDetectionMetaRoles(detectionId);
  } catch (error) {
    console.error(
      `Error loading meta roles for detection ${detectionId}:`,
      error,
    );
    notificationStore.error('Error loading meta roles');
  } finally {
    loadingState.stopLoading('metaRoleUpdate');
  }
};

// Handle image selection from PageList
const handleSelectImage = async (selectedImageId: string) => {
  if (selectedImageId !== imageId.value) {
    imageId.value = selectedImageId;

    // Update the route if needed to keep URL in sync
    if (route.params.imageId !== selectedImageId) {
      router.push({
        name: route.name as string,
        params: {
          ...route.params,
          imageId: selectedImageId,
        },
      });
    }

    // Load the image data
    await loadImageData();
  }
};
</script>

<template>
  <q-page class="column">
    <!-- Loading overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <q-spinner color="primary" size="3em" />
      <div class="text-subtitle1 q-mt-sm">{{ loadingMessage }}</div>
    </div>

    <!-- Debug info for development -->
    <div class="debug-info q-pa-xs bg-grey-1 text-caption" v-if="false">
      <div>Collection ID: {{ collectionId }}</div>
      <div>Image ID: {{ imageId }}</div>
      <div>Detections: {{ detections.length }}</div>
      <div>Loading: {{ isLoading }}</div>
    </div>

    <div class="row items-stretch" style="min-height: inherit">
      <div class="col-3 flex justify-center">
        <PageList
          :collection-id="collectionId"
          @select-image="handleSelectImage"
        />
      </div>
      <div class="col-5 flex justify-center">
        <div class="q-pa-md" style="width: 95%; border: 1px solid">
          <ImageAnnotator :image-id="imageId" :collection-id="collectionId" />
        </div>
      </div>
      <div class="col justify-center overflow-hidden-y">
        <div class="text-h6 q-pa-sm">Label Editor</div>
        <q-scroll-area style="height: 100%; max-width: 100%">
          <AnnotationList
            :detections="detections"
            :loading="isLoading"
            @load-meta-roles="handleLoadMetaRoles"
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
</style>
