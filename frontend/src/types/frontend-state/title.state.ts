import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { DetectionState } from 'src/types/frontend-state/detection.state.ts';

export type TitleState = BaseState & {
  title: DetectionState;
  sub_title: DetectionState;
};
