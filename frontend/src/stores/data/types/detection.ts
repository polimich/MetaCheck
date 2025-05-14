// @author Michael Polívka (xpoliv07)
import { BaseType } from './base';

export type DetectionNewType = {
  id: string;
  image_id: string;
  bbox: string;
  value: string;
  confidence?: number;
};

export type DetectionType = BaseType &
  DetectionNewType & {
    annotated: boolean;
    computed_color: string;
    computed_type: string;
    computed_display_type: string;
  };

export type DetectionUpdateType = Partial<DetectionNewType> & {
  id: string;
  annotated?: boolean;
};
