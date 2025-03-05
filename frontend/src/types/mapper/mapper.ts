import {
  ArticleDA,
  ChapterDA,
  CollectionDA,
  DetectionDA,
  DetectionTypeDA,
  ImageDA,
  IssueDA,
  PageDA,
  PageTypeDetectionDA,
  TitleDA,
  VolumeDA,
} from 'src/types/data-access';
import {
  ArticleState,
  ChapterState,
  CollectionState,
  DetectionState,
  DetectionTypeState,
  ImageState,
  IssueState,
  PageState,
  PageTypeDetectionState,
  TitleState,
  VolumeState,
} from 'src/types/frontend-state';

function CollectionDAtoState(collectionDA: CollectionDA): CollectionState {
  const images = collectionDA.images.map((image) => ImageDAtoState(image));
  const volumes = collectionDA.volumes.map((volume) => VolumeDAtoState(volume));
  const titles = collectionDA.titles.map((title) => TitleDAtoState(title));
  const issues = collectionDA.issues.map((issue) => IssueDAtoState(issue));
  const chapters = collectionDA.chapters.map((chapter) =>
    ChapterDAtoState(chapter),
  );
  const articles = collectionDA.articles.map((article) =>
    ArticleDAtoState(article),
  );

  return {
    id: collectionDA.id,
    name: collectionDA.name,
    description: collectionDA.description,
    info: collectionDA.info,
    confidence: collectionDA.confidence,
    work_state: collectionDA.work_state,
    image_count: collectionDA.image_count,
    detection_count: collectionDA.detection_count,
    annotated_detection_count: collectionDA.annotated_detection_count,
    images: images,
    volumes: volumes,
    titles: titles,
    issues: issues,
    chapters: chapters,
    articles: articles,
    edited: false,
  };
}

function ImageDAtoState(imageDA: ImageDA): ImageState {
  const detections = imageDA.detections.map((detection) =>
    DetectionDAtoState(detection),
  );
  const pages = imageDA.pages?.map((page) => PageDAtoState(page));
  return {
    id: imageDA.id,
    name: imageDA.name,
    order: imageDA.order,
    height: imageDA.height,
    width: imageDA.width,
    confidence: imageDA.confidence,
    work_state: imageDA.work_state,
    detection_count: imageDA.detection_count,
    annotated_detection_count: imageDA.annotated_detection_count,
    detections: detections,
    pages: pages,
    edited: false,
  };
}

function DetectionDAtoState(detectionDA: DetectionDA): DetectionState {
  return {
    id: detectionDA.id,
    image_id: detectionDA.image_id,
    ...bboxToObject(detectionDA.bbox),
    confidence: detectionDA.confidence,
    annotated: detectionDA.annotated,
    type_id: detectionDA.type_id,
    type: DetectionTypeDAtoState(detectionDA.type),

    created_date: detectionDA.created_date,
    last_change: detectionDA.last_change,
    last_access: detectionDA.last_access,
    deleted: detectionDA.deleted,
    color: detectionDA.type.color,
    edited: false,
  };
}
type Bbox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const bboxToObject = (bbox: string): Bbox => {
  const [x, y, width, height] = bbox.split(';').map((v) => parseFloat(v));
  return { x, y, width, height };
};

const objectToBbox = (bbox: Bbox): string => {
  return `${bbox.x};${bbox.y};${bbox.width};${bbox.height}`;
};

function DetectionTypeDAtoState(detectionTypeDA: DetectionTypeDA) {
  return {
    id: detectionTypeDA.id,
    name: detectionTypeDA.name,
    color: detectionTypeDA.color,
    display_name: detectionTypeDA.display_name,
    edited: false,
  };
}

function PageDAtoState(pageDA: PageDA): PageState {
  return {
    id: pageDA.id,
    page_index: pageDA.page_index,
    page_number: DetectionDAtoState(pageDA.page_number),
    page_type: PageTypeDAtoState(pageDA.page_type),
    edited: false,
  };
}

function PageTypeDAtoState(
  pageTypeDA: PageTypeDetectionDA,
): PageTypeDetectionState {
  return {
    id: pageTypeDA.id,
    value: pageTypeDA.value,
    confidence: pageTypeDA.confidence,
    edited: false,
  };
}

