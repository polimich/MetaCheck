/**
 * Event constants for consistent event naming across components
 */

// Annotation events
export const ANNOTATION_EVENTS = {
  SELECT: 'select-annotation',
  SCROLL_TO: 'scroll-to-annotation',
  CREATE: 'create-annotation',
  UPDATE: 'update-annotation',
  DELETE: 'delete-annotation',
  CONFIRM_META: 'confirm-annotation-meta',
  CANCEL_META: 'cancel-annotation-meta',
};

// Image selection events
export const IMAGE_EVENTS = {
  SELECT: 'select-image',
  LOAD: 'load-image',
};

// Toolbar events
export const TOOLBAR_EVENTS = {
  ZOOM_IN: 'zoom-in',
  ZOOM_OUT: 'zoom-out',
  RESET_VIEW: 'reset-view',
  SET_MODE: 'set-mode',
  SAVE: 'save',
  UNDO: 'undo',
  REDO: 'redo',
};
