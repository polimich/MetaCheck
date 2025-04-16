/**
 * Utility functions for handling bounding box formats
 */

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Parse a bbox string into a structured object
 * Handles various formats from the API
 * Returns default values for empty, null, or undefined bbox (for page number detections)
 */
export const parseBbox = (bbox: string | null | undefined): BoundingBox => {
  if (bbox && bbox.includes(',')) {
    const parts = bbox.split(',').map((part) => parseFloat(part.trim()));
    if (parts.length >= 4 && !parts.some(isNaN)) {
      return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
      };
    }
  }
  return { x: 0, y: 0, width: 0, height: 0 };
};

/**
 * Format a bounding box object to a standard string format
 */
export const formatBbox = (bbox: BoundingBox): string => {
  return `${bbox.x},${bbox.y},${bbox.width},${bbox.height}`;
};

/**
 * Normalize any bbox string to a standard format
 * Returns null for null/empty inputs (for page number detections)
 */
export const normalizeBbox = (
  bbox: string | null | undefined,
): string | null => {
  // Return null for null/undefined/empty inputs - valid for page number detections
  if (bbox === null || bbox === undefined || bbox === '') {
    return '';
  }
  return formatBbox(parseBbox(bbox));
};
