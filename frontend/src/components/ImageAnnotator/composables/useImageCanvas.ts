import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { Vector2d } from 'konva/lib/types';

// Define interfaces for better dependency inversion and type safety
export interface ImageDimensions {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface ImageCanvasState {
  image: ReturnType<typeof ref<HTMLImageElement | null>>;
  imageUrl: ReturnType<typeof ref<string>>;
  scale: ReturnType<typeof ref<number>>;
  position: CanvasPosition;
  isLoading: ReturnType<typeof ref<boolean>>;
  loadError: ReturnType<typeof ref<string | null>>;
  dimensions: ReturnType<typeof ref<ImageDimensions>>;
  container: ReturnType<typeof ref<HTMLElement | null>>;
  isImageLoaded: ReturnType<typeof computed<boolean>>;
  zoomPercentage: ReturnType<typeof computed<number>>;
  transformStyle: ReturnType<
    typeof computed<{
      transform: string;
      transformOrigin: string;
    }>
  >;
}

export interface ImageCanvasActions {
  loadImage: (url: string) => Promise<void>;
  setContainer: (el: HTMLElement) => void;
  resetView: () => {
    scale: number;
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
  } | void;
  panImage: (delta: Vector2d) => void;
  zoomImage: (delta: number, pointer: Vector2d) => void;
  zoomToPoint: (
    imagePoint: Vector2d,
    newScale: number,
    animate?: boolean,
  ) => void;
  screenToImageCoords: (point: Vector2d) => Vector2d;
  imageToScreenCoords: (point: Vector2d) => Vector2d;
}

// Separate image loading concern
function useImageLoader() {
  const image = ref<HTMLImageElement | null>(null);
  const imageUrl = ref<string>('');
  const isLoading = ref<boolean>(false);
  const loadError = ref<string | null>(null);

  async function loadImage(url: string): Promise<HTMLImageElement> {
    isLoading.value = true;
    loadError.value = null;
    imageUrl.value = url;

    try {
      // Create a new image without replacing the current one yet
      const img = await createImage(url);

      // Only update the image reference once it's fully loaded
      // This allows for a smoother transition
      image.value = img;
      isLoading.value = false;
      return img;
    } catch (error) {
      console.error('Error loading image:', error);
      loadError.value = 'Failed to load image';
      isLoading.value = false;
      throw error;
    }
  }

  // Helper to create image and handle promise
  function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load error'));
      img.src = url;
    });
  }

  return {
    image,
    imageUrl,
    isLoading,
    loadError,
    loadImage,
  };
}

// Separate coordinate transformation concern
function useCoordinateTransformer(
  position: CanvasPosition,
  scale: ReturnType<typeof ref<number>>,
) {
  // Convert screen coordinates to image coordinates
  function screenToImageCoords(point: Vector2d): Vector2d {
    const currentScale = scale.value || 1; // Add fallback
    return {
      x: (point.x - position.x) / currentScale,
      y: (point.y - position.y) / currentScale,
    };
  }

  // Convert image coordinates to screen coordinates
  function imageToScreenCoords(point: Vector2d): Vector2d {
    const currentScale = scale.value || 1; // Add fallback
    return {
      x: point.x * currentScale + position.x,
      y: point.y * currentScale + position.y,
    };
  }

  return {
    screenToImageCoords,
    imageToScreenCoords,
  };
}

// Separate resize observation concern
function useResizeObserver(
  container: ReturnType<typeof ref<HTMLElement | null>>,
  onResize: () => void,
) {
  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    if (container.value) {
      resizeObserver = new ResizeObserver(() => {
        console.log('Container resized, updating scale and position.');
        onResize();
      });

      resizeObserver.observe(container.value);
    } else {
      console.warn(
        'useResizeObserver: Container ref not available on mount for ResizeObserver.',
      );
    }
  });

  onUnmounted(() => {
    if (resizeObserver) {
      console.log('Disconnecting ResizeObserver.');
      resizeObserver.disconnect();
    }
  });

  return {
    resizeObserver,
  };
}

/**
 * Composable for managing image canvas state and operations
 */
