<script setup lang="ts">
import { ImageAnnotator } from 'components/ImageAnnotator';

const collectionId = 'b2b30ba9-c072-40a8-ae4a-d57bd88e577e';
const imageId = '97b800fd-3b9b-47ab-8133-c5911a630163';
</script>

<template>
  <div class="q-pa-md dev-page">
    <h4 class="q-mb-md">ImageAnnotator Component Comparison</h4>

    <div class="row q-col-gutter-md">
      <!-- Original Implementation -->
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">Original Implementation</div>
          </q-card-section>
          <q-card-section class="annotator-container">
            <ImageAnnotator :image-id="imageId" :collection-id="collectionId" />
          </q-card-section>
        </q-card>
      </div>

      <!-- New Implementation -->
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">New Implementation</div>
          </q-card-section>
          <q-card-section class="annotator-container">
            <NewImageAnnotator
              :imageId="imageId"
              :collectionId="collectionId"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="q-mt-md">
      <q-card>
        <q-card-section>
          <div class="text-h6">Instructions</div>
          <p>
            This page allows you to compare the original and refactored
            implementations of the ImageAnnotator component side by side.
          </p>
          <p>Both components should have the same functionality:</p>
          <ul>
            <li>
              Create annotations by clicking and dragging in add mode (W key)
            </li>
            <li>Select annotations by clicking on them</li>
            <li>Move annotations by dragging</li>
            <li>Resize annotations using handles</li>
            <li>Pan the image by dragging in drag mode (E key)</li>
            <li>Zoom in/out with Alt + mouse wheel</li>
            <li>Undo/redo changes (Ctrl+Z, Ctrl+Y)</li>
            <li>Save annotations (Ctrl+S)</li>
          </ul>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style scoped>
.dev-page {
  height: 100%;
}

.annotator-container {
  height: 500px;
  background-color: #f0f0f0;
}
</style>
