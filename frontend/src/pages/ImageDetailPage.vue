<script setup lang="ts">
// @author Michael Polívka (xpoliv07)
import { AnnotationList, PageList, ImageAnnotator } from 'components';
import { useRoute, useRouter } from 'vue-router';
import { ref, onMounted, watch, computed } from 'vue';
import { useImage } from 'src/stores/data/useImage';
import { useCollection } from 'src/stores/data/useCollection';
import { useMetaRoleStore } from 'src/stores/meta-role-store';
import {
  useLoadingState,
  useStateManager,
  useNotificationStore,
} from 'src/stores';
import { useSynchronization } from 'src/components/ImageAnnotator/composables/useSynchronization';
import { ANNOTATION_EVENTS, IMAGE_EVENTS } from 'src/constants/events';
import { DetectionState, ImageState } from 'src/types/frontend-state';
import HierarchicalTree from 'src/components/HierarchicalTree/HierarchicalTree.vue';
import { useHierarchicalTree } from 'src/stores/data/useHierarchicalTree';
import { usePanelLayout } from '../composables/usePanelLayout';

// Define the interface for the ImageAnnotator instance
interface ImageAnnotatorInstance {
  handleSelectAnnotation: (id: string, shift?: boolean) => void;
  scrollToAnnotation: (detection: DetectionState) => void;
}

defineOptions({
  name: 'ImageDetailPage',
});

// Setup stores and route
const route = useRoute();
const router = useRouter();
const collectionId = ref(route.params.collectionId as string);
const imageStore = useImage();
const collectionStore = useCollection();
const metaRoleStore = useMetaRoleStore();
const loadingState = useLoadingState();
const stateManager = useStateManager();
const notificationStore = useNotificationStore();
const hierarchicalTreeStore = useHierarchicalTree();
const structureTab = ref('structure'); // Default tab for structure section

// Use panel layout composable
const {
  leftPanelCollapsed,
  rightPanelCollapsed,
  annotationPanelCollapsed,
  leftColumnStyle,
  rightColumnStyle,
  middleColumnStyle,
  structureSectionStyle,
  annotationSectionStyle,
  toggleLeftPanel,
  toggleRightPanel,
  toggleAnnotationPanel,
  startLeftDrag,
  startRightDrag,
  startStructureDrag,
} = usePanelLayout();

// Use the synchronization composable
const synchronization = useSynchronization();

// Computed properties
const detections = computed(() => imageStore.detections || []);
const loadingMessage = computed(() => loadingState.currentLoadingMessage);
const hierarchicalTree = computed(() => hierarchicalTreeStore.tree);

// Convert imageStore.image to the expected ImageState for the AnnotationList component
const imageForAnnotationList = computed((): ImageState => {
  // Default empty ImageState
  const defaultImage: ImageState = {
    id: '',
    name: '',
    height: 0,
    width: 0,
    detection_count: 0,
    annotated_detection_count: 0,
    order: 0,
    detections: [],
    edited: false,
    page_index: '',
    page_index_confidence: 0,
    page_type: '',
    page_type_confidence: 0,
  };

  if (!imageStore.image) return defaultImage;

  return {
    id: imageStore.image.id,
    name: imageStore.image.name,
    height: imageStore.image.height || 0,
    width: imageStore.image.width || 0,
    confidence: imageStore.image.confidence,
    detection_count: imageStore.image.detection_count || 0,
    annotated_detection_count: imageStore.image.annotated_detection_count || 0,
    order: imageStore.image.order,
    detections: [],
    edited: false,
    page_index: imageStore.image.page_index || '',
    page_index_confidence: imageStore.image.page_index_confidence || 0,
    page_type: imageStore.image.page_type || '',
    page_type_confidence: imageStore.image.page_type_confidence || 0,
  };
});

// Use both route params and store state for the imageId
const imageId = computed({
  get: () => imageStore.currentImageId,
  set: (value: string) => {
    // Update route if different from current route params
    if (value !== route.params.imageId) {
      router.push({
        name: route.name as string,
        params: { ...route.params, imageId: value },
      });
    }
  },
});

// Refs for component instances
const annotatorRef = ref<ImageAnnotatorInstance | null>(null);

// Set the annotator ref in the synchronization composable once it's mounted
watch(annotatorRef, (newRef) => {
  if (newRef) synchronization.setAnnotatorRef(newRef);
});

