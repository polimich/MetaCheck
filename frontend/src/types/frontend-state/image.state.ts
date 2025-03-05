import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { DetectionState } from 'src/types/frontend-state/detection.state.ts';
import { PageState } from 'src/types/frontend-state/page.state.ts';

export type ImageState = BaseState & {
  name: string;
  order: number;
  height: number;
  width: number;
  confidence?: number;
  work_state?: string;
  detection_count: number;
  annotated_detection_count: number;

  detections: DetectionState[];
  pages: PageState[];
};

export const newImageState = (): ImageState => {
  return {
    id: '',
    name: '',
    order: 0,
    height: 0,
    width: 0,
    confidence: 0,
    work_state: '',
    detection_count: 0,
    annotated_detection_count: 0,
    detections: [],
    pages: [],
    edited: false,
  };
};
