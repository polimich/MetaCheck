import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { ImageState } from 'src/types/frontend-state/image.state.ts';
import { MetaElementState } from 'src/types/frontend-state/meta_element.state.ts';

export type CollectionState = BaseState & {
  name: string;
  description: string;
  info: string;
  confidence?: number;
  work_state?: string;
  image_count: number;
  detection_count: number;
  annotated_detection_count: number;

  images: ImageState[];
  meta_elements: MetaElementState[];

  // Computed properties based on meta_elements with specific type_ids
  // These are derived from meta_elements and not stored separately in the backend
  volumes?: MetaElementState[];
  titles?: MetaElementState[];
  issues?: MetaElementState[];
  chapters?: MetaElementState[];
  articles?: MetaElementState[];
};
