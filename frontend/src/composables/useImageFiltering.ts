// Compatibility layer for older code that still uses useImageFiltering
// This file is deprecated and should be replaced with useFilters

import { useFilters } from './useFilters';

export function useImageFiltering(
  getVerificationStatus: (id: string) => string,
  getAttentionLevel: (id: string) => number,
  needsAttention: (id: string) => boolean,
  hasLowConfidence?: (id: string) => boolean,
  hasMediumConfidence?: (id: string) => boolean,
) {
  // Delegate to the new combined filters composable
  return useFilters(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    getVerificationStatus,
    getAttentionLevel,
    needsAttention,
    hasLowConfidence,
    hasMediumConfidence,
  );
}
