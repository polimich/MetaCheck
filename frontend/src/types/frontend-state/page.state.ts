import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { DetectionState } from 'src/types/frontend-state/detection.state.ts';
import { PageType } from 'src/types/data-access/page.da.ts';

export type PageState = BaseState & {
  page_index: number;
  page_number: DetectionState;
  page_type: PageTypeDetectionState;
};
export type PageTypeDetectionState = BaseState & {
  confidence?: number;
  value: PageType;
};
