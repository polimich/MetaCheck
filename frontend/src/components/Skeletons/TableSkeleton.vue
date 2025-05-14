<template>
  <div class="table-skeleton q-pa-md">
    <div class="q-mb-md">
      <q-skeleton type="text" width="20%" class="text-h6" />
    </div>

    <!-- Table header skeleton -->
    <div class="row q-mb-sm bg-grey-2 q-pa-sm">
      <div class="col-4">
        <q-skeleton type="text" width="60%" />
      </div>
      <div class="col-4">
        <q-skeleton type="text" width="70%" />
      </div>
      <div class="col-4">
        <q-skeleton type="text" width="50%" />
      </div>
    </div>

    <!-- Table rows skeletons -->
    <div
      v-for="n in rows"
      :key="n"
      class="row q-pa-sm q-mb-xs items-center skeleton-row"
    >
      <div class="col-4">
        <q-skeleton type="text" width="80%" />
      </div>
      <div class="col-4">
        <q-skeleton type="text" width="60%" />
      </div>
      <div class="col-4 flex justify-between">
        <q-skeleton type="text" width="40%" />
        <q-skeleton type="QBtn" class="q-ml-sm" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @author Michael Polívka (xpoliv07)
defineProps({
  rows: {
    type: Number,
    default: 5,
  },
});
</script>

<style scoped>
.skeleton-row {
  border-bottom: 1px solid #f0f0f0;
}

.table-skeleton {
  border-radius: 4px;
  background-color: white;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.2);
}
</style>
