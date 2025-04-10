import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { Transformer } from 'konva/lib/shapes/Transformer';
import { UnwrapNestedRefs } from 'vue';
import { DetectionState, newDetectionState } from 'src/types';
import { Node } from 'konva/lib/Node';
import { NodeConfig } from 'konva/lib/Node';
import Konva from 'konva';

// Stores image dimensions and element for rendering
class ImageInfo {
  element!: HTMLImageElement;
  width = 0;
  height = 0;
}

// Controls the toolbox that appears when an annotation is selected
class InnerToolBox {
  public boxStyle = 'display:none;';
  private annotation = newDetectionState();
  private visible = false;
  private annotator: Annotator | null = null;

  constructor(annotator: Annotator) {
    this.annotator = annotator;
  }

  public getAnnotationId(): string {
    return this.annotation.id;
  }

  public updateAnnotation(annotation: DetectionState): void {
    this.annotation = annotation;
  }

  public show(mouseEvent: MouseEvent): void {
    // Don't show toolbox when in drag mode
    if (this.visible || (this.annotator && this.annotator.mode === 'drag'))
      return;

    const offsetFormX = mouseEvent.offsetX;
    const offsetFromY = mouseEvent.offsetY;
    this.boxStyle = `left:${offsetFormX}px;top:${offsetFromY}px;`;
    this.visible = true;
  }

  public hide(): void {
    if (!this.visible) return;

    this.boxStyle = 'display:none;';
    this.visible = false;
  }

  public isVisible(): boolean {
    return this.visible;
  }
}

// Main class for annotation functionality, manages canvas, modes and state
class Annotator {
  mode = '';
  isAnnotating = false;
  innerToolBox = new InnerToolBox(this);
  imageScale = 1;
  stage: Stage = new Stage({ container: document.createElement('div') });
  stageConfig = { id: 'stage', width: 1, height: 1 };
  layer: Layer = new Layer();
  layerConfig = {
    id: 'layer',
    draggable: true,
    scaleX: 1,
    scaleY: 1,
    clearBeforeDraw: true,
    imageSmoothingEnabled: true,
  };

  imageConfig = {
    image: new Image(),
    scaleX: this.imageScale,
    scaleY: this.imageScale,
    imageSmoothingEnabled: true,
  };
  transformer: Transformer = new Transformer();
  transformerConfig = {
    id: 'transformer',
    rotateEnabled: false,
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
    perfectDrawEnabled: false,
  };

  // Undo/redo state management
  undoStack: DetectionState[][] = [];
  redoStack: DetectionState[][] = [];
  selectedAnnotationIds: Set<string> = new Set();
  private initialized = false;

  // Initialize image settings based on container size and image dimensions
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
      imageSmoothingEnabled: false,
    };
  }

  // Initialize the canvas and set up initial state
  // eslint-disable-next-line
  public initCanvas(stageRef: any): void {
    Konva.pixelRatio = 1;
    this.stage = stageRef.getStage();

    if (!this.initialized) {
      this.layer = this.stage.findOne('Layer') as Layer;
      this.transformer = this.stage.findOne('#transformer') as Transformer;
      this.stage.listening(true);
      this.layer.listening(true);
      this.layer.clearBeforeDraw(true);
      this.initialized = true;
    }

    this.transformer.nodes([]);
    this.innerToolBox.hide();
    this.changeAnnotateMode('add');
    this.undoStack = [];
    this.redoStack = [];
    this.selectedAnnotationIds.clear();
    this.stage.draw();
  }

  // Switch between drag mode (panning) and add mode (creating annotations)
  public changeAnnotateMode(mode: string): void {
    if (this.mode === mode) return;

    switch (mode) {
      case 'drag':
        this.layer.setAttrs({ draggable: true });
        this.disableAnnotationsDrag();
        this.disableAnnotationsListen();
        document.body.style.cursor = 'grab';
        this.mode = 'drag';
        break;
      case 'add':
        this.layer.setAttrs({ draggable: false });
        this.enableAnnotationsDrag();
        this.enableAnnotationsListen();
        document.body.style.cursor = 'crosshair';
        this.mode = 'add';
        break;
      default:
        console.log('out of case');
    }

    this.stage.draw();
  }

  // Prevent annotations from being dragged when in pan mode
  private disableAnnotationsDrag(): void {
    if (!this.stage) return;
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.draggable(false);
    });
  }

  // Allow annotations to be dragged when in add mode
  private enableAnnotationsDrag(): void {
    if (!this.stage) return;
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.draggable(true);
    });
  }

  // Disable event listening on annotations in drag mode
  private disableAnnotationsListen(): void {
    if (!this.stage) return;
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.listening(false);
    });
  }

  // Enable event listening on annotations in add mode
  private enableAnnotationsListen(): void {
    if (!this.stage) return;
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.listening(true);
    });
  }

  // Save current state for undo functionality
  public saveState(annotations: DetectionState[]): void {
    this.undoStack.push(JSON.parse(JSON.stringify(annotations)));
    this.redoStack = [];
  }

  // Implement undo functionality
  public undo(annotations: DetectionState[]): DetectionState[] | undefined {
    if (this.undoStack.length === 0) return undefined;
    this.redoStack.push(JSON.parse(JSON.stringify(annotations)));
    return this.undoStack.pop();
  }

  // Implement redo functionality
  public redo(annotations: DetectionState[]): DetectionState[] | undefined {
    if (this.redoStack.length === 0) return undefined;
    this.undoStack.push(JSON.parse(JSON.stringify(annotations)));
    return this.redoStack.pop();
  }

  // Add an annotation to the selection set
  public selectAnnotation(id: string, addToSelection = false): void {
    if (!addToSelection) this.selectedAnnotationIds.clear();
    this.selectedAnnotationIds.add(id);
    this.updateTransformerWithSelection();
  }

  // Clear all selections
  public deselectAll(): void {
    this.selectedAnnotationIds.clear();
    this.transformer.nodes([]);
    this.innerToolBox.hide();
    this.stage.draw();
  }

  // Update the transformer to show around selected annotations
  private updateTransformerWithSelection(): void {
    const nodes = Array.from(this.selectedAnnotationIds)
      .map((id) => this.stage.findOne(`#${id}`))
      .filter((node): node is Node<NodeConfig> => node !== undefined);
    this.transformer.nodes(nodes);
    this.stage.draw();
  }
}

// Load image data from URL and return dimensions
async function getImageData(url: string): Promise<ImageInfo> {
  const image = await loadImage(url);
  return {
    element: image,
    height: image.height,
    width: image.width,
  };
}

// Helper function to load an image and handle the Promise
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.style.imageRendering = 'pixelated';
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = () => reject('image loading error');
  });
}

// Focus the annotator box for keyboard events
function enterAnnotatorBox(annotatorBox: HTMLDivElement | null) {
  if (!annotatorBox) return;
  annotatorBox.focus();
}

// Handle leaving the annotator area
function leaveAnnotatorBox(annotator: UnwrapNestedRefs<Annotator> & object) {
  document.body.style.cursor = 'default';
  annotator.innerToolBox.hide();
}

export { Annotator, enterAnnotatorBox, leaveAnnotatorBox };
