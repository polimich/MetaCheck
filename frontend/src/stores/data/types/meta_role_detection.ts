// @author Michael Polívka (xpoliv07)
import { BaseType } from './base';

export type MetaRoleDetectionNew = Partial<BaseType> & {
  meta_element_id: string;
  meta_role_id: string;
  detection_id: string;
};

export type MetaRoleDetection = MetaRoleDetectionNew;

export type MetaRoleDetectionUpdate = Partial<MetaRoleDetectionNew>;
