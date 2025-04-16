import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { DetectionState } from 'src/types/frontend-state/detection.state.ts';
import { MetaElementState } from './meta_element.state';

export type ImageState = BaseState & {
  name: string;
  height: number;
  width: number;
  confidence?: number;
  work_state?: string;
  detection_count: number;
  annotated_detection_count: number;
  order: number;
  detections: DetectionState[];
  page?: MetaElementState;
  page_index: string;
  page_index_confidence: number;
  page_type: string;
  page_type_confidence: number;
};

export const newImageState = (): ImageState => {
  return {
    id: '',
    name: '',
    height: 0,
    width: 0,
    confidence: 0,
    work_state: '',
    detection_count: 0,
    annotated_detection_count: 0,
    detections: [],
    edited: false,
    order: 0,
    page_index: '',
    page_index_confidence: 0,
    page_type: '',
    page_type_confidence: 0,
  };
};
