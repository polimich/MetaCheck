import { BaseDA } from 'src/types/data-access/base.da.ts';

export type DetectionTypeDA = BaseDA & {
  name: string;
  color: string;
  display_name: string;
};

export type DetectionNewDA = {
  id: string;
  image_id: string;
  bbox: string;
  value: string;
  confidence?: number;
};

export type DetectionDA = BaseDA &
  DetectionNewDA & {
    annotated: boolean;
    computed_color: string;
    computed_type: string;
    computed_display_type: string;
  };

export type DetectionUpdateDA = {
  id: string;
  value?: string;
  image_id?: string;
  annotated?: boolean;
  confidence?: number;
  bbox?: string;
  deleted?: boolean;
};
