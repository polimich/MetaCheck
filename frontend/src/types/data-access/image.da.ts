// @author Michael Polívka (xpoliv07)
import { BaseEntityType } from 'src/types/data-access/base.da.ts';
import { DetectionDA } from 'src/types/data-access/detection.da.ts';
import { MetaElementDA } from './meta_element.da';

export type ImageDA = BaseEntityType & {
  collection_id: string;
  name: string;
  height: number;
  width: number;
  confidence?: number;
  imagehash: string;
  work_state?: string;
  detection_count: number;
  annotated_detection_count: number;
  detections: DetectionDA[];
  page_meta_element: MetaElementDA;
  order: number;
  page_index: string;
  page_index_confidence: number;
  page_type: string;
  page_type_confidence: number;
};
