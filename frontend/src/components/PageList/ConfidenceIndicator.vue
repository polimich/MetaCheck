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
    class="confidence-indicator low-confidence"
  ></div>
  <div
    v-else-if="hasMediumConfidence"
    class="confidence-indicator medium-confidence"
  ></div>
</template>

<style lang="scss" scoped>
.confidence-indicator {
  position: absolute;
  inset: 0; /* Shorthand for top, right, bottom, left: 0 */
  pointer-events: none;
  z-index: 1;
  border: 5px solid transparent;
  box-sizing: border-box;
  border-radius: inherit;
}

.low-confidence {
  border-color: rgba(244, 67, 54, 0.8);
  animation: pulsate 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
  --pulse-color: rgba(244, 67, 54, 0.5);
}

.medium-confidence {
  border-color: rgba(255, 152, 0, 0.8);
  animation: pulsate 3s infinite cubic-bezier(0.4, 0, 0.6, 1);
  --pulse-color: rgba(255, 152, 0, 0.5);
}

@keyframes pulsate {
  0% {
    box-shadow: 0 0 0 0 var(--pulse-color);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(0, 0, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
  }
}
</style>
