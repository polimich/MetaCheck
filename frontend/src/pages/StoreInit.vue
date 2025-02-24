<script setup lang="ts">
import {
  useCollectionStore,
  useImageStore,
  useDetectionTypesStore,
} from 'src/stores';

const collectionStore = useCollectionStore();
const imageStore = useImageStore();
const detectionStore = useDetectionTypesStore();
collectionStore.init();
imageStore.init();
detectionStore.init();
</script>
<template><div></div></template>
