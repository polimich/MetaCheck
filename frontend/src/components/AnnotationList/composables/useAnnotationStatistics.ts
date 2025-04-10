import { computed, Ref } from 'vue';
import { DetectionState } from 'src/types/frontend-state';

export interface AnnotationStatistics {
  total: number;
  verified: number;
  unverified: number;
  edited: number;
  lowConfidence: number;
  mediumConfidence: number;
  highConfidence: number;
}

export const useAnnotationStatistics = (detections: Ref<DetectionState[]>) => {
  const statistics = computed<AnnotationStatistics>(() => {
    const total = detections.value.length;
    const verified = detections.value.filter((d) => d.annotated).length;
    const unverified = total - verified;
    const edited = detections.value.filter((d) => d.edited).length;

    const lowConfidence = detections.value.filter(
      (d) => (d.confidence ?? 0) < 0.5,
    ).length;
    const mediumConfidence = detections.value.filter((d) => {
      const conf = d.confidence ?? 0;
      return conf >= 0.5 && conf < 0.8;
    }).length;
    const highConfidence = detections.value.filter(
      (d) => (d.confidence ?? 0) >= 0.8,
    ).length;

    return {
      total,
      verified,
      unverified,
      edited,
      lowConfidence,
      mediumConfidence,
      highConfidence,
    };
  });

  return {
    statistics,
  };
};
