import { BaseDA } from 'src/types/data-access/base.da.ts';
import { DetectionDA } from 'src/types/data-access/detection.da.ts';

export type TitleDA = BaseDA & {
  collection_id: string;
  title_id: string;
  sub_title_id: string;
  title: DetectionDA;
  sub_title: DetectionDA;
};