// Track collection loading status
const isCollectionLoading = ref(false);

// Load collection data
const loadCollectionData = async (collectionId: string) => {
  if (
    isCollectionLoading.value ||
    collectionStore.isCollectionReady(collectionId)
  )
    return;

  isCollectionLoading.value = true;
  const loadingKey = `collection_${collectionId}`;
  loadingState.setComponentLoading(loadingKey, true);

  try {
    const isReady = await collectionStore.waitForCollectionReady(collectionId);
    if (!isReady) {
    }
  } catch (error) {
    notificationStore.error('Error loading collection data');
  } finally {
    loadingState.setComponentLoading(loadingKey, false);
    isCollectionLoading.value = false;
  }
};

// Load image data
const loadImageData = async (imageIdToLoad?: string) => {
  const targetImageId = imageIdToLoad || (route.params.imageId as string);

  if (!targetImageId) return;

  // Skip loading if image is already loaded
  if (imageStore.currentImageId === targetImageId && imageStore.image) {
    // Ensure state manager is updated
    if (stateManager.lastImageId !== targetImageId) {
      stateManager.updateState(collectionId.value, targetImageId);
    }
    imageId.value = targetImageId;

    // Make sure to stop any existing changing image loading state
    if (loadingState.currentOperation === 'changingImage') {
      loadingState.stopLoading('changingImage');
    }

    return;
  }

  // Set loading states
  loadingState.setComponentLoading(`annotator_${targetImageId}`, true);
  loadingState.setComponentLoading(`annotationList_${targetImageId}`, true);

  // Update loading message if appropriate
  if (loadingState.currentOperation === 'changingImage') {
    loadingState.startLoading('changingImage', 'Loading image data...');
  }

  try {
    const result = await imageStore.loadImage(
      targetImageId,
      collectionId.value,
    );

    if (!result.success) {
      throw new Error(result.error || 'Error loading image');
    }

    // Update the UI
    imageId.value = targetImageId;

    // Show appropriate notification based on detection count
    if (imageStore.detections.length === 0) {
      notificationStore.warning('No annotations found for this image');
    } else {
      notificationStore.success(
        `Loaded ${imageStore.detections.length} annotations`,
      );
    }

    // Ensure meta roles are loaded
    if (!metaRoleStore.loaded) {
      loadingState.setComponentLoading(`metaRoles_${targetImageId}`, true);
      await metaRoleStore.loadMetaRoles();
      loadingState.setComponentLoading(`metaRoles_${targetImageId}`, false);
    }

    // Update state manager
    stateManager.updateState(collectionId.value, targetImageId);
  } catch (error) {
    console.error('Error loading image data:', error);
    stateManager.handleError(error, 'Error loading image data');
    notificationStore.error('Error loading image data');
    loadingState.startLoading('criticalError', 'Error loading image data');
    setTimeout(() => loadingState.stopLoading('criticalError'), 2000);
  } finally {
    // Clear loading states
    loadingState.setComponentLoading(`annotator_${targetImageId}`, false);
    loadingState.setComponentLoading(`annotationList_${targetImageId}`, false);

    // Also stop the changing image loading state if it's active
    if (loadingState.currentOperation === 'changingImage') {
      loadingState.stopLoading('changingImage');
    }
  }
};

// Initial setup
onMounted(async () => {
  if (!collectionId.value) {
    notificationStore.error('Missing required parameters');
    return;
  }

  // Validate collection ID
  if (!stateManager.validateIds({ lastCollectionId: collectionId.value })) {
    notificationStore.error('Invalid collection ID');
    return;
  }

  const routeImageId = route.params.imageId as string;

  // Load collection if not ready
  if (!collectionStore.isCollectionReady(collectionId.value)) {
    await loadCollectionData(collectionId.value);
  }

  // Load image if needed
  if (routeImageId && imageStore.currentImageId !== routeImageId) {
    loadingState.setComponentLoading(`annotator_${routeImageId}`, true);
    try {
      await loadImageData(routeImageId);
    } catch (error) {
      notificationStore.error('Error loading image data');
    } finally {
      loadingState.setComponentLoading(`annotator_${routeImageId}`, false);

      // Clear any navigation loading states that might still be active
      if (
        loadingState.currentOperation === 'navigatingToImage' ||
        loadingState.currentOperation === 'changingImage'
      ) {
        loadingState.stopLoading(loadingState.currentOperation);
      }
    }
  } else if (routeImageId) {
    // Just update the UI state
    imageId.value = routeImageId;

    // Ensure no leftover loading states
    if (
      loadingState.currentOperation === 'navigatingToImage' ||
      loadingState.currentOperation === 'changingImage'
    ) {
      loadingState.stopLoading(loadingState.currentOperation);
    }
  }
});

