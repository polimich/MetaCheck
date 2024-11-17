import { v4 as uuidv4 } from 'uuid';
import { UnwrapNestedRefs } from 'vue';
import { Annotator } from 'src/service/annotator.ts';

export class Annotation {
  id = uuidv4();
  image_id = '';
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  confidence = 0;
  annotated = false;
  type = '';
  created_date = Date.now().toString();
  last_change = Date.now().toString();
  last_access = Date.now().toString();
  deleted = false;
}

const createAnnotation = (
  annotator: UnwrapNestedRefs<Annotator> & object,
  imageId: string,
  annotations: Annotation[],
) => {
  console.log('createAnnotation');
  if (annotator.mode !== 'add') return;
  const pointerPosition = annotator.layer.getRelativePointerPosition();
  if (!pointerPosition) return;
  const { x, y } = pointerPosition;
  const newAnnotation = new Annotation();
  newAnnotation.image_id = imageId;
  newAnnotation.x = x > 0 ? x : 0;
  newAnnotation.y = y > 0 ? y : 0;
  annotations.push(newAnnotation);
  annotator.innerToolBox.updateAnnotation(newAnnotation);
  annotator.isAnnotating = true;
};

export { createAnnotation };
