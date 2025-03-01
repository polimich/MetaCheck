import { BaseDA } from 'src/types/data-access/base.da.ts';
import { ImageDA } from 'src/types/data-access/image.da.ts';
import { VolumeDA } from 'src/types/data-access/volume.da.ts';
import { TitleDA } from 'src/types/data-access/title.da.ts';
import { IssueDA } from 'src/types/data-access/issue.da.ts';
import { ChapterDA } from 'src/types/data-access/chapter.da.ts';
import { ArticleDA } from 'src/types/data-access/article.da.ts';

export type CollectionDA = BaseDA & {
  name: string;
  description: string;
  info: string;
  confidence?: number;
  work_state?: string;
  image_count: number;
  detection_count: number;
  annotated_detection_count: number;

  preview_image_id: string;
  preview_image_height: number;
  preview_image_width: number;

  images: ImageDA[];
  volumes: VolumeDA[];
  titles: TitleDA[];
  issues: IssueDA[];
  chapters: ChapterDA[];
  articles: ArticleDA[];
};
