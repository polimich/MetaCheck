import {
  CollectionNewType,
  CollectionUpdateDA,
  CollectionType,
  DetectionDA,
  DetectionNewDA,
  DetectionTypeDA,
  DetectionUpdateDA,
  ImageDA,
  MetaElementDA,
  WorkState,
} from 'src/types/data-access';
import {
  CollectionState,
  DetectionState,
  ImageState,
  META_ELEMENT_TYPES,
  MetaElementState,
  MetaElementTypeState,
} from 'src/types/frontend-state';

// Collection mappers
function CollectionDAtoState(collectionDA: CollectionType): CollectionState {
  const images = collectionDA.images.map((image: ImageDA) =>
    ImageDAtoState(image),
  );

  // Map all meta_elements
  const metaElements = collectionDA.meta_elements.map(
    (metaElement: MetaElementDA) => MetaElementDAtoState(metaElement),
  );

  // Create derived meta element collections based on type_id
  const volumes = metaElements.filter(
    (me: MetaElementState) =>
      me.meta_element_type_id === META_ELEMENT_TYPES.VOLUME,
  );

  const titles = metaElements.filter(
    (me: MetaElementState) =>
      me.meta_element_type_id === META_ELEMENT_TYPES.TITLE,
  );

  const issues = metaElements.filter(
    (me: MetaElementState) =>
      me.meta_element_type_id === META_ELEMENT_TYPES.ISSUE,
  );

  const chapters = metaElements.filter(
    (me: MetaElementState) =>
      me.meta_element_type_id === META_ELEMENT_TYPES.CHAPTER,
  );

  const articles = metaElements.filter(
    (me: MetaElementState) =>
      me.meta_element_type_id === META_ELEMENT_TYPES.ARTICLE,
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
    meta_elements: metaElements,
    volumes: volumes,
    titles: titles,
    issues: issues,
    chapters: chapters,
    articles: articles,
    edited: false,
  };
}

function CollectionStateToDA(
  collectionState: CollectionState,
): CollectionUpdateDA {
  // No meta_elements field in the update, they are updated individually
  return {
    id: collectionState.id,
    name: collectionState.name,
    description: collectionState.description,
    info: collectionState.info,
    work_state: collectionState.work_state as WorkState,
  };
}

function CollectionStateToNewDA(
  collectionState: CollectionState,
): CollectionNewType {
  // No meta_elements field in the new collection, they are added separately
  return {
    id: collectionState.id,
    name: collectionState.name,
    description: collectionState.description,
    info: collectionState.info,
  };
}

// Image mappers
function ImageDAtoState(imageDA: ImageDA): ImageState {
  const detections = imageDA.detections.map((detection: DetectionDA) =>
    DetectionDAtoState(detection),
  );
  const page = imageDA.page_meta_element
    ? MetaElementDAtoState(imageDA.page_meta_element)
    : undefined;
  return {
    id: imageDA.id,
    name: imageDA.name,
    height: imageDA.height,
    width: imageDA.width,
    confidence: imageDA.confidence,
    work_state: imageDA.work_state,
    detection_count: imageDA.detection_count,
    annotated_detection_count: imageDA.annotated_detection_count,
    detections: detections,
    page: page,
    order: imageDA.order,
    edited: false,
    page_index: imageDA.page_index,
    page_index_confidence: imageDA.page_index_confidence,
    page_type: imageDA.page_type,
    page_type_confidence: imageDA.page_type_confidence,
  };
}

// Detection mappers
function DetectionDAtoState(detectionDA: DetectionDA): DetectionState {
  return {
    id: detectionDA.id,
    image_id: detectionDA.image_id,
    ...bboxToObject(detectionDA.bbox),
    confidence: detectionDA.confidence,
    annotated: detectionDA.annotated,
    computed_type: detectionDA.computed_type,
    computed_color: detectionDA.computed_color,
    value: detectionDA.value,
    created_date: detectionDA.created_date,
    last_change: detectionDA.last_change,
    last_access: detectionDA.last_access,
    deleted: detectionDA.deleted,
    edited: false,
    computed_display_type: detectionDA.computed_display_type,
  };
}

