import { ref, computed, onMounted, onUnmounted } from 'vue';

// Define NavigationMode type for better type safety
export type NavigationModeType = 'add' | 'drag';

// Define interfaces for better dependency inversion
export interface NavigationModeState {
  mode: ReturnType<typeof ref<NavigationModeType>>;
  altKeyPressed: ReturnType<typeof ref<boolean>>;
  isSpacebarPanning: ReturnType<typeof ref<boolean>>;
  getCursorStyle: ReturnType<typeof computed<string>>;
}

export interface NavigationModeActions {
  setMode: (newMode: NavigationModeType) => void;
  toggleMode: () => void;
  startSpacebarPan: () => void;
  stopSpacebarPan: () => void;
}

// Separate keyboard state management
function useKeyboardState() {
  const altKeyPressed = ref(false);

  // Handle key down events
  function handleAltKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Alt') {
      altKeyPressed.value = true;
    }
  }

  // Handle key up events
  function handleAltKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Alt') {
      altKeyPressed.value = false;
    }
  }

  // Setup and cleanup event listeners
  onMounted(() => {
    window.addEventListener('keydown', handleAltKeyDown);
    window.addEventListener('keyup', handleAltKeyUp);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleAltKeyDown);
    window.removeEventListener('keyup', handleAltKeyUp);
  });

  return {
    altKeyPressed,
  };
}

/**
 * Composable for managing navigation modes (add/drag) and keyboard state
 */
export function useNavigationMode() {
  // Use the keyboard state composable
  const { altKeyPressed } = useKeyboardState();

  // Core state
  const mode = ref<NavigationModeType>('add');
  const previousMode = ref<NavigationModeType>('add');
  const isSpacebarPanning = ref(false);

  // Change mode
  function setMode(newMode: NavigationModeType): void {
    if (!isSpacebarPanning.value) {
      previousMode.value = mode.value;
    }
    mode.value = newMode;
    console.log(`Mode set to: ${mode.value}`);
  }

  // Toggle between modes
  function toggleMode(): void {
    setMode(mode.value === 'add' ? 'drag' : 'add');
  }

  // Function to activate panning via spacebar
  function startSpacebarPan() {
    if (isSpacebarPanning.value || mode.value === 'drag') return;

    console.log('Starting spacebar pan');
    previousMode.value = mode.value;
    isSpacebarPanning.value = true;
    mode.value = 'drag';
  }

  // Function to deactivate panning via spacebar
  function stopSpacebarPan() {
    if (!isSpacebarPanning.value) return;

    console.log('Stopping spacebar pan, returning to:', previousMode.value);
    isSpacebarPanning.value = false;
    mode.value = previousMode.value;
  }

  // Get appropriate cursor style based on current mode and key state
  const getCursorStyle = computed(() => {
    if (altKeyPressed.value) {
      return 'zoom-in';
    }
    switch (mode.value) {
      case 'add':
        return 'crosshair';
      case 'drag':
        return 'grab';
      default:
        return 'default';
    }
  });

  return {
    mode,
    altKeyPressed,
    isSpacebarPanning,
    setMode,
    toggleMode,
    startSpacebarPan,
    stopSpacebarPan,
    getCursorStyle,
  };
}
