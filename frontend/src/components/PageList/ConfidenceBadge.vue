<script setup lang="ts">
defineProps({
  hasLowConfidence: {
    type: Boolean,
    required: true,
  },
  hasMediumConfidence: {
    type: Boolean,
    required: true,
  },
  detectionCount: {
    type: Number,
    required: true,
  },
});
</script>

<template>
  <div class="confidence-status">
    <q-badge
      v-if="hasLowConfidence"
      color="red-8"
      text-color="white"
      class="badge-sm"
    >
      Low
      <q-tooltip>Low confidence detections</q-tooltip>
    </q-badge>
    <q-badge
      v-else-if="hasMediumConfidence"
      color="orange-8"
      text-color="white"
      class="badge-sm"
    >
      Med
      <q-tooltip>Medium confidence detections</q-tooltip>
    </q-badge>
    <q-badge
      v-else-if="detectionCount > 0"
      color="green-8"
      text-color="white"
      class="badge-sm"
    >
      High
      <q-tooltip>High confidence detections</q-tooltip>
    </q-badge>
  </div>
</template>

<style lang="scss" scoped>
.confidence-status {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;

  .badge-sm {
    font-size: 10px;
    padding: 2px 6px;
  }
}
</style>
