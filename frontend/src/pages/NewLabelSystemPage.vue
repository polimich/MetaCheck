<script setup lang="ts">
import ImageDetailWithProps from 'pages/ImageDetailWithProps.vue';
import { ImageAnnotator } from 'components';
</script>

<template>
  <q-page class="column">
    <div class="row items-stretch" style="min-height: inherit">
      <div class="col-3 flex justify-center"><ImageAnnotator /></div>
      <div class="col-7 flex justify-center">
        <div class="q-pa-md" style="width: 95%; border: 1px solid">
          <ImageDetailWithProps
            image-id="8d50bec2-4de2-411b-becb-6b3f7464273d"
          />
        </div>
      </div>
      <div class="col flex justify-center">Label Editor</div>
    </div>
  </q-page>
</template>

<style scoped></style>
