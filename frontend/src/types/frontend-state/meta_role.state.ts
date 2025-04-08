import { BaseState } from './base.state';

export type MetaRoleState = BaseState & {
  meta_element_type_id: string;
  meta_attribute_type_id: string;
  name: string;
  display_name: string;
  color: string;
  created_date: string;
  last_change: string;
  last_access: string;
  deleted: boolean;
};