// Watch for route parameter changes
watch(
  () => [route.params.collectionId, route.params.imageId],
  async ([newCollectionId, newImageId]) => {
    // Update collection ID if changed
    if (newCollectionId && newCollectionId !== collectionId.value) {
      collectionId.value = newCollectionId as string;
    }

    // Update image if changed
    if (newImageId && newImageId !== imageId.value) {
      if (imageStore.currentImageId !== newImageId) {
        await loadImageData(newImageId as string);
      } else {
        imageId.value = newImageId as string;
      }
    }
  },
);

// Handle image selection from PageList
const handleSelectImage = async (
  selectedImageId: string,
  options = { isSelectionOnly: false, exists: false },
) => {
  if (selectedImageId === imageId.value) return;

  // Show loading state when changing images
  loadingState.startLoading('changingImage', 'Switching to new image...');

  try {
    // Simple selection change or full load
    if (options.isSelectionOnly && options.exists) {
      router.push({
        name: route.name as string,
        params: { ...route.params, imageId: selectedImageId },
        replace: true,
      });

      imageId.value = selectedImageId;
      stateManager.updateState(collectionId.value, selectedImageId);

      // Load minimal image data if not already loaded
      if (imageStore.image?.id !== selectedImageId) {
        loadingState.setComponentLoading(`annotator_${selectedImageId}`, true);
        try {
          await imageStore.loadImage(selectedImageId, collectionId.value);
        } catch (error) {
          console.error('Error loading image data:', error);
        } finally {
          loadingState.setComponentLoading(
            `annotator_${selectedImageId}`,
            false,
          );
        }
      }
    } else {
      // Full image loading
      await loadImageData(selectedImageId);
    }
  } catch (error) {
    console.error('Error selecting image:', error);
  } finally {
    // Stop loading state
    loadingState.stopLoading('changingImage');
  }
};

// Save detections function
const saveDetections = async () => {
  if (!imageStore.hasChanges) return;

  loadingState.startLoading('savingDetections', 'Saving annotations...');

  try {
    const result = await imageStore.saveAllChanges();
    if (!result.success) {
      throw new Error(result.error || 'Error saving changes');
    }
    notificationStore.success('Annotations saved successfully');
  } catch (error) {
    console.error('Error saving detections:', error);
    notificationStore.error('Error saving annotations');
  } finally {
    loadingState.stopLoading('savingDetections');
  }
};

// Add this to the script section at an appropriate location
const handleHierarchicalTreeClick = (event: MouseEvent) => {
  // Find the clicked element
  const target = event.target as HTMLElement;
  const clickableItem = target.closest('.clickable-item');

  // Extract detection data if available
  if (clickableItem) {
    const detectionId = clickableItem.getAttribute('data-detection-id');
    const imageId = clickableItem.getAttribute('data-image-id');

    if (detectionId && imageId) {
      // If this is a different image, navigate to it
      if (imageId !== imageStore.currentImageId) {
        // Update route if different from current route params
        router.push({
          name: route.name as string,
          params: { ...route.params, imageId: imageId },
        });
      }

      // Select the detection after a short delay to ensure image is loaded
      setTimeout(() => {
        try {
          imageStore.selectDetection(detectionId);
        } catch (err) {
          console.error('[EVENT-DEBUG] Error selecting detection:', err);
        }
      }, 500);
    }
  }
};

// Add loading state tracking
const isReloading = ref(false);

// Watch for collection loading state
watch(
  () => collectionStore.loading,
  (newLoading) => {
    isReloading.value = newLoading;
  },
);

// Watch for collection changes
watch(
  () => collectionStore.collection,
  async (newCollection) => {
    if (newCollection && collectionId.value) {
      // Ensure collection is fully ready

      await collectionStore.waitForCollectionReady(collectionId.value);
      isReloading.value = false;
    }
  },
);
</script>

