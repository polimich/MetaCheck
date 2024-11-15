<script setup lang="ts">
import { useCollectionStore, useImageStore } from 'src/stores';

const collectionStore = useCollectionStore();
const imageStore = useImageStore();
collectionStore.init();
imageStore.init();
</script>
<template><div></div></template>
