import { DetectionType } from './detection';
import { MetaElementType } from './meta_element';
import { BaseType } from './base';

export type ImageType = BaseType & {
  collection_id: string;
  name: string;
  height: number;
  width: number;
  confidence?: number;
  imagehash: string;
  work_state?: string;
  detection_count: number;
  annotated_detection_count: number;
  detections: DetectionType[];
  page_meta_element: MetaElementType;
  order: number;
  page_index: string;
  page_index_confidence: number;
  page_type: string;
  page_type_confidence: number;
};
