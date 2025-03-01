import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { DetectionState } from 'src/types/frontend-state/detection.state.ts';

export type ChapterState = BaseState & {
  title: DetectionState;
  sub_title: DetectionState;
  part_number: DetectionState;
  page_index_start: number;
  page_index_end: number;
};
