import { WorkState } from 'src/types';
import { BaseType } from './base';
import { MetaElementType } from './meta_element';
import { ImageType } from './image';
export type CollectionNewType = {
  id: string;
  name: string;
  description: string;
  info: string;
};

export type CollectionType = BaseType &
  CollectionNewType & {
    confidence?: number;
    work_state: WorkState;
    image_count: number;
    detection_count: number;
    annotated_detection_count: number;
    preview_image_id?: string;
    preview_image_height: number;
    preview_image_width: number;
    meta_elements: MetaElementType[];
    images: ImageType[];
  };

export type CollectionListType = BaseType & CollectionNewType;

export type CollectionUpdateType = Partial<CollectionType>;
