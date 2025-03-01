export type BaseDA = {
  id: string;
  created_date: string;
  last_change: string;
  last_access: string;
  deleted: boolean;
};

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

export type ImageDA = BaseDA & {
  collection_id: string;
  name: string;
  order: number;
  height: number;
  width: number;
  confidence?: number;
  imagehash: string;
  work_state?: string;
  detection_count: number;
  annotated_detection_count: number;

  detections: DetectionDA[];
  pages: PageDA[];
};

export type DetectionDA = BaseDA & {
  type_id: string;
  bbox: string;
  confidence?: number;
  image_id: string;
  annotated: boolean;
};

export type VolumeDA = BaseDA & {
  collection_id: string;
  parent_id: string;
  part_number_id: string;
  part_name_id: string;
  date_issued_id: string;
  title_id: string;
  sub_title_id: string;
  edition_id: string;
  place_term_id: string;
  series_name_id: string;
  series_number_id: string;

  publishers: DetectionDA[];
  manufacture_publishers: DetectionDA[];
  manufacture_place_terms: DetectionDA[];
  authors: DetectionDA[];
  illustrators: DetectionDA[];
  translators: DetectionDA[];
  editors: DetectionDA[];

  part_number: DetectionDA;
  part_name: DetectionDA;
  date_issued: DetectionDA;
  title: DetectionDA;
  sub_title: DetectionDA;
  edition: DetectionDA;
  place_term: DetectionDA;
  series_name: DetectionDA;
  series_number: DetectionDA;
};

export type TitleDA = BaseDA & {
  collection_id: string;
  title_id: string;
  sub_title_id: string;
  title: DetectionDA;
  sub_title: DetectionDA;
};
export type IssueDA = BaseDA & {
  collection_id: string;
  parent_id: string;
  part_number_id: string;
  date_issued_id: string;
  title_id: string;
  sub_title_id: string;
  place_term_id: string;
  publishers: DetectionDA[];
  manufactures: DetectionDA[];
  redaktors: DetectionDA[];

  part_number: DetectionDA;
  date_issued: DetectionDA;
  title: DetectionDA;
  sub_title: DetectionDA;
  place_term: DetectionDA;
};
export type ChapterDA = BaseDA & {
  collection_id: string;
  parent_id: string;
  page_index_start: number;
  page_index_end: number;
  title_id: string;
  sub_title_id: string;
  part_number_id: string;

  title: DetectionDA;
  sub_title: DetectionDA;
  part_number: DetectionDA;
};
export type ArticleDA = BaseDA & {
  collection_id: string;
  parent_id: string;
};
export type PageDA = BaseDA & {
  image_id: string;
  batch_id: string;
  parent_id: string;
  page_index: number;
  page_number_id: string;
  page_type_id: string;

  page_number: DetectionDA;
  page_type: DetectionDA;
};
