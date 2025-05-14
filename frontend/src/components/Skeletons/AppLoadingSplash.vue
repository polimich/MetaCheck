<template>
  <div class="app-loading-splash" @click.self="handleCancel">
    <div class="loading-container">
      <div
        class="loading-card"
        :class="{
          'with-error': error,
          'with-progress': progress !== undefined,
        }"
      >
        <div class="card-content">
          <div class="logo-section">
            <img src="icons/favicon-32x32.png" alt="Logo" class="app-logo" />
            <div class="app-title">MetaCheck</div>
          </div>

          <!-- Error state -->
          <div v-if="error" class="error-section">
            <q-icon name="error" size="48px" color="negative" />
            <div class="error-message">{{ error }}</div>
            <q-btn
              v-if="showRetry"
              class="retry-button q-mt-md"
              color="primary"
              label="Retry"
              @click="$emit('retry')"
            />
          </div>

          <!-- Loading state -->
          <div v-else class="loading-section">
            <q-circular-progress
              indeterminate
              size="60px"
              color="primary"
              class="q-mb-md"
              :thickness="0.2"
            />
            <div class="loading-message">{{ message || 'Loading...' }}</div>

            <div
              v-if="progress !== undefined"
              class="progress-container q-mt-md"
            >
              <q-linear-progress
                :value="progress / 100"
                color="primary"
                class="q-mb-xs"
              />
              <div class="progress-label">{{ progress }}%</div>
            </div>

            <!-- Timeout indicator -->
            <div v-if="hasSlowConnection" class="timeout-message q-mt-md">
              <q-icon
                name="warning"
                color="warning"
                size="20px"
                class="q-mr-xs"
              />
              Connection is slow. Please wait...
              <q-btn
                flat
                dense
                color="warning"
                label="Cancel"
                class="q-ml-sm"
                @click="handleCancel"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useLoadingState } from 'src/stores/app/loadingState';

const props = defineProps({
  message: {
    type: String,
    default: 'Loading application...',
  },
  progress: {
    type: Number,
    default: undefined,
  },
  error: {
    type: String,
    default: '',
  },
  showRetry: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['retry', 'cancel']);

// Get loading state
const loadingState = useLoadingState();

// Track connection slowness
const hasSlowConnection = ref(false);
const slowConnectionTimeout = ref<number | null>(null);
const cancelTimeout = ref<number | null>(null);

// Set a timeout to show slow connection message after 8 seconds
onMounted(() => {
  slowConnectionTimeout.value = window.setTimeout(() => {
    if (!props.error) {
      hasSlowConnection.value = true;
    }
  }, 8000);

  // Auto-timeout after 30 seconds to prevent stuck loaders
  cancelTimeout.value = window.setTimeout(() => {
    if (!props.error && loadingState.isLoading) {
      loadingState.clearAllLoadingStates();
      hasSlowConnection.value = false;
    }
  }, 30000);
});

// Clear all timeouts when component is destroyed or on error
onBeforeUnmount(() => {
  if (slowConnectionTimeout.value) {
    clearTimeout(slowConnectionTimeout.value);
    slowConnectionTimeout.value = null;
  }

  if (cancelTimeout.value) {
    clearTimeout(cancelTimeout.value);
    cancelTimeout.value = null;
  }
});

// Clear the timeout when component is destroyed or on error
watch(
  () => props.error,
  (newError) => {
    if (newError && slowConnectionTimeout.value) {
      clearTimeout(slowConnectionTimeout.value);
      slowConnectionTimeout.value = null;
    }
  },
);

// Reset slow connection flag when message changes (indicating progress)
watch(
  () => props.message,
  () => {
    if (hasSlowConnection.value) {
      // Keep the slow connection warning visible once it's shown
      // but reset the timer for new operations
      if (slowConnectionTimeout.value) {
        clearTimeout(slowConnectionTimeout.value);
      }
      slowConnectionTimeout.value = window.setTimeout(() => {
        if (!props.error) {
          hasSlowConnection.value = true;
        }
      }, 8000);
    }
  },
);

// Handle cancel request
const handleCancel = () => {
  hasSlowConnection.value = false;
  loadingState.clearAllLoadingStates();
};
</script>

<style lang="scss" scoped>
.app-loading-splash {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-container {
  width: 100%;
  max-width: 440px;
  padding: 20px;
}

.loading-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transition: all 0.3s ease;

  &.with-error {
    border-left: 5px solid #f44336;
  }

  &.with-progress {
    min-height: 280px;
  }
}

.card-content {
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.app-logo {
  width: 32px;
  height: 32px;
  margin-bottom: 8px;
}

.app-title {
  font-size: 20px;
  font-weight: 500;
  color: #1976d2;
}

.loading-section,
.error-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
}

.loading-message,
.error-message {
  font-size: 16px;
  color: #333;
  margin-top: 8px;
  max-width: 300px;
}

.error-message {
  color: #f44336;
  font-weight: 500;
}

.progress-container {
  width: 100%;
  max-width: 300px;
}

.progress-label {
  font-size: 12px;
  color: #888;
  text-align: right;
}

.timeout-message {
  font-size: 14px;
  color: #ff9800;
  display: flex;
  align-items: center;
  background-color: #fff8e1;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ffecb3;
}
</style>
