<script setup lang="ts">
import { useImageStore } from 'src/stores';
import { useCollectionDataAccess } from 'stores/data-access';
import { useCurrentCollectionState } from 'stores/frontend-state';
import { useCollectionStore } from 'stores/collection';
import { useMetaRoleStore } from 'src/stores/meta-role-store';

defineOptions({
  name: 'StoreInitPage',
});

const metaRoleStore = useMetaRoleStore();
const imageStore = useImageStore();
const collectionDA = useCollectionDataAccess();
const currentCollection = useCurrentCollectionState();
const collectionStore = useCollectionStore();
imageStore.init();
collectionDA.init();
currentCollection.init();
collectionStore.init();
metaRoleStore.init();
</script>
<template><div></div></template>
