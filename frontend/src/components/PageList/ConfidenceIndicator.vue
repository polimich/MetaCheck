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
});
</script>

<template>
  <div
    v-if="hasLowConfidence"
    class="confidence-indicator low-confidence-indicator"
  ></div>
  <div
    v-else-if="hasMediumConfidence"
    class="confidence-indicator medium-confidence-indicator"
  ></div>
</template>

<style lang="scss" scoped>
/* Confidence indicators with pulsating effects */
.confidence-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
  border: 3px solid transparent;
}

.low-confidence-indicator {
  border-color: rgba(244, 67, 54, 0.7);
  animation: pulsate-red 2s infinite;
}

.medium-confidence-indicator {
  border-color: rgba(255, 152, 0, 0.7);
  animation: pulsate-orange 3s infinite;
}

@keyframes pulsate-red {
  0% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
  }
}

@keyframes pulsate-orange {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
  }
}
</style>
