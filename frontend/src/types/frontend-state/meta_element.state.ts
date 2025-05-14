// @author Michael Polívka (xpoliv07)
import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { MetaElementAttributes } from 'src/types/data-access/meta_element.da.ts';

export type MetaElementTypeState = BaseState & {
  name: string;
  display_name?: string;
};

export type MetaElementState = BaseState & {
  collection_id: string;
  meta_element_type_id: string;
  parent_id?: string;
  attributes?: MetaElementAttributes;

  // Relations
  meta_element_type?: MetaElementTypeState;
  parent?: MetaElementState;
  children?: MetaElementState[];
};

export const newMetaElementState = (): MetaElementState => {
  return {
    id: '',
    collection_id: '',
    meta_element_type_id: '',
    parent_id: '',
    attributes: {},
    edited: false,
  };
};
// Constants matching backend META_ELEMENT_TYPE_IDS for easier identification
export const META_ELEMENT_TYPES = {
  TITLE: 'e1000000-0000-4000-a000-000000000002',
  VOLUME: 'e1000000-0000-4000-a000-000000000003',
  ISSUE: 'e1000000-0000-4000-a000-000000000004',
  SUPPLEMENT: 'e1000000-0000-4000-a000-000000000005',
  CHAPTER: 'e1000000-0000-4000-a000-000000000006',
  ARTICLE: 'e1000000-0000-4000-a000-000000000007',
};
