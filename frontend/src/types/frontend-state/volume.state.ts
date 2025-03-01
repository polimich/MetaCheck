import { DetectionState } from 'src/types/frontend-state/detection.state.ts';
import { BaseState } from 'src/types/frontend-state/base.state.ts';

export type VolumeState = BaseState & {
  part_number?: DetectionState;
  part_name?: DetectionState;
  date_issued?: DetectionState;
  title?: DetectionState;
  sub_title?: DetectionState;
  edition?: DetectionState;
  place_term?: DetectionState;
  series_name?: DetectionState;
  series_number?: DetectionState;

  publishers: DetectionState[];
  manufacture_publishers: DetectionState[];
  manufacture_place_terms: DetectionState[];
  authors: DetectionState[];
  illustrators: DetectionState[];
  translators: DetectionState[];
  editors: DetectionState[];
};
