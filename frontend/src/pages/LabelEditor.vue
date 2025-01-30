<script setup lang="ts">
// import { useImageStore } from 'src/stores';
import ImageDetailWithProps from 'pages/ImageDetailWithProps.vue';

// const imageStore = useImageStore();

// const handleEdit = async (id: string) => {
//   const annotations = imageStore.annotations;
//   const annotation = annotations.find((a) => a.id === id);
//   if (!annotation) return;
//   annotation.type = 'edited';
//   await imageStore.createOrUpdateDetections(
//     '8d50bec2-4de2-411b-becb-6b3f7464273d',
//   );
//   await imageStore.loadDetections('8d50bec2-4de2-411b-becb-6b3f7464273d');
// };
</script>

<template>
  <!--  <div>-->
  <!--    <div v-for="annotation in imageStore.annotations" :key="annotation.id">-->
  <!--      <div>type: {{ annotation.type }}</div>-->
  <!--      <div>color: {{ annotation.color }}</div>-->
  <!--    </div>-->
  <!--  </div>-->
  <div class="row" :style="{ height: 100 + '%' }">
    <div class="col-3">List Pages</div>
    <div class="col-7 content-center">
      <ImageDetailWithProps image-id="8d50bec2-4de2-411b-becb-6b3f7464273d" />
    </div>
    <div class="col overflow-auto full-height">
      <!--      <div v-for="annotation in imageStore.annotations" :key="annotation.id">-->
      <!--        <div>type: {{ annotation.type }}</div>-->
      <!--        <div>color: {{ annotation.color }}</div>-->
      <!--        <button @click="handleEdit(annotation.id)">Edit</button>-->
      <!--      </div>-->
    </div>
  </div>
</template>

<style scoped></style>
