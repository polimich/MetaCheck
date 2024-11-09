import { WorkState } from 'src/stores';

export interface Image {
  id: string;
  collection_id: string;
  name: string;
  order: number;
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
