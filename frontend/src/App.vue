<template>
  <StoreInit />
  <router-view />
</template>

<script setup lang="ts">
import StoreInit from 'pages/StoreInit.vue';

defineOptions({
  name: 'App',
});
</script>
