/**
 * @author Michael Polívka (xpoliv07)
 */

// Format confidence as percentage
export const getConfidencePercent = (confidence: number): number => {
  return Math.round((confidence || 0) * 100);
};

// Get confidence color class using Quasar color palette
export const getConfidenceColorClass = (confidence: number): string => {
  if (confidence < 0.5) return 'red-8'; // High priority (low confidence)
  if (confidence < 0.8) return 'orange-8'; // Medium priority
  return 'green-8'; // Low priority (high confidence)
};

// Calculate attention level based on confidence
export const getAttentionLevel = (confidence: number): string => {
  if (confidence < 0.5) return 'high-attention';
  if (confidence < 0.8) return 'medium-attention';
  return 'low-attention';
};
