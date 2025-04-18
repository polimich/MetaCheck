// Export composables for better organization and importing
export { useAnnotations } from './useAnnotations';
export { useImageCanvas } from './useImageCanvas';
export { useKonvaEventHandlers } from './useKonvaEventHandlers';
export { useNavigationMode } from './useNavigationMode';
export { useSelectionManagement } from './useSelectionManagement';
export { useSynchronization } from './useSynchronization';
export { useTransformerManagement } from './useTransformerManagement';

// Export interfaces for TypeScript support
export {
  type ImageCanvasState,
  type ImageCanvasActions,
  type ImageDimensions,
  type CanvasPosition,
} from './useImageCanvas';
export { type ImageAnnotatorInstance } from './useSynchronization';
