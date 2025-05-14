<template>
  <StoreInit />
  <GlobalLoadingOverlay />
  <router-view />
</template>

<script setup lang="ts">
// @author Michael Polívka (xpoliv07)
import StoreInit from 'pages/StoreInit.vue';
import GlobalLoadingOverlay from 'src/components/GlobalLoadingOverlay.vue';

defineOptions({
  name: 'App',
});
</script>
