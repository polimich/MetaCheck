// @author Michael Polívka (xpoliv07)
import { BaseEntityType } from 'src/types/data-access/base.da.ts';
import { MetaElementDetectionDA } from './meta_element.da';

export type DetectionTypeDA = BaseEntityType & {
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

export type DetectionDA = BaseEntityType &
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

export type DetectionHierarchical = BaseEntityType &
  DetectionDA & {
    meta_element_detection: MetaElementDetectionDA;
  };
