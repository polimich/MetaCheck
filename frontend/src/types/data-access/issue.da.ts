import { BaseDA } from 'src/types/data-access/base.da.ts';
import { DetectionDA } from 'src/types/data-access/detection.da.ts';

export type IssueDA = BaseDA & {
  collection_id: string;
  parent_id: string;
  part_number_id: string;
  date_issued_id: string;
  title_id: string;
  sub_title_id: string;
  place_term_id: string;
  publishers: DetectionDA[];
  manufactures: DetectionDA[];
  redaktors: DetectionDA[];

  part_number: DetectionDA;
  date_issued: DetectionDA;
  title: DetectionDA;
  sub_title: DetectionDA;
  place_term: DetectionDA;
};
