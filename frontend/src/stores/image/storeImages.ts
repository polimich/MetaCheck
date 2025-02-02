import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Bbox, Detection, DetectionType, Image } from 'src/stores';
import { axios, axiosErrorHandler } from 'src/api/index';
import { Annotation } from 'src/service/annotation.ts';
import { getAnnotationColor } from 'utils';

export const useImageStore = defineStore('images', () => {
  const image = ref<Image>();
  const detections = ref<Detection[]>();
  const loading = ref(false);
  const annotations = ref<Annotation[]>([]);
  const detectionTypes = ref<DetectionType[]>([]);

  const init = () => {
    return;
  };
  const loadImage = async (imageId: string) => {
    loading.value = true;
    try {
      const { data } = await axios.get(`/image/${imageId}`);
      image.value = data;
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  const loadDetections = async (imageId: string) => {
    loading.value = true;
    try {
      const { data } = await axios.get(`/image/detections/${imageId}`);
      detections.value = data;
      annotations.value = detections.value?.map(detectionToAnnotation) || [];
      await loadDetectionTypes();
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

  const detectionToAnnotation = (detection: Detection): Annotation => {
    const { x, y, width, height } = bboxToObject(detection.bbox);
    const annotation = new Annotation();
    annotation.id = detection.id;
    annotation.x = x;
    annotation.y = y;
    annotation.width = width;
    annotation.height = height;
    annotation.confidence = detection.confidence;
    annotation.annotated = detection.annotated;
    annotation.created_date = detection.created_date;
    annotation.last_change = detection.last_change;
    annotation.last_access = detection.last_access;
    annotation.deleted = detection.deleted;
    annotation.image_id = detection.image_id;
    annotation.type = detection.type;
    annotation.color = getAnnotationColor(detection.type);
    return annotation;
  };

  const bboxToObject = (bbox: string): Bbox => {
    const [x, y, width, height] = bbox.split(';').map((v) => parseFloat(v));
    return { x, y, width, height };
  };

  const annotationsToDetections = (): Detection[] => {
    const detections: Detection[] = [];
    annotations.value.forEach((annotation) => {
      detections.push(annotationToDetection(annotation));
    });
    return detections;
  };

  const objectToBbox = (bbox: Bbox): string => {
    return `${bbox.x};${bbox.y};${bbox.width};${bbox.height}`;
  };

  const annotationToDetection = (annotation: Annotation): Detection => {
    const bbox: Bbox = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    };
    return {
      id: annotation.id,
      image_id: annotation.image_id,
      type: annotation.type,
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
      await axios.post(
        `/image/detections/${imageId}/create-or-update`,
        annotationsToDetections(),
      );
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
      const { data } = await axios.get('/detection_types');
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
  };
});
