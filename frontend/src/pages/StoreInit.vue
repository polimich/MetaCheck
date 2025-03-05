<script setup lang="ts">
import {
  useCollectionStore,
  useImageStore,
  useDetectionTypesStore,
} from 'src/stores';
import { useCollectionDataAccess } from 'stores/data-access';
import { useCurrentCollectionState } from 'stores/frontend-state';

const collectionStore = useCollectionStore();
const imageStore = useImageStore();
const detectionStore = useDetectionTypesStore();
const collectionDA = useCollectionDataAccess();
const currentCollection = useCurrentCollectionState();

collectionStore.init();
imageStore.init();
detectionStore.init();
collectionDA.init();
currentCollection.init();
</script>
<template><div></div></template>
