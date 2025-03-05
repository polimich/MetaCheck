import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { Bbox, DetectionType, DetectionUpdateDto } from 'src/stores';
import { axios, axiosErrorHandler } from 'src/api/index';
import { Annotation } from 'src/service/annotation.ts';
import { DetectionState, ImageState } from 'src/types';
import { useCurrentCollectionState } from 'stores/frontend-state';

export const useImageStore = defineStore('images', () => {
  const currentCollectionState = useCurrentCollectionState();

  const image = ref<ImageState>();
  const detections = ref<DetectionState[]>();
  const loading = ref(false);
  const annotations = ref<Annotation[]>([]);
  const detectionTypes = ref<DetectionType[]>([]);

  const getSortedAnnotations = computed(() => {
    return annotations.value.toSorted((a, b) => {
      return a.created_date > b.created_date ? -1 : 1;
    });
  });

  const init = () => {
    return;
  };
  const loadImage = async (imageId: string, collectionId: string) => {
    loading.value = true;
    if (!currentCollectionState.loaded) {
      await currentCollectionState.loadCollection(collectionId);
    }
    const currentImage = currentCollectionState.getImageById(imageId);
    if (currentImage) {
      image.value = currentImage;
    } else {
      console.error('Image not found');
    }
    loading.value = false;
  };

  const loadDetections = async (imageId: string) => {
    loading.value = true || imageId;
    try {
      detections.value = image.value?.detections;
      annotations.value = detections.value?.map(detectionToAnnotation) || [];
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  const deleteDetection = async (detectionId: string) => {
    loading.value = true;
    try {
      await axios.delete(`/image/detections/${detectionId}`);
      detections.value = detections.value?.filter((d) => d.id !== detectionId);
      annotations.value = annotations.value?.filter(
        (a) => a.id !== detectionId,
      );
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  const updateDetection = async (annotation: Annotation) => {
    loading.value = true;
    try {
      const detection = annotationToDetection(annotation);
      await axios.put('/image/detections', detection);
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  const detectionToAnnotation = (detection: DetectionState): Annotation => {
    const { x, y, width, height } = bboxToObject(detection.bbox);
    const annotation = new Annotation();
    annotation.id = detection.id;
    annotation.x = x;
    annotation.y = y;
    annotation.width = width;
    annotation.height = height;
    annotation.confidence = detection.confidence || 0;
    annotation.annotated = detection.annotated;
    annotation.type = detection.detection_type;
    annotation.color = detection.detection_type.color;
    console.log(annotation);
    return annotation;
  };

  const bboxToObject = (bbox: string): Bbox => {
    const [x, y, width, height] = bbox.split(';').map((v) => parseFloat(v));
    return { x, y, width, height };
  };

  const annotationsToDetections = (): DetectionUpdateDto[] => {
    const detections: DetectionUpdateDto[] = [];
    annotations.value.forEach((annotation) => {
      //TODO: annotation type in new annotation
      if (annotation.type_id === '')
        annotation.type_id = detectionTypes.value[0].id;
      detections.push(annotationToDetection(annotation));
    });
    return detections;
  };

  const objectToBbox = (bbox: Bbox): string => {
    return `${bbox.x};${bbox.y};${bbox.width};${bbox.height}`;
  };

  const annotationToDetection = (
    annotation: Annotation,
  ): DetectionUpdateDto => {
    const bbox: Bbox = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    };
    return {
      id: annotation.id,
      image_id: annotation.image_id,
      type_id: annotation.type_id,
      bbox: objectToBbox(bbox),
      confidence: annotation.confidence,
      annotated: annotation.annotated,
      created_date: annotation.created_date,
      last_change: annotation.last_change,
      last_access: annotation.last_access,
      deleted: annotation.deleted,
    };
  };

  const createOrUpdateDetections = async (imageId: string) => {
    loading.value = true;
    try {
      const data = annotationsToDetections();
      console.log(data);
      await axios.post(`/image/detections/${imageId}/create-or-update`, data);
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  const createDetection = async (annotation: Annotation) => {
    loading.value = true;
    try {
      const detection = annotationToDetection(annotation);
      await axios.post(`/image/detections/${image.value?.id}`, [detection]);
      await loadDetections(annotation.image_id);
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  const loadDetectionTypes = async () => {
    loading.value = true;
    try {
      const { data } = await axios.get('/detection_type');
      detectionTypes.value = data;
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  return {
    image,
    detections,
    annotations,
    init,
    loadImage,
    loadDetections,
    loadDetectionTypes,
    createOrUpdateDetections,
    deleteDetection,
    updateDetection,
    createDetection,

    getSortedAnnotations,
  };
});
