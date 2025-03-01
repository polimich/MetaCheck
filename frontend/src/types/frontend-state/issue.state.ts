import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { DetectionState } from 'src/types/frontend-state/detection.state.ts';

export type IssueState = BaseState & {
  part_number: DetectionState;
  date_issued: DetectionState;
  title: DetectionState;
  sub_title: DetectionState;
  place_term: DetectionState;
  publishers: DetectionState[];
  manufactures: DetectionState[];
  redaktors: DetectionState[];
};
