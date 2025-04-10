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
    console.log(
      '[useTransformerManagement] updateTransformer called, selected IDs:',
      Array.from(currentSelectedIds),
    );

    const selectedNodes: Array<Shape | Group> = [];

    if (konvaLayer.value && currentSelectedIds.size > 0) {
      const layer = konvaLayer.value;
      currentSelectedIds.forEach((id) => {
        const node = layer.findOne(`#${id}`) as Shape | Group | null;
        console.log(
          `[useTransformerManagement] Looking for node #${id}:`,
          node ? 'found' : 'not found',
        );
        if (node) {
          selectedNodes.push(node);
        }
      });
    }

    console.log(
      '[useTransformerManagement] Selected nodes count:',
      selectedNodes.length,
    );

    if (!transformer.value && konvaLayer.value) {
      console.log('[useTransformerManagement] Creating new transformer');
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
        boundBoxFunc: transformerBoundBoxFunc, // Use the function defined in this composable
      });

      const layer = konvaLayer.value;
      if (layer && transformer.value) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error - Konva type mismatch for adding Transformer to Layer
        layer.add(transformer.value);
        console.log('[useTransformerManagement] Transformer added to layer');
      } else {
        console.log(
          '[useTransformerManagement] Layer or Transformer not found, cannot add transformer',
        );
      }
    } else if (transformer.value) {
      console.log(
        '[useTransformerManagement] Updating existing transformer with nodes:',
        selectedNodes.length,
      );
      transformer.value.nodes(selectedNodes);
    }

    konvaLayer.value?.batchDraw();
    console.log('[useTransformerManagement] Layer batch draw triggered');
  };

  // Watch for changes in selected annotations and update the transformer
  watch(
    selectedIds,
    (newSelectedIdsValue) => {
      const newSelectedIds = newSelectedIdsValue || new Set<string>();
      console.log(
        '[useTransformerManagement] Selection changed, new selection:',
        Array.from(newSelectedIds),
      );
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
