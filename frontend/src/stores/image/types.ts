import { WorkState } from 'src/types/data-access';

export interface Image {
  id: string;
  collection_id: string;
  name: string;
  height: number;
  width: number;

  confidence?: number;
  imagehash?: string;
  work_state?: WorkState;

  detection_count: number;
  annotated_detection_count: number;

  created_date: string;
  last_change: string;
  last_access: string;

  deleted: boolean;
}

export interface ImageAddDto {
  collection_id: string;
  order: number;
  file?: File;
}

export interface Detection {
  id: string;
  image_id: string;
  type_id: string;
  type: DetectionType;
  bbox: string;
  confidence: number;
  annotated: boolean;
  created_date: string;
  last_change: string;
  last_access: string;
  deleted: boolean;
}

export interface DetectionUpdateDto {
  id: string;
  image_id: string;
  type_id: string;
  bbox: string;
  confidence: number;
  annotated: boolean;
  created_date: string;
  last_change: string;
  last_access: string;
  deleted: boolean;
}

export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionType {
  id: string;
  name: string;
  color: string;
  display_name: string;
}
