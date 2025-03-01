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
