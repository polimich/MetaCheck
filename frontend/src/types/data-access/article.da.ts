import { BaseDA } from './base.da.ts';

export type ArticleDA = BaseDA & {
  collection_id: string;
  parent_id: string;
};
