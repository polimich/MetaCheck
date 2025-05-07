import { BaseEntityType } from 'src/types/data-access/base.da.ts';
import {
  DetectionDA,
  DetectionHierarchical,
} from 'src/types/data-access/detection.da.ts';
import { MetaRoleDA } from './meta_role.da';
import { ImageDA } from './image.da';

export type MetaElementTypeDA = BaseEntityType & {
  name: string;
  display_name?: string;
};

// Define a more specific type for attributes
export type MetaElementAttributes = {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | MetaElementAttributes
    | Array<
        string | number | boolean | null | undefined | MetaElementAttributes
      >;
};

export type MetaElementDA = BaseEntityType & {
  collection_id: string;
  meta_element_type_id: string;
  parent_id?: string;
  attributes?: MetaElementAttributes;

  // Relations
  meta_element_type?: MetaElementTypeDA;
  parent?: MetaElementDA;
  children?: MetaElementDA[];
};

export type MetaElementDetectionDA = BaseEntityType & {
  meta_element_id: string;
  meta_role_id: string;
  detection_id: string;

  // Relations
  meta_element?: MetaElementDA;
  meta_role?: MetaRoleDA;
  detection?: DetectionDA;
};

export type ImageHierarchical = BaseEntityType &
  ImageDA & {
    detections: DetectionHierarchical[];
  };

export type MetaElementHierarchical = BaseEntityType &
  MetaElementDA & {
    children: MetaElementHierarchical[];
    images: ImageHierarchical[];
  };

export type MetaElementDetectionAttributeTypeDA = BaseEntityType & {
  name: string;
  display_name?: string;
};
