import { BaseDA } from 'src/types/data-access/base.da.ts';
import { DetectionDA } from 'src/types/data-access/detection.da.ts';

export type VolumeDA = BaseDA & {
  collection_id: string;
  parent_id: string;
  part_number_id: string;
  part_name_id: string;
  date_issued_id: string;
  title_id: string;
  sub_title_id: string;
  edition_id: string;
  place_term_id: string;
  series_name_id: string;
  series_number_id: string;

  publishers: DetectionDA[];
  manufacture_publishers: DetectionDA[];
  manufacture_place_terms: DetectionDA[];
  authors: DetectionDA[];
  illustrators: DetectionDA[];
  translators: DetectionDA[];
  editors: DetectionDA[];

  part_number?: DetectionDA;
  part_name?: DetectionDA;
  date_issued?: DetectionDA;
  title?: DetectionDA;
  sub_title?: DetectionDA;
  edition?: DetectionDA;
  place_term?: DetectionDA;
  series_name?: DetectionDA;
  series_number?: DetectionDA;
};
