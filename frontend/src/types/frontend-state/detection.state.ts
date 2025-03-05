import { BaseState } from 'src/types/frontend-state/base.state.ts';

export type DetectionState = BaseState & {
  detection_type: DetectionTypeState;
  bbox: string;
  confidence?: number;
  annotated: boolean;
};

export type DetectionTypeState = BaseState & {
  name: string;
  color: string;
  display_name: string;
};
