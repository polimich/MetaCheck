export interface Collection {
  annotated_detection_count: number;
  confidence: number;
  created_date: string;
  deleted: boolean;
  description: string;
  detection_count: number;
  id: string;
  image_count: number;
  info: string;
  last_access: string;
  last_change: string;
  name: string;
  preview_image_height: number;
  preview_image_id: string;
  preview_image_width: number;
  work_state: WorkState;
}

export interface CollectionAddDto {
  description: string;
  id: string;
  info: string;
  name: string;
}

export interface CollectionEditDto {
  deleted?: boolean;
  description?: string;
  id: string;
  info?: string;
  is_public?: boolean;
  last_access?: string;
  name?: string;
  preview_image_id?: string;
  work_state?: WorkState;
}

export enum WorkState {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  FINAL = 'final',
}