<template>
  <q-page class="column">
    <!-- Loading overlay for critical errors -->
    <div
      v-if="loadingState.currentOperation === 'criticalError'"
      class="loading-overlay"
    >
      <q-spinner color="primary" size="3em" />
      <div class="text-subtitle1 q-mt-sm">{{ loadingMessage }}</div>
    </div>

    <!-- Collection reloading overlay -->
    <div v-if="isReloading" class="loading-overlay">
      <q-spinner color="primary" size="3em" />
      <div class="text-subtitle1 q-mt-sm">Reloading data...</div>
    </div>

    <div class="row no-wrap app-container">
      <!-- Left column with PageList -->
      <div class="left-column" :style="leftColumnStyle">
        <div v-if="!leftPanelCollapsed" class="column-content">
          <PageList
            :collection-id="collectionId"
            layout="sidebar"
            show-header
            show-statistics
            show-view-mode-selector
            enable-bulk-actions
            @[IMAGE_EVENTS.SELECT]="handleSelectImage"
          />
        </div>
        <div v-else class="collapsed-panel">
          <q-icon name="photo_library" size="24px" />
        </div>

        <!-- Toggle button -->
        <div class="panel-toggle left-toggle" @click="toggleLeftPanel">
          <q-icon
            :name="leftPanelCollapsed ? 'chevron_right' : 'chevron_left'"
            size="20px"
          />
        </div>

        <!-- Resize handle -->
        <div
          v-if="!leftPanelCollapsed"
          class="resize-handle left-handle"
          @mousedown.prevent="startLeftDrag"
        ></div>
      </div>

      <!-- Image annotator column -->
      <div class="middle-column" :style="middleColumnStyle">
        <div class="column-content">
          <div v-if="imageStore.currentImageId" class="annotator-container">
            <ImageAnnotator
              :image-id="imageStore.currentImageId"
              :collection-id="collectionId"
              ref="annotatorRef"
              @save="saveDetections"
            />
            <div v-show="loadingState.isLoading" class="loading-overlay">
              <q-circular-progress indeterminate color="primary" size="50px" />
              <div class="text-subtitle1 q-mt-sm">{{ loadingMessage }}</div>
            </div>
          </div>
          <div v-else class="flex flex-center empty-state">
            <div class="text-center">
              <q-icon name="image" size="50px" color="grey-5" />
              <div class="text-subtitle1 q-mt-sm">
                Select an image from the list
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Annotation list column -->
      <div class="right-column" :style="rightColumnStyle">
        <!-- Resize handle -->
        <div
          v-if="!rightPanelCollapsed"
          class="resize-handle right-handle"
          @mousedown.prevent="startRightDrag"
        ></div>

        <!-- Toggle button -->
        <div class="panel-toggle right-toggle" @click="toggleRightPanel">
          <q-icon
            :name="rightPanelCollapsed ? 'chevron_left' : 'chevron_right'"
            size="20px"
          />
        </div>

        <div v-if="!rightPanelCollapsed" class="column-content">
          <!-- HierarchicalTree component -->
          <div
            class="structure-section"
            v-if="hierarchicalTree"
            :style="structureSectionStyle"
          >
            <div class="structure-header">
              <q-tabs
                v-model="structureTab"
                dense
                indicator-color="primary"
                active-color="primary"
                narrow-indicator
                class="q-mb-none"
              >
                <q-tab name="structure" icon="account_tree" label="Structure" />
              </q-tabs>
              <q-separator />
            </div>
            <div class="structure-content">
              <HierarchicalTree
                :tree="hierarchicalTree"
                @click="handleHierarchicalTreeClick"
              />
            </div>
          </div>

          <!-- Empty structure state -->
          <div v-else class="structure-section" :style="structureSectionStyle">
            <div class="structure-header">
              <q-tabs
                v-model="structureTab"
                dense
                indicator-color="primary"
                active-color="primary"
                narrow-indicator
                class="q-mb-none"
              >
                <q-tab name="structure" icon="account_tree" label="Structure" />
              </q-tabs>
              <q-separator />
            </div>
            <div class="empty-structure q-pa-md text-center">
              <q-icon name="account_tree" size="36px" color="grey-5" />
              <div class="text-subtitle2 q-mt-sm">No structure information</div>
            </div>
          </div>

          <!-- Panel divider with resize handle -->
          <div class="panel-divider" @mousedown.prevent="startStructureDrag">
            <div
              class="panel-toggle annotation-toggle"
              @click.stop="toggleAnnotationPanel"
            >
              <q-icon
                name="expand_more"
                size="20px"
                :class="{ 'rotate-180': annotationPanelCollapsed }"
                class="toggle-icon"
              />
            </div>
            <div class="divider-grip"></div>
          </div>

          <!-- Annotation list -->
          <div class="annotation-container" :style="annotationSectionStyle">
            <AnnotationList
              v-if="!annotationPanelCollapsed"
              :detections="detections"
              :loading="
                loadingState.isComponentLoading(
                  `annotationList_${imageStore.currentImageId}`,
                )
              "
              :image="imageForAnnotationList"
              @[ANNOTATION_EVENTS.SCROLL_TO]="
                synchronization.handleScrollToAnnotation
              "
              @[ANNOTATION_EVENTS.SELECT]="
                synchronization.handleSelectAnnotation
              "
            />
            <div v-else class="collapsed-annotation">
              <q-icon name="list" size="20px" class="q-mr-xs" />
              <span class="text-caption">Annotations</span>
            </div>
          </div>
        </div>
        <div v-else class="collapsed-panel">
          <q-icon name="list" size="24px" />
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
  color: white;
  font-weight: bold;
}