export function useImageCanvas() {
  // Use the separated composables
  const {
    image,
    imageUrl,
    isLoading,
    loadError,
    loadImage: loadImageInternal,
  } = useImageLoader();

  // Core state
  const scale = ref<number>(1);
  const position = reactive({ x: 0, y: 0 });

  // Canvas dimensions
  const container = ref<HTMLElement | null>(null);
  const dimensions = ref<ImageDimensions>({
    width: 0,
    height: 0,
    originalWidth: 0,
    originalHeight: 0,
  });

  // Calculate scale AND POSITION to fit image in container
  function updateScaleToFit(): void {
    if (!container.value || !image.value) {
      console.warn(
        '[useImageCanvas] Cannot update scale: container or image is null',
      );
      return;
    }

    const containerWidth = container.value.clientWidth;
    const containerHeight = container.value.clientHeight;

    // Check for zero dimensions to prevent division by zero
    if (containerWidth <= 0 || containerHeight <= 0) {
      console.warn(
        '[useImageCanvas] Cannot update scale: container has zero dimensions',
      );
      return;
    }

    const imageWidth = dimensions.value.originalWidth;
    const imageHeight = dimensions.value.originalHeight;

    if (imageWidth <= 0 || imageHeight <= 0) {
      console.warn(
        '[useImageCanvas] Cannot update scale: image has zero dimensions',
      );
      return;
    }

    // Calculate scale to fit both dimensions
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;

    // Use the smaller scale to ensure image fits entirely, cap at 1:1
    const newScale = Math.min(scaleX, scaleY, 1);

    // Calculate position offset to center the scaled image
    const scaledWidth = imageWidth * newScale;
    const scaledHeight = imageHeight * newScale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;

    console.log(
      `[useImageCanvas] Updating: scale=${newScale}, position=(${offsetX}, ${offsetY}) from container(${containerWidth}, ${containerHeight}), image(${imageWidth}, ${imageHeight})`,
    );

    // Update state
    scale.value = newScale;
    dimensions.value.width = scaledWidth;
    dimensions.value.height = scaledHeight;
    position.x = offsetX;
    position.y = offsetY;
  }

  // Reset view to fit container (scale and position)
  function resetView(): {
    scale: number;
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
  } | void {
    console.log('[useImageCanvas] Reset view called. Current state:', {
      containerExists: !!container.value,
      imageExists: !!image.value,
      currentScale: scale.value,
      currentPosition: { ...position },
      dimensions: { ...dimensions.value },
    });

    if (!container.value) {
      console.error(
        '[useImageCanvas] Cannot reset view: container reference is null',
      );
      return;
    }

    if (!image.value) {
      console.error(
        '[useImageCanvas] Cannot reset view: image reference is null',
      );
      return;
    }

    // Force update the image dimensions if not set
    if (
      dimensions.value.originalWidth <= 0 ||
      dimensions.value.originalHeight <= 0
    ) {
      console.warn('[useImageCanvas] Fixing missing dimensions in resetView');
      dimensions.value.originalWidth = image.value.width || 800;
      dimensions.value.originalHeight = image.value.height || 600;
    }

    // Explicit calculation without using updateScaleToFit to bypass any potential issues
    const containerWidth = container.value.clientWidth || 800;
    const containerHeight = container.value.clientHeight || 600;
    const imageWidth = dimensions.value.originalWidth;
    const imageHeight = dimensions.value.originalHeight;

    // Calculate new scale
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    // Calculate new position
    const scaledWidth = imageWidth * newScale;
    const scaledHeight = imageHeight * newScale;
    const newX = (containerWidth - scaledWidth) / 2;
    const newY = (containerHeight - scaledHeight) / 2;

    // Directly update values
    scale.value = newScale;
    position.x = newX;
    position.y = newY;
    dimensions.value.width = scaledWidth;
    dimensions.value.height = scaledHeight;

    console.log('[useImageCanvas] View reset to:', {
      newScale,
      newPosition: { x: newX, y: newY },
      containerSize: { width: containerWidth, height: containerHeight },
      scaledSize: { width: scaledWidth, height: scaledHeight },
    });

    // Return values that can be used for debugging/confirmation
    return {
      scale: newScale,
      position: { x: newX, y: newY },
      dimensions: { width: scaledWidth, height: scaledHeight },
    };
  }

  // Update canvas dimensions when container changes
  function setContainer(el: HTMLElement): void {
    container.value = el;

    if (dimensions.value.originalWidth > 0) {
      updateScaleToFit();
    }
  }

  // Pan the image
  function panImage(delta: Vector2d): void {
    position.x += delta.x;
    position.y += delta.y;
  }

  // Zoom the image at a specific point
  function zoomImage(delta: number, pointer: Vector2d): void {
    const oldScale = scale.value;
    const scaleBy = delta > 0 ? 0.95 : 1.05; // Invert delta for natural scrolling

    // Calculate new scale with min/max constraints
    const newScale = Math.max(0.1, Math.min(5, oldScale * scaleBy));

    // Don't proceed if scale didn't change
    if (newScale === oldScale) return;

    // Find pointer position relative to image layer's origin (top-left)
    const pointerRelativePos = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    // Calculate new position to keep the pointer location fixed relative to the image
    position.x = pointer.x - pointerRelativePos.x * newScale;
    position.y = pointer.y - pointerRelativePos.y * newScale;

    // Update scale
    scale.value = newScale;

    // Update scaled dimensions (used for potential panning constraints)
    dimensions.value.width = dimensions.value.originalWidth * newScale;
    dimensions.value.height = dimensions.value.originalHeight * newScale;

    console.log(
      `Zoomed to ${newScale}, position to (${position.x}, ${position.y})`,
    );
  }

  // Image loading wrapper - updates dimensions and scale
  async function loadImage(url: string): Promise<void> {
    try {
      // We don't clear the existing image right away for a smoother transition
      isLoading.value = true;

      // Load the new image
      const img = await loadImageInternal(url);

      // Store original dimensions
      dimensions.value.originalWidth = img.width;
      dimensions.value.originalHeight = img.height;

      // Calculate initial scale AND position to fit container
      updateScaleToFit();
    } catch (error) {
      // Error already handled in useImageLoader
      console.error('Image load failure in useImageCanvas');
    }
  }

  // Get coordinate transformers
  const { screenToImageCoords, imageToScreenCoords } = useCoordinateTransformer(
    position,
    scale,
  );

  // Set up resize observer
  useResizeObserver(container, updateScaleToFit);

  // Computed properties
  const transformStyle = computed(() => {
    // This style is for CSS transform if needed, Konva uses layer config
    return {
      transform: `translate(${position.x}px, ${position.y}px) scale(${scale.value})`,
      transformOrigin: '0 0',
    };
  });

  const isImageLoaded = computed(
    () => image.value !== null && !isLoading.value,
  );

  // Current zoom percentage for display
  const zoomPercentage = computed(() => Math.round(scale.value * 100));

  // Zoom to a specific point in the image
  function zoomToPoint(
    imagePoint: Vector2d,
    newScale: number,
    animate = false,
  ): void {
    if (!container.value || !image.value) return;

    // Constrain scale
    const constrainedScale = Math.min(Math.max(newScale, 0.1), 10);

    // Calculate where the point should be after zooming
    const containerWidth = container.value.clientWidth;
    const containerHeight = container.value.clientHeight;

    // Center of container
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;

    // Calculate new position
    const newX = containerCenterX - imagePoint.x * constrainedScale;
    const newY = containerCenterY - imagePoint.y * constrainedScale;

    if (animate) {
      // Use transition for smooth animation
      container.value.style.transition = 'transform 0.5s ease-out';
      setTimeout(() => {
        if (container.value) {
          container.value.style.transition = '';
        }
      }, 500);
    }

    // Update state
    scale.value = constrainedScale;
    position.x = newX;
    position.y = newY;
  }

  return {
    // State
    image,
    imageUrl,
    scale,
    position,
    isLoading,
    loadError,
    dimensions,
    container,
    transformStyle,
    isImageLoaded,
    zoomPercentage,

    // Methods
    loadImage,
    setContainer,
    resetView,
    panImage,
    zoomImage,
    screenToImageCoords,
    imageToScreenCoords,
    zoomToPoint,
  };
}
