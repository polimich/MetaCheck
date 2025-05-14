<template>
  <AppLoadingSplash
    v-if="showOverlay"
    :message="loadingMessage"
    :progress="progressCounter"
    :error="errorMessage"
    :show-retry="showRetry"
    @retry="$emit('retry')"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { useLoadingState } from 'src/stores/app/loadingState';
import { AppLoadingSplash } from './Skeletons';

// @author Michael Polívka (xpoliv07)

defineOptions({
  name: 'GlobalLoadingOverlay',
});

defineEmits(['retry']);

const loadingState = useLoadingState();
const progressCounter = ref(10);
let progressInterval: number | null = null;
const showOverlay = ref(false);
const errorMessage = ref('');
const showRetry = ref(false);
const loadingDebounceTimer = ref<number | null>(null);
const loadingInProgress = ref(false);

// Show based on loading state operations or app initialization
const isLoading = computed(() => {
  // Check for only one loading state at a time
  const hasActiveLoadingState =
    loadingState.currentOperation === 'navigatingToImage' ||
    loadingState.currentOperation === 'changingImage' ||
    loadingState.currentOperation === 'navigatingToCollection' ||
    loadingState.currentOperation === 'navigatingToCollections' ||
    loadingState.currentOperation === 'appInit' ||
    loadingState.currentOperation === 'criticalError';

  return hasActiveLoadingState;
});

const loadingMessage = computed(() => loadingState.currentLoadingMessage);

// Watch for changes in critical errors
watch(
  () => loadingState.currentOperation === 'criticalError',
  (isCriticalError) => {
    if (isCriticalError && loadingState.currentLoadingMessage) {
      errorMessage.value = loadingState.currentLoadingMessage;
      showRetry.value = true;
    } else {
      errorMessage.value = '';
      showRetry.value = false;
    }
  },
  { immediate: true },
);

// Debounce function to prevent rapid show/hide cycles
const debounceLoading = (shouldShow: boolean, delay = 50) => {
  // Clear any existing timer
  if (loadingDebounceTimer.value !== null) {
    window.clearTimeout(loadingDebounceTimer.value);
    loadingDebounceTimer.value = null;
  }

  // For navigation events, show immediately
  if (
    shouldShow &&
    (loadingState.currentOperation === 'navigatingToCollection' ||
      loadingState.currentOperation === 'navigatingToImage' ||
      loadingState.currentOperation === 'changingImage')
  ) {
    startLoading();
    return;
  }

  // Set a new timer
  loadingDebounceTimer.value = window.setTimeout(() => {
    if (shouldShow && !loadingInProgress.value) {
      startLoading();
    } else if (!shouldShow && loadingInProgress.value) {
      completeLoading();
    }
  }, delay);
};

// Start loading animation
const startLoading = () => {
  loadingInProgress.value = true;
  showOverlay.value = true;

  // For app initialization, we expect the progress to be controlled externally
  // Only animate for navigation operations
  if (loadingState.currentOperation !== 'appInit') {
    progressCounter.value = 10;
    progressInterval = window.setInterval(() => {
      if (progressCounter.value < 90) {
        progressCounter.value += 5;
      }
    }, 200);
  }
};

// Complete loading animation
const completeLoading = () => {
  // Clear interval first
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  // Show 100% completion before hiding
  progressCounter.value = 100;

  // Short delay to show the completed state
  setTimeout(() => {
    showOverlay.value = false;
    loadingInProgress.value = false;
    progressCounter.value = 10;
  }, 500);
};

// Watch for loading state changes with improved responsiveness
watch(
  isLoading,
  (newValue) => {
    // Clear any existing interval
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    // For navigation events, always respond immediately
    if (
      loadingState.currentOperation === 'navigatingToCollection' ||
      loadingState.currentOperation === 'navigatingToImage' ||
      loadingState.currentOperation === 'changingImage' ||
      loadingState.currentOperation === 'navigatingToCollections'
    ) {
      if (newValue) {
        startLoading();
      } else {
        completeLoading();
      }
    } else {
      // Use debounce only for non-navigation loading states
      debounceLoading(newValue);
    }
  },
  { immediate: true },
);

// Create timer to check for app initialization progress
const appInitProgressInterval = setInterval(() => {
  if (loadingState.currentOperation === 'appInit') {
    const progress = localStorage.getItem('appInitProgress');
    if (progress) {
      progressCounter.value = parseInt(progress, 10);
    }
  }
}, 100);

// Clean up on component unmount
onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  if (appInitProgressInterval) {
    clearInterval(appInitProgressInterval);
  }

  if (loadingDebounceTimer.value !== null) {
    window.clearTimeout(loadingDebounceTimer.value);
  }
});
</script>
