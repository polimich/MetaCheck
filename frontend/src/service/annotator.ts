import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { Transformer } from 'konva/lib/shapes/Transformer';
import { Annotation } from './annotation';
import { UnwrapNestedRefs } from 'vue';
class ImageInfo {
  element!: HTMLImageElement;
  width = 0;
  height = 0;
}

class InnerToolBox {
  public boxStyle = 'display:none;';
  private annotation = new Annotation();

  public getAnnotationId(): string {
    return this.annotation.id;
  }

  public updateAnnotation(annotation: Annotation): void {
    this.annotation = annotation;
  }

  public show(mouseEvent: MouseEvent): void {
    const offsetFormX = mouseEvent.offsetX;
    const offsetFromY = mouseEvent.offsetY;
    this.boxStyle = `left:${offsetFormX}px;top:${offsetFromY}px;`;
  }
  public hide(): void {
    this.boxStyle = 'display:none;';
  }
}

class Annotator {
  mode = '';
  isAnnotating = false;
  innerToolBox = new InnerToolBox();
  // konva settings
  imageScale = 1;
  stage: Stage = new Stage({ container: document.createElement('div') });
  stageConfig = { id: 'stage', width: 1, height: 1 };
  layer: Layer = new Layer();
  layerConfig = { id: 'layer', draggable: true, scaleX: 1, scaleY: 1 };

  imageConfig = {
    image: new Image(),
    scaleX: this.imageScale,
    scaleY: this.imageScale,
  };
  transformer: Transformer = new Transformer();
  transformerConfig = {
    id: 'transformer',
    rotateEnabled: true,
    enabledAnchors: [
      'top-left',
      'top-center',
      'top-right',
      'bottom-center',
      'bottom-left',
      'bottom-right',
      'middle-right',
      'middle-left',
    ],
    ignoreStroke: true,
  };

  public async initImageSetting(container: Element, imageUrl: string) {
    const { element, width, height } = await getImageData(imageUrl);
    this.imageScale = Math.min(
      container.clientWidth / width,
      container.clientHeight / height,
    );
    this.stageConfig.width = width * this.imageScale;
    this.stageConfig.height = height * this.imageScale;
    this.layerConfig.scaleX = this.imageScale;
    this.layerConfig.scaleY = this.imageScale;
    this.imageConfig = {
      image: element,
      scaleX: 1,
      scaleY: 1,
    };
  }

  // eslint-disable-next-line
  public initCanvas(stageRef: any): void {
    this.stage = stageRef.getStage();
    this.layer = this.stage.findOne('Layer') as Layer;
    this.transformer = this.stage.findOne('#transformer') as Transformer;
    this.transformer.nodes([]);
    this.innerToolBox.hide();
    this.changeAnnotateMode('add');
  }

  public changeAnnotateMode(mode: string): void {
    switch (mode) {
      case 'drag':
        this.layer.setAttrs({ draggable: true });
        document.body.style.cursor = 'grab';
        this.mode = 'drag';
        break;
      case 'add':
        this.layer.setAttrs({ draggable: false });
        document.body.style.cursor = 'crosshair';
        this.mode = 'add';
        break;
      default:
        console.log('out of case');
    }
  }
}

async function getImageData(url: string): Promise<ImageInfo> {
  const image = await loadImage(url);
  return {
    element: image,
    height: image.height,
    width: image.width,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = () => reject('image loading error');
  });
}

// helper functions

function enterAnnotatorBox(annotatorBox: HTMLDivElement | null) {
  if (!annotatorBox) return;
  annotatorBox.focus();
}

function leaveAnnotatorBox(annotator: UnwrapNestedRefs<Annotator> & object) {
  document.body.style.cursor = 'auto';
  annotator.innerToolBox.hide();
  // save annotation to database
}

export { Annotation, Annotator, enterAnnotatorBox, leaveAnnotatorBox };