/* Main container layout */
.app-container {
  height: calc(100vh - 50px);
  overflow: visible;
  position: relative;
}

/* Column layout styles */
.left-column,
.middle-column,
.right-column {
  height: 100%;
  overflow: visible;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s ease;
}

.left-column {
  border-right: 1px solid #ddd;
}

.right-column {
  border-left: 1px solid #ddd;
}

/* Annotator container */
.annotator-container {
  position: relative;
  height: 100%;
  overflow: hidden;
}

/* Empty state when no image selected */
.empty-state {
  height: 100%;
}

/* Structure section */
.structure-section {
  flex: 0 0 auto;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.structure-header {
  flex: 0 0 auto;
  background-color: white;
  border-radius: 8px 8px 0 0;
  position: relative;
  border-bottom: 1px solid #f0f0f0;
}

.structure-content {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.empty-structure {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
  background-color: rgba(0, 0, 0, 0.02);
}

/* Annotation list container */
.annotation-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* Panel collapse and resize styles */
.collapsed-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: #fafafa;
  color: #757575;
  border-right: 1px solid #eeeeee;
  border-left: 1px solid #eeeeee;
}

.panel-toggle {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background-color: white;
  border: 1px solid #eeeeee;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  cursor: pointer;
  z-index: 100;
  top: 50%;
  transform: translateY(-50%);
  transition: background-color 0.2s ease;
}

.toggle-icon {
  transition: transform 0.3s ease;
}

.rotate-180 {
  transform: rotate(180deg);
}

.panel-toggle:hover {
  background-color: #f5f5f5;
}

/* Toggle button positions */
.annotation-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9100;
}

.left-toggle {
  right: -15px;
}

.right-toggle {
  left: -15px;
}

/* Resize handle */
.resize-handle {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.02);
  z-index: 80;
  transition: background-color 0.2s ease;
}

.resize-handle:hover,
.resize-handle:active {
  background-color: rgba(0, 0, 0, 0.08);
}

.left-handle {
  right: 0;
  top: 0;
  height: 100%;
  width: 8px;
  cursor: col-resize;
}

.right-handle {
  left: 0;
  top: 0;
  height: 100%;
  width: 8px;
  cursor: col-resize;
}

/* Panel divider */
.panel-divider {
  position: relative;
  height: 24px;
  background-color: transparent;
  margin: 4px 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  z-index: 90;
}

.panel-divider::before {
  content: '';
  position: absolute;
  height: 2px;
  width: 100%;
  background-color: #e0e0e0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
}

.divider-grip {
  position: absolute;
  width: 30px;
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  z-index: 101;
}

.panel-divider:hover .divider-grip {
  background-color: #bdbdbd;
}

.panel-divider:hover::before {
  background-color: #bdbdbd;
  height: 2px;
}

/* Collapsed annotation */
.collapsed-annotation {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: #fafafa;
  color: #757575;
  padding: 8px;
  border-radius: 8px;
  width: 100%;
  font-weight: 500;
}

/* Column content wrapper */
.column-content {
  height: 100%;
  width: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
</style>
