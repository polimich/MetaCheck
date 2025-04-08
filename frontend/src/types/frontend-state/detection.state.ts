import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { v4 as uuidv4 } from 'uuid';

export type MetaRoleOption = {
  id: string;
  label: string;
  value: string;
  color: string;
};

export type DetectionState = BaseState & {
  image_id: string;
  //bbox
  x: number;
  y: number;
  width: number;
  height: number;

  confidence?: number;
  annotated: boolean;
  value: string;
  computed_type: string;
  computed_color: string;
  computed_display_type: string;
  created_date: string;
  last_change: string;
  last_access: string;
  deleted: boolean;

  // Meta role properties
  availableMetaRoles?: MetaRoleOption[];
  loadingMetaRoles?: boolean;
};

export const newDetectionState = (): DetectionState => {
  return {
    id: uuidv4(),
    image_id: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    confidence: 0,
    annotated: false,
    value: '',
    created_date: '',
    last_change: '',
    last_access: '',
    deleted: false,
    edited: true,
    computed_type: '',
    computed_color: '',
    computed_display_type: '',
    availableMetaRoles: [],
    loadingMetaRoles: true,
  };
};
