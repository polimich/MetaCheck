<script setup lang="ts">
import ImageDetailWithProps from 'pages/ImageDetailWithProps.vue';
import { AnnotationListItem, ImageAnnotator } from 'components';
import { useRoute } from 'vue-router';
import { ref } from 'vue';
import { useDetectionTypesStore, useImageStore } from 'src/stores';

const route = useRoute();

const imageId = ref(route.params.imageId as string);
const imageStore = useImageStore();
const detectionTypesStore = useDetectionTypesStore();

console.log(imageStore.annotations);
</script>

<template>
  <q-page class="column">
    <div class="row items-stretch" style="min-height: inherit">
      <div class="col-3 flex justify-center"><ImageAnnotator /></div>
      <div class="col-5 flex justify-center">
        <div class="q-pa-md" style="width: 95%; border: 1px solid">
          <ImageDetailWithProps :image-id="imageId" />
        </div>
      </div>
      <div class="col justify-center overflow-hidden-y">
        <div>Label Editor</div>
        <q-scroll-area style="height: 100%; max-width: 100%">
          <AnnotationListItem
            v-for="annotation in imageStore.getSortedAnnotations"
            :annotation="annotation"
            :options="detectionTypesStore.detectionTypesSelectOptions"
            v-bind:key="annotation.id"
          />
        </q-scroll-area>
      </div>
    </div>
  </q-page>
</template>

<style scoped></style>
