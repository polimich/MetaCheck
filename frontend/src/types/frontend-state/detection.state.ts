import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { v4 as uuidv4 } from 'uuid';

export type DetectionState = BaseState & {
  image_id: string;
  //bbox
  x: number;
  y: number;
  width: number;
  height: number;

  confidence?: number;
  annotated: boolean;
  type_id: string;
  type: DetectionTypeState;

  created_date: string;
  last_change: string;
  last_access: string;
  deleted: boolean;
  color: string;
};

export type DetectionTypeState = BaseState & {
  name: string;
  color: string;
  display_name: string;
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
    type_id: '',
    type: newDetectionTypeState(),
    created_date: '',
    last_change: '',
    last_access: '',
    deleted: false,
    color: '',
    edited: true,
  };
};

const newDetectionTypeState = (): DetectionTypeState => {
  return {
    id: uuidv4(),
    name: '',
    color: '',
    display_name: '',

    edited: false,
  };
};
