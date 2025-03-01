import { BaseState } from 'src/types/frontend-state/base.state.ts';
import { ImageState } from 'src/types/frontend-state/image.state.ts';
import { VolumeState } from 'src/types/frontend-state/volume.state.ts';
import { TitleState } from 'src/types/frontend-state/title.state.ts';
import { IssueState } from 'src/types/frontend-state/issue.state.ts';
import { ChapterState } from 'src/types/frontend-state/chapter.state.ts';
import { ArticleState } from 'src/types/frontend-state/article.state.ts';

export type CollectionState = BaseState & {
  name: string;
  description: string;
  info: string;
  confidence?: number;
  work_state?: string;
  image_count: number;
  detection_count: number;
  annotated_detection_count: number;

  images: ImageState[];
  volumes: VolumeState[];
  titles: TitleState[];
  issues: IssueState[];
  chapters: ChapterState[];
  articles: ArticleState[];
};
