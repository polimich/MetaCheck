import { Stage } from 'konva/lib/Stage';
import { Layer } from 'konva/lib/Layer';
import { Transformer } from 'konva/lib/shapes/Transformer';
import { UnwrapNestedRefs } from 'vue';
import { DetectionState, newDetectionState } from 'src/types';
import { Node } from 'konva/lib/Node';
import { NodeConfig } from 'konva/lib/Node';
import Konva from 'konva';

class ImageInfo {
  element!: HTMLImageElement;
  width = 0;
  height = 0;
}

class InnerToolBox {
  public boxStyle = 'display:none;';
  private annotation = newDetectionState();
  private visible = false;

  public getAnnotationId(): string {
    return this.annotation.id;
  }

  public updateAnnotation(annotation: DetectionState): void {
    this.annotation = annotation;
  }

  public show(mouseEvent: MouseEvent): void {
    if (this.visible) return;

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

class Annotator {
  mode = '';
  isAnnotating = false;
  innerToolBox = new InnerToolBox();
  // konva settings
  imageScale = 1;
  stage: Stage = new Stage({ container: document.createElement('div') });
  stageConfig = { id: 'stage', width: 1, height: 1 };
  layer: Layer = new Layer();
  layerConfig = {
    id: 'layer',
    draggable: true,
    scaleX: 1,
    scaleY: 1,
    clearBeforeDraw: true, // Prevent clearing before redraw
    imageSmoothingEnabled: true, // Disable image smoothing for better performance
  };

  imageConfig = {
    image: new Image(),
    scaleX: this.imageScale,
    scaleY: this.imageScale,
    imageSmoothingEnabled: true, // Disable image smoothing
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
    perfectDrawEnabled: false, // Prevent excessive redraws
  };

  // Undo/redo stacks
  undoStack: DetectionState[][] = [];
  redoStack: DetectionState[][] = [];

  // Multi-select support
  selectedAnnotationIds: Set<string> = new Set();

  // Flag to track if stage is already initialized
  private initialized = false;

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
      imageSmoothingEnabled: false, // Disable image smoothing
    };
  }

  // eslint-disable-next-line
  public initCanvas(stageRef: any): void {
    // Set global Konva options to optimize performance
    Konva.pixelRatio = 1;

    this.stage = stageRef.getStage();

    // Only initialize once if possible
    if (!this.initialized) {
      this.layer = this.stage.findOne('Layer') as Layer;
      this.transformer = this.stage.findOne('#transformer') as Transformer;

      // Apply optimizations
      this.stage.listening(true);
      this.layer.listening(true);
      this.layer.clearBeforeDraw(true);

      // Optimize rendering
      Konva.autoDrawEnabled = true;

      this.initialized = true;
    }

    // These actions are safe to do on every init
    this.transformer.nodes([]);
    this.innerToolBox.hide();
    this.changeAnnotateMode('add');

    // Clear undo/redo stacks
    this.undoStack = [];
    this.redoStack = [];
    this.selectedAnnotationIds.clear();

    // Force a single redraw
    this.stage.draw();
  }

  public changeAnnotateMode(mode: string): void {
    if (this.mode === mode) return; // No need to change if already in this mode

    switch (mode) {
      case 'drag':
        // Set layer draggable to true to enable panning
        this.layer.setAttrs({ draggable: true });
        // Disable drag on all annotations when in pan mode
        this.disableAnnotationsDrag();
        this.disableAnnotationsListen();
        document.body.style.cursor = 'grab';
        this.mode = 'drag';
        break;
      case 'add':
        // Disable layer dragging when in add mode
        this.layer.setAttrs({ draggable: false });
        // Re-enable drag on all annotations in add mode
        this.enableAnnotationsDrag();
        this.enableAnnotationsListen();
        document.body.style.cursor = 'crosshair';
        this.mode = 'add';
        break;
      default:
        console.log('out of case');
    }

    // Force a single draw instead of a batch to prevent flicker
    this.stage.draw();
  }

  // Helper methods to control annotation draggability
  private disableAnnotationsDrag(): void {
    if (!this.stage) return;

    // Find all rectangle annotations and disable dragging
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.draggable(false);
    });
  }

  private enableAnnotationsDrag(): void {
    if (!this.stage) return;

    // Find all rectangle annotations and enable dragging
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.draggable(true);
    });
  }

  private disableAnnotationsListen(): void {
    if (!this.stage) return;
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.listening(false);
    });
  }

  private enableAnnotationsListen(): void {
    if (!this.stage) return;
    const annotations = this.stage.find('Rect');
    annotations.forEach((annotation) => {
      annotation.listening(true);
    });
  }

  // Undo/redo functionality
  public saveState(annotations: DetectionState[]): void {
    // Save a deep copy of the current state
    this.undoStack.push(JSON.parse(JSON.stringify(annotations)));
    // Clear redo stack when a new action is performed
    this.redoStack = [];
  }

  public undo(annotations: DetectionState[]): DetectionState[] | undefined {
    if (this.undoStack.length === 0) return undefined;

    // Save current state to redo stack
    this.redoStack.push(JSON.parse(JSON.stringify(annotations)));
    // Pop the last state from undo stack
    return this.undoStack.pop();
  }

  public redo(annotations: DetectionState[]): DetectionState[] | undefined {
    if (this.redoStack.length === 0) return undefined;

    // Save current state to undo stack
    this.undoStack.push(JSON.parse(JSON.stringify(annotations)));
    // Pop the last state from redo stack
    return this.redoStack.pop();
  }

  // Multi-select support
  public selectAnnotation(id: string, addToSelection = false): void {
    if (!addToSelection) this.selectedAnnotationIds.clear();
    this.selectedAnnotationIds.add(id);
    this.updateTransformerWithSelection();
  }

  public deselectAll(): void {
    this.selectedAnnotationIds.clear();
    this.transformer.nodes([]);
    this.innerToolBox.hide();
    this.stage.draw();
  }

  private updateTransformerWithSelection(): void {
    const nodes = Array.from(this.selectedAnnotationIds)
      .map((id) => this.stage.findOne(`#${id}`))
      .filter((node): node is Node<NodeConfig> => node !== undefined);
    this.transformer.nodes(nodes);
    this.stage.draw();
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

    // Disable image smoothing for better performance
    image.style.imageRendering = 'pixelated';

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
  document.body.style.cursor = 'default';
  annotator.innerToolBox.hide();
}

export { Annotator, enterAnnotatorBox, leaveAnnotatorBox };