type Bbox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const bboxToObject = (bbox: string): Bbox => {
  const [x, y, width, height] = bbox.split(',').map((v) => parseFloat(v));
  return { x, y, width, height };
};

const objectToBbox = (bbox: Bbox): string => {
  return `${bbox.x},${bbox.y},${bbox.width},${bbox.height}`;
};

function DetectionStateToDa(detectionState: DetectionState): DetectionDA {
  return {
    id: detectionState.id,
    image_id: detectionState.image_id,
    annotated: detectionState.annotated,
    confidence: detectionState.confidence,
    value: detectionState.value,
    bbox: objectToBbox({
      x: detectionState.x,
      y: detectionState.y,
      width: detectionState.width,
      height: detectionState.height,
    }),
    created_date: detectionState.created_date ?? new Date(),
    last_change: detectionState.last_change ?? new Date(),
    last_access: detectionState.last_access ?? new Date(),
    deleted: detectionState.deleted ?? false,
    computed_type: detectionState.computed_type,
    computed_color: detectionState.computed_color,
    computed_display_type: detectionState.computed_display_type,
  };
}

function DetectionStateToNewDA(detectionState: DetectionState): DetectionNewDA {
  return {
    id: detectionState.id,
    image_id: detectionState.image_id,
    bbox: objectToBbox({
      x: detectionState.x,
      y: detectionState.y,
      width: detectionState.width,
      height: detectionState.height,
    }),
    value: detectionState.value,
    confidence: detectionState.confidence,
  };
}

function DetectionStateToUpdateDA(
  detectionState: DetectionState,
): DetectionUpdateDA {
  return {
    id: detectionState.id,
    value: detectionState.value,
    image_id: detectionState.image_id,
    annotated: detectionState.annotated,
    confidence: detectionState.confidence,
    bbox: objectToBbox({
      x: detectionState.x,
      y: detectionState.y,
      width: detectionState.width,
      height: detectionState.height,
    }),
    deleted: detectionState.deleted,
  };
}

// Removed PageDAtoState and PageTypeDAtoState as these types are no longer needed

function DetectionTypeStateToDA(
  detectionTypeState: MetaElementTypeState,
): DetectionTypeDA {
  return {
    id: detectionTypeState.id,
    name: detectionTypeState.name,
    color: '', // Add a default value since it's required in DetectionTypeDA
    display_name: detectionTypeState.display_name || '',
    created_date: '',
    last_change: '',
    last_access: '',
    deleted: false,
  };
}

// Meta Element mappers
function MetaElementDAtoState(metaElementDA: MetaElementDA): MetaElementState {
  return {
    id: metaElementDA.id,
    collection_id: metaElementDA.collection_id,
    meta_element_type_id: metaElementDA.meta_element_type_id,
    parent_id: metaElementDA.parent_id,
    attributes: metaElementDA.attributes,
    edited: false,
  };
}

function MetaElementStateToDA(
  metaElementState: MetaElementState,
): MetaElementDA {
  return {
    id: metaElementState.id,
    collection_id: metaElementState.collection_id,
    meta_element_type_id: metaElementState.meta_element_type_id,
    parent_id: metaElementState.parent_id,
    attributes: metaElementState.attributes,
    created_date: '',
    last_change: '',
    last_access: '',
    deleted: false,
  };
}

export {
  CollectionDAtoState,
  CollectionStateToDA,
  CollectionStateToNewDA,
  ImageDAtoState,
  DetectionDAtoState,
  DetectionStateToDa,
  DetectionStateToNewDA,
  DetectionStateToUpdateDA,
  DetectionTypeStateToDA,
  MetaElementDAtoState,
  MetaElementStateToDA,
};
