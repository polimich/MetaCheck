<script setup lang="ts">
import { ImageAnnotator, AnnotationList, PageList } from 'components';
import { useRoute } from 'vue-router';
import { ref, onMounted, watch, computed } from 'vue';
import { useImageStore } from 'src/stores';
import { useMetaRoleStore } from 'src/stores/meta-role-store';

defineOptions({
  name: 'NewLabelSystemPage',
});

const route = useRoute();
const imageId = ref(route.params.imageId as string);
const imageStore = useImageStore();
const metaRoleStore = useMetaRoleStore();
const collectionId = ref(route.params.collectionId as string);
const loading = ref(false);

// Get available meta role options
const metaRoleOptions = computed(() => {
  return (
    metaRoleStore.metaRoles?.map((role) => ({
      label: role.display_name,
      value: role.id,
      id: role.id,
      color: role.color,
    })) ?? []
  );
});

// Load image and detections when component mounts
onMounted(async () => {
  await loadImageData();
  // Load meta roles for the dropdown
  await metaRoleStore.loadMetaRoles();
});

// Watch for route changes
watch(
  () => route.params.imageId,
  async (newImageId) => {
    if (newImageId && newImageId !== imageId.value) {
      imageId.value = newImageId as string;
      await loadImageData();
    }
  },
);

watch(
  () => route.params.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== collectionId.value) {
      collectionId.value = newCollectionId as string;
      await loadImageData();
    }
  },
);

// Function to load image data
const loadImageData = async () => {
  loading.value = true;
  try {
    await imageStore.loadImage(imageId.value, collectionId.value);
    await imageStore.loadDetections(imageId.value);
  } catch (error) {
    console.error('Error loading image data:', error);
  } finally {
    loading.value = false;
  }
};

// Handle loading meta roles for a specific detection
const handleLoadMetaRoles = async (detectionId: string) => {
  await imageStore.updateDetectionMetaRoles(detectionId);
};
</script>

<template>
  <q-page class="column">
    <div class="row items-stretch" style="min-height: inherit">
      <div class="col-3 flex justify-center">
        <PageList :collection-id="collectionId" />
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
            :detections="imageStore.getSortedDetections"
            :options="metaRoleOptions"
            :loading="loading"
            @load-meta-roles="handleLoadMetaRoles"
          />
        </q-scroll-area>
      </div>
    </div>
  </q-page>
</template>

<style scoped></style>
