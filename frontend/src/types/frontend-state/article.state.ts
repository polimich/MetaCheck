import { BaseState } from 'src/types/frontend-state/base.state.ts';

export type ArticleState = BaseState & {
  collection_id: string;
};
