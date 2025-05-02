import { BaseType } from './base';

export type MetaElementTypeType = BaseType & {
  name: string;
  display_name?: string;
};

export type MetaElementAttributes = {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | Array<string | number | boolean | null | undefined>;
};

export type MetaElementType = BaseType & {
  collection_id: string;
  meta_element_type_id: string;
  parent_id?: string;
  attributes?: MetaElementAttributes;

  // Relations
  meta_element_type?: MetaElementTypeType;
  parent?: MetaElementType;
  children?: MetaElementType[];
};
