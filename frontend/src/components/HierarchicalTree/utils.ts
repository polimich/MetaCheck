/**
 * @author Michael Polívka (xpoliv07)
 */

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
  if (!detection.id || !detection.imageId) {
    return;
  }

  const collectionId = collectionStore.collection?.id;
  if (!collectionId) {
    return;
  }

  try {
    collectionStore.selectImage(detection.imageId);

    const currentRoute = router.currentRoute.value;
    const targetRoute = `/collections/${collectionId}/${detection.imageId}`;
    const alreadyOnTargetRoute =
      currentRoute.params.collectionId === collectionId &&
      currentRoute.params.imageId === detection.imageId;

    if (alreadyOnTargetRoute) {
      imageStore.selectDetection(detection.id);
    } else {
      router.push(targetRoute);
      setTimeout(() => {
        try {
          imageStore.selectDetection(detection.id);
        } catch (err) {
          // Silent fail - detection selection will be retried on route change
        }
      }, 1000);
    }
  } catch (err) {
    const targetRoute = `/collections/${collectionId}/${detection.imageId}`;
    router.push(targetRoute);
  }
};
