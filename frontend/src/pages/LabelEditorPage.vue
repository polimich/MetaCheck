<script setup lang="ts">
import { useImageStore } from 'src/stores';
import ImageDetailPage from 'pages/ImageDetailPage.vue';
import { useRoute } from 'vue-router';
import { ref, onMounted } from 'vue';

defineOptions({
  name: 'LabelEditorPage',
});

const route = useRoute();
const imageStore = useImageStore();
const imageId = ref(route.params.imageId as string);
const collectionId = ref(route.params.collectionId as string);

// Load data when component mounts
onMounted(async () => {
  if (imageId.value) {
    await imageStore.loadImage(imageId.value, collectionId.value);
    await imageStore.loadDetections(imageId.value);
  }
});
</script>

<template>
  <div class="row" :style="{ height: 100 + '%' }">
    <div class="col-3">List Pages</div>
    <div class="col-7 content-center">
      <ImageDetailPage :image-id="imageId" :collection-id="collectionId" />
    </div>
    <div class="col overflow-auto full-height">
      <!-- List of annotations will go here -->
    </div>
  </div>
</template>

<style scoped></style>
