import { BaseDA } from 'src/types/data-access/base.da.ts';
import { DetectionDA } from 'src/types/data-access/detection.da.ts';
import { PageDA } from 'src/types/data-access/page.da.ts';

export type ImageDA = BaseDA & {
  collection_id: string;
  name: string;
  order: number;
  height: number;
  width: number;
  confidence?: number;
  imagehash: string;
  work_state?: string;
  detection_count: number;
  annotated_detection_count: number;

  detections: DetectionDA[];
  pages: PageDA[];
};
