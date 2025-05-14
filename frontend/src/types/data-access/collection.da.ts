// @author Michael Polívka (xpoliv07)
import { BaseEntityType } from 'src/types/data-access/base.da.ts';
import { ImageDA } from 'src/types/data-access/image.da.ts';
import { WorkState } from 'src/types/data-access/enums.ts';
import {
  MetaElementDA,
  MetaElementHierarchical,
} from 'src/types/data-access/meta_element.da.ts';

export type CollectionNewType = {
  id: string;
  name: string;
  description: string;
  info: string;
};

export type CollectionType = BaseEntityType &
  CollectionNewType & {
    confidence?: number;
    work_state: WorkState;
    image_count: number;
    detection_count: number;
    annotated_detection_count: number;
    preview_image_id?: string;
    preview_image_height: number;
    preview_image_width: number;
    meta_elements: MetaElementDA[];
    images: ImageDA[];
  };

export type CollectionUpdateDA = {
  id: string;
  preview_image_id?: string;
  name?: string;
  description?: string;
  info?: string;
  work_state?: WorkState;
  last_access?: string;
  is_public?: boolean;
  deleted?: boolean;
};

export type CollectionHierarchical = BaseEntityType &
  CollectionType & {
    global_structure: MetaElementHierarchical;
  };
