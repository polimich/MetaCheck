<template>
  <div class="app-loading-splash">
    <div class="content">
      <div class="logo">
        <q-icon name="check_circle" size="4rem" color="primary" />
        <div class="app-name text-primary text-h4 q-mt-sm">MetaCheck</div>
      </div>

      <div class="loading-status">
        <div class="progress-bar">
          <div class="progress-indicator" :style="{ width: progressWidth }" />
        </div>
        <div class="q-mt-sm text-subtitle1">{{ message }}</div>
      </div>

      <div v-if="error" class="error-message q-mt-md text-negative">
        <q-icon name="error" />
        <span class="q-ml-xs">{{ error }}</span>
      </div>

      <div v-if="showRetry" class="q-mt-md">
        <q-btn color="primary" label="Retry" @click="$emit('retry')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  message: {
    type: String,
    default: 'Loading...',
  },
  error: {
    type: String,
    default: '',
  },
  progress: {
    type: Number,
    default: 0,
  },
  showRetry: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['retry']);

const progressWidth = computed(() => {
  const width = Math.max(10, Math.min(100, props.progress));
  return `${width}%`;
});
</script>

<style scoped>
.app-loading-splash {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  z-index: 9999;
}

.content {
  max-width: 400px;
  width: 90%;
  padding: 2rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.logo {
  margin-bottom: 2rem;
}

.app-name {
  font-weight: 700;
}

.progress-bar {
  height: 6px;
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-indicator {
  height: 100%;
  background-color: var(--q-primary);
  transition: width 0.5s ease;
  min-width: 10%;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
