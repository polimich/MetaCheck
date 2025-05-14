// @author Michael Polívka (xpoliv07)
import { useFilters } from './useFilters';

/**
 * Configuration object for filtering functions
 */
export interface FilteringFunctions {
  getVerificationStatus: (id: string) => string;
  getAttentionLevel: (id: string) => number;
  needsAttention: (id: string) => boolean;
  hasLowConfidence?: (id: string) => boolean;
  hasMediumConfidence?: (id: string) => boolean;
}

/**
 * A cleaner wrapper around useFilters that only requires the filtering functions
 * This is for components that only need filtering capabilities, not UI binding
 */
export function useFilteringFunctions({
  getVerificationStatus,
  getAttentionLevel,
  needsAttention,
  hasLowConfidence,
  hasMediumConfidence,
}: FilteringFunctions) {
  return useFilters(
    undefined, // initialSortBy
    undefined, // initialFilterVerified
    undefined, // initialConfidenceFilters
    undefined, // updateSortBy
    undefined, // updateFilterVerified
    undefined, // updateConfidenceFilters
    getVerificationStatus,
    getAttentionLevel,
    needsAttention,
    hasLowConfidence,
    hasMediumConfidence,
  );
}
