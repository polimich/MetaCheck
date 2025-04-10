<template>
  <q-page class="flex flex-col">
    <div class="text-h5 q-pa-md">Image Comparison</div>

    <div class="row full-width" style="height: calc(100vh - 200px)">
      <!-- Original ImageAnnotator -->
      <div class="col-6 q-pr-sm">
        <q-card class="full-height">
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">Original Annotator</div>
          </q-card-section>
          <q-card-section class="full-height q-pa-none">
            <ImageAnnotator
              v-if="!loadingState.isComponentLoading(componentId)"
              :image-id="imageId"
              :collection-id="collectionId"
            />
            <div v-else class="flex flex-center full-height">
              <q-spinner size="50px" color="primary" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- New ImageAnnotator -->
      <div class="col-6 q-pl-sm">
        <q-card class="full-height">
          <q-card-section class="bg-secondary text-white">
            <div class="text-h6">New Annotator</div>
          </q-card-section>
          <q-card-section class="full-height q-pa-none">
            <NewImageAnnotator
              v-if="!loadingState.isComponentLoading(componentId)"
              :image-id="imageId"
              :collection-id="collectionId"
            />
            <div v-else class="flex flex-center full-height">
              <q-spinner size="50px" color="secondary" />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Image selector -->
    <div class="row q-pa-md">
      <div class="col-12">
        <q-select
          v-model="collectionId"
          :options="[currentCollection.collection]"
          option-value="id"
          option-label="name"
          label="Select Collection"
          outlined
          :loading="currentCollection.loading"
          @update:model-value="loadCurrentCollection"
        />
      </div>

      <div class="col-12 q-mt-md">
        <q-select
          v-if="
            currentCollection.collection && currentCollection.collection.images
          "
          v-model="imageId"
          :options="currentCollection.collection.images"
          option-value="id"
          option-label="name"
          label="Select Image"
          outlined
          @update:model-value="selectImage"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useImageStore } from 'src/stores';
import { DetectionState } from 'src/types';
import ImageAnnotator from 'src/components/ImageAnnotator/ImageAnnotator.vue';
import NewImageAnnotator from 'src/components/NewImageAnnotator/NewImageAnnotator.vue';
import { useLoadingState } from 'src/stores/app/loadingState';

// Custom types for annotations
interface OriginalAnnotation extends DetectionState {
  vertices: { x: number; y: number }[];
}

interface NewAnnotation extends DetectionState {
  points: { x: number; y: number }[];
  type: string;
  color: string;
  closed: boolean;
}

// Define image interface
interface ImageData {
  id: string;
  name: string;
}

// Route params
const route = useRoute();
const currentCollection = useCurrentCollectionState();
const imageStore = useImageStore();
const loadingState = useLoadingState();

// Route parameters
const collectionId = ref<string>(route.params.collectionId as string);
const imageId = ref<string>(route.params.imageId as string);

// Component loading state identifier
const componentId = computed(
  () => `imageComparison_${imageId.value}_${collectionId.value}`,
);

// Original and new annotations refs
const originalAnnotations = ref<OriginalAnnotation[]>([]);
const newAnnotations = ref<NewAnnotation[]>([]);

// Watch for route changes
watch(
  () => route.params.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== collectionId.value) {
      collectionId.value = newCollectionId as string;
      await loadCurrentCollection();
    }
  },
);

watch(
  () => route.params.imageId,
  async (newImageId) => {
    if (newImageId && newImageId !== imageId.value) {
      imageId.value = newImageId as string;
      await loadImageData();
    }
  },
);

// Load collection data
async function loadCurrentCollection() {
  loadingState.setComponentLoading(componentId.value, true);

  try {
    await currentCollection.loadCollection(collectionId.value);
  } catch (error) {
    console.error('Error loading collection:', error);
  } finally {
    loadingState.setComponentLoading(componentId.value, false);
  }
}

// Load image and annotations
async function loadImageData() {
  loadingState.setComponentLoading(componentId.value, true);

  try {
    // Load image details
    await imageStore.loadImage(imageId.value, collectionId.value);

    // Load annotations
    await imageStore.loadDetections(imageId.value);

    // Convert to formats needed by both annotators
    convertAnnotations();
  } catch (error) {
    console.error('Error loading image data:', error);
  } finally {
    loadingState.setComponentLoading(componentId.value, false);
  }
}

// Convert store annotations to format needed by both annotators
function convertAnnotations() {
  // Convert to original annotator format
  originalAnnotations.value = imageStore.detections.map(
    (ann) =>
      ({
        ...ann,
        vertices: createVerticesFromAnnotation(ann),
      }) as OriginalAnnotation,
  );

  // Convert to new annotator format
  newAnnotations.value = imageStore.detections.map(
    (ann) =>
      ({
        ...ann,
        type: 'polygon',
        points: createVerticesFromAnnotation(ann),
        color: ann.computed_color || '#ff0000',
        closed: true,
      }) as NewAnnotation,
  );
}

// Helper to create vertices array from detection
function createVerticesFromAnnotation(annotation: DetectionState) {
  // For box annotations, convert to 4 corner points
  if (annotation.width && annotation.height) {
    return [
      { x: annotation.x, y: annotation.y },
      { x: annotation.x + annotation.width, y: annotation.y },
      {
        x: annotation.x + annotation.width,
        y: annotation.y + annotation.height,
      },
      { x: annotation.x, y: annotation.y + annotation.height },
    ];
  }

  // Return empty array if no coordinates
  return [];
}

// Select an image from the collection
function selectImage(image: ImageData) {
  if (!image) return;

  imageId.value = image.id;
  loadImageData();
}

onMounted(async () => {
  // Load initial data
  await loadCurrentCollection();

  if (imageId.value) {
    await loadImageData();
  }
});
</script>

<style scoped>
.full-height {
  height: 100%;
}
</style>
