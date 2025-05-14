// @author Michael Polívka (xpoliv07)
import { ref, watch, nextTick, Ref } from 'vue';
import { Layer } from 'konva/lib/Layer';
import { Transformer } from 'konva/lib/shapes/Transformer';
import { Shape } from 'konva/lib/Shape';
import { Group } from 'konva/lib/Group';

// Define Box interface compatible with Konva (needed for boundBoxFunc)
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Composable for managing the Konva Transformer
 */
export function useTransformerManagement(
  konvaLayer: Ref<Layer | null>,
  selectedIds: Ref<Set<string> | undefined>,
) {
  const transformer = ref<Transformer | null>(null);

  // Transformer bounding box function
  function transformerBoundBoxFunc(oldBox: Box, newBox: Box): Box {
    // Prevent negative width/height which can break transformer
    if (newBox.width < 5 || newBox.height < 5) {
      return oldBox;
    }
    return newBox;
  }

  // Update transformer to reflect selected annotations
  const updateTransformer = () => {
    const currentSelectedIds = selectedIds.value || new Set<string>();

    const selectedNodes: Array<Shape | Group> = [];

    if (konvaLayer.value && currentSelectedIds.size > 0) {
      const layer = konvaLayer.value;
      currentSelectedIds.forEach((id) => {
        const node = layer.findOne(`#${id}`) as Shape | Group | null;
        if (node) {
          selectedNodes.push(node);
        }
      });
    }

    if (!transformer.value && konvaLayer.value) {
      transformer.value = new Transformer({
        nodes: selectedNodes,
        keepRatio: false,
        enabledAnchors: [
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
          'middle-left',
          'middle-right',
          'top-center',
          'bottom-center',
        ],
        rotateEnabled: false,
        borderDash: [5, 5],
        borderStroke: '#0077ff',
        borderStrokeWidth: 1,
        anchorStroke: '#0077ff',
        anchorFill: '#ffffff',
        anchorSize: 10,
        boundBoxFunc: transformerBoundBoxFunc,
      });

      const layer = konvaLayer.value;
      if (layer && transformer.value) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        layer.add(transformer.value);
      }
    } else if (transformer.value) {
      transformer.value.nodes(selectedNodes);
    }

    konvaLayer.value?.batchDraw();
  };

  // Watch for changes in selected annotations and update the transformer
  watch(
    selectedIds,
    () => {
      nextTick(() => {
        updateTransformer();
      });
    },
    { deep: true },
  );

  return {
    transformer,
    updateTransformer,
  };
}
