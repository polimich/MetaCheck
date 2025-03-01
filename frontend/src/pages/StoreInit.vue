<script setup lang="ts">
import {
  useCollectionStore,
  useImageStore,
  useDetectionTypesStore,
} from 'src/stores';
import { useCollectionDataAccessStore } from 'stores/data-access';

const collectionStore = useCollectionStore();
const imageStore = useImageStore();
const detectionStore = useDetectionTypesStore();
const collectionDA = useCollectionDataAccessStore();
collectionStore.init();
imageStore.init();
detectionStore.init();
collectionDA.init();
</script>
<template><div></div></template>
