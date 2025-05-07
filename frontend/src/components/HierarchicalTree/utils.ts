// Utility functions for Hierarchical Tree components
import { Router } from 'vue-router';
import { useCollection } from 'src/stores/data/useCollection';
import { useImage } from 'src/stores/data/useImage';

// Define confidence thresholds
export const CONFIDENCE_THRESHOLD_LOW = 0.7; // Below this is critical (red)
export const CONFIDENCE_THRESHOLD_MEDIUM = 0.85; // Below this is warning (orange), above is good (green)

// Helper function to safely get value from a detection
export const getDetectionValue = (detection: unknown): string => {
  if (!detection) return '';
  if (
    typeof detection === 'object' &&
    detection !== null &&
    'value' in detection
  ) {
    return (detection as { value: string }).value || '';
  }
  return '';
};

// Helper function to get confidence from a detection
export const getDetectionConfidence = (detection: unknown): number => {
  if (!detection) return 1;
  if (
    typeof detection === 'object' &&
    detection !== null &&
    'confidence' in detection
  ) {
    const conf = (detection as { confidence?: number }).confidence;
    return conf !== undefined ? conf : 1;
  }
  return 1;
};

// Helper function to get confidence color
export const getConfidenceColor = (confidence: number): string => {
  if (confidence < CONFIDENCE_THRESHOLD_LOW) return 'negative';
  if (confidence < CONFIDENCE_THRESHOLD_MEDIUM) return 'warning';
  return 'positive';
};

// Helper function to format confidence as percentage
export const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`;
};

// Define detection item type for displaying individual detections
export interface DetectionItem {
  id: string;
  imageId: string;
  value: string;
  confidence: number;
}

// Function to navigate to detection helper
export const navigateToDetection = (
  detection: DetectionItem,
  router: Router,
  collectionStore: ReturnType<typeof useCollection>,
  imageStore: ReturnType<typeof useImage>,
) => {
  console.log('[NAVIGATION DEBUG] Starting navigation attempt', {
    detectionId: detection.id,
    imageId: detection.imageId,
    currentRoute: router.currentRoute.value.fullPath,
    currentImageId: imageStore.currentImageId,
  });

  if (!detection.id || !detection.imageId) {
    console.error(
      '[NAVIGATION DEBUG] Cannot navigate: Missing detection id or imageId',
      detection,
    );
    return;
  }

  // Get the current collection ID from the store
  const collectionId = collectionStore.collection?.id;
  console.log('[NAVIGATION DEBUG] Collection ID from store:', collectionId);

  if (!collectionId) {
    console.error(
      '[NAVIGATION DEBUG] Cannot navigate: No collection ID available',
    );
    return;
  }

  try {
    // First select the image in the collection store
    console.log(
      '[NAVIGATION DEBUG] Selecting image in collection store:',
      detection.imageId,
    );
    collectionStore.selectImage(detection.imageId);
    console.log('[NAVIGATION DEBUG] After selecting image in collection store');

    // Check if we're already on the target image
    const currentRoute = router.currentRoute.value;
    const targetRoute = `/collections/${collectionId}/${detection.imageId}`;
    const alreadyOnTargetRoute =
      currentRoute.params.collectionId === collectionId &&
      currentRoute.params.imageId === detection.imageId;

    console.log('[NAVIGATION DEBUG] Navigation info:', {
      currentPath: currentRoute.fullPath,
      targetRoute,
      alreadyOnTargetRoute,
      currentParams: currentRoute.params,
    });

    if (alreadyOnTargetRoute) {
      console.log(
        '[NAVIGATION DEBUG] Already on target route, selecting detection directly',
      );
      // If already on the correct image, just select the detection directly
      imageStore.selectDetection(detection.id);
    } else {
      // Navigate to the correct route: /collections/:collectionId/:imageId
      console.log('[NAVIGATION DEBUG] Navigating to route:', targetRoute);
      router.push(targetRoute);

      // Set a timeout to ensure the image is loaded before selecting the detection
      console.log('[NAVIGATION DEBUG] Setting timeout for detection selection');
      setTimeout(() => {
        try {
          // Select the detection in the image store
          console.log(
            '[NAVIGATION DEBUG] Timeout callback executing - selecting detection:',
            detection.id,
          );
          imageStore.selectDetection(detection.id);
          console.log('[NAVIGATION DEBUG] After selecting detection');
        } catch (err) {
          console.error(
            '[NAVIGATION DEBUG] Error selecting detection after navigation:',
            err,
          );
        }
      }, 1000); // Increased timeout to give more time for image loading
    }
  } catch (err) {
    console.error('[NAVIGATION DEBUG] Error during detection navigation:', err);
    // Try again with just the navigation as a fallback
    const targetRoute = `/collections/${collectionId}/${detection.imageId}`;
    console.log(
      '[NAVIGATION DEBUG] Attempting fallback navigation to:',
      targetRoute,
    );
    router.push(targetRoute);
  }
};
