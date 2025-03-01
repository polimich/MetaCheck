import { BaseDA } from 'src/types/data-access/base.da.ts';

export type DetectionDA = BaseDA & {
  type_id: string;
  bbox: string;
  confidence?: number;
  image_id: string;
  annotated: boolean;
  type: DetectionTypeDA;
};

export type DetectionTypeDA = BaseDA & {
  name: string;
  color: string;
  display_name: string;
};
