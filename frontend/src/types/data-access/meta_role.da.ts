import { BaseDA } from './base.da';

export type MetaRoleDA = BaseDA & {
  meta_element_type_id: string;
  meta_attribute_type_id: string;
  computed_name: string;
  computed_display_name: string;
  color: string;
  created_date: string;
  last_change: string;
  last_access: string;
  deleted: boolean;
};