function VolumeDAtoState(volumeDA: VolumeDA): VolumeState {
  return {
    id: volumeDA.id,
    part_number: volumeDA.part_number
      ? DetectionDAtoState(volumeDA.part_number)
      : undefined,
    part_name: volumeDA.part_name
      ? DetectionDAtoState(volumeDA.part_name)
      : undefined,
    date_issued: volumeDA.date_issued
      ? DetectionDAtoState(volumeDA.date_issued)
      : undefined,
    title: volumeDA.title ? DetectionDAtoState(volumeDA.title) : undefined,
    sub_title: volumeDA.sub_title
      ? DetectionDAtoState(volumeDA.sub_title)
      : undefined,
    edition: volumeDA.edition
      ? DetectionDAtoState(volumeDA.edition)
      : undefined,
    place_term: volumeDA.place_term
      ? DetectionDAtoState(volumeDA.place_term)
      : undefined,
    series_name: volumeDA.series_name
      ? DetectionDAtoState(volumeDA.series_name)
      : undefined,
    series_number: volumeDA.series_number
      ? DetectionDAtoState(volumeDA.series_number)
      : undefined,
    publishers: volumeDA.publishers.map((publisher) =>
      DetectionDAtoState(publisher),
    ),
    manufacture_publishers: volumeDA.manufacture_publishers.map((publisher) =>
      DetectionDAtoState(publisher),
    ),
    manufacture_place_terms: volumeDA.manufacture_place_terms.map((term) =>
      DetectionDAtoState(term),
    ),
    authors: volumeDA.authors.map((author) => DetectionDAtoState(author)),
    illustrators: volumeDA.illustrators.map((illustrator) =>
      DetectionDAtoState(illustrator),
    ),
    translators: volumeDA.translators.map((translator) =>
      DetectionDAtoState(translator),
    ),
    editors: volumeDA.editors.map((editor) => DetectionDAtoState(editor)),
    edited: false,
  };
}

function TitleDAtoState(titleDA: TitleDA): TitleState {
  return {
    id: titleDA.id,
    title: DetectionDAtoState(titleDA.title),
    sub_title: DetectionDAtoState(titleDA.sub_title),
    edited: false,
  };
}

function IssueDAtoState(issueDA: IssueDA): IssueState {
  return {
    id: issueDA.id,
    part_number: DetectionDAtoState(issueDA.part_number),
    date_issued: DetectionDAtoState(issueDA.date_issued),
    title: DetectionDAtoState(issueDA.title),
    sub_title: DetectionDAtoState(issueDA.sub_title),
    place_term: DetectionDAtoState(issueDA.place_term),
    publishers: issueDA.publishers.map((publisher) =>
      DetectionDAtoState(publisher),
    ),
    manufactures: issueDA.publishers.map((manufacturer) =>
      DetectionDAtoState(manufacturer),
    ),
    redaktors: issueDA.redaktors.map((redaktor) =>
      DetectionDAtoState(redaktor),
    ),
    edited: false,
  };
}

function ChapterDAtoState(chapterDA: ChapterDA): ChapterState {
  return {
    id: chapterDA.id,
    title: DetectionDAtoState(chapterDA.title),
    sub_title: DetectionDAtoState(chapterDA.sub_title),
    part_number: DetectionDAtoState(chapterDA.part_number),
    page_index_start: chapterDA.page_index_start,
    page_index_end: chapterDA.page_index_end,
    edited: false,
  };
}

function ArticleDAtoState(articleDA: ArticleDA): ArticleState {
  return {
    id: articleDA.id,
    collection_id: articleDA.collection_id,
    edited: false,
  };
}

function DetectionStateToDa(detectionState: DetectionState): DetectionDA {
  return {
    id: detectionState.id,
    image_id: detectionState.image_id,
    bbox: objectToBbox({
      x: detectionState.x,
      y: detectionState.y,
      width: detectionState.width,
      height: detectionState.height,
    }),
    confidence: detectionState.confidence,
    annotated: detectionState.annotated,
    type_id: detectionState.type_id,
    type: DetectionTypeStateToDA(detectionState.type),

    created_date: detectionState.created_date,
    last_change: detectionState.last_change,
    last_access: detectionState.last_access,
    deleted: detectionState.deleted,
  };
}

function DetectionTypeStateToDA(
  detectionTypeState: DetectionTypeState,
): DetectionTypeDA {
  return {
    id: detectionTypeState.id,
    name: detectionTypeState.name,
    color: detectionTypeState.color,
    display_name: detectionTypeState.display_name,
    created_date: '',
    last_change: '',
    last_access: '',
    deleted: false,
  };
}

export {
  CollectionDAtoState,
  ImageDAtoState,
  DetectionDAtoState,
  PageDAtoState,
  PageTypeDAtoState,
  VolumeDAtoState,
  TitleDAtoState,
  IssueDAtoState,
  ChapterDAtoState,
  ArticleDAtoState,
  //
  DetectionStateToDa,
};
