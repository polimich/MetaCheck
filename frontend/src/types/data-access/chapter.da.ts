import { BaseDA } from './base.da.ts';
import { DetectionDA } from './detection.da.ts';

export type ChapterDA = BaseDA & {
  collection_id: string;
  parent_id: string;
  page_index_start: number;
  page_index_end: number;
  title_id: string;
  sub_title_id: string;
  part_number_id: string;

  title: DetectionDA;
  sub_title: DetectionDA;
  part_number: DetectionDA;
};
