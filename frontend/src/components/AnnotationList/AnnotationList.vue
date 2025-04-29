<script setup lang="ts">
import { ref, computed } from 'vue';
import { DetectionState, ImageState } from 'src/types/frontend-state';
import { PageAnnotationsTab } from './PageAnnotations';
import { PageInfoTab } from './PageInfo';
import { ANNOTATION_EVENTS } from 'src/constants/events';

const props = defineProps<{
  detections: DetectionState[];
  loading?: boolean;
  image: ImageState;
}>();

const hasPageInfo = computed(() => {
  return !!props.image.page_index || !!props.image.page_type;
});
const hasAnnotations = computed(() => {
  return props.detections.length > 0;
});
// Active tab
const activeTab = ref('annotations');

// Forward events from annotations tab
const handleScrollToAnnotation = (detection: DetectionState) => {
  emit(ANNOTATION_EVENTS.SCROLL_TO, detection);
};

const handleSelectAnnotation = (detection: DetectionState) => {
  emit(ANNOTATION_EVENTS.SELECT, detection);
};

// Define emits for parent component
const emit = defineEmits([
  ANNOTATION_EVENTS.SCROLL_TO,
  ANNOTATION_EVENTS.SELECT,
]);
</script>

<template>
  <div class="annotation-list">
    <!--   Tab navigation -->
    <div class="tab-navigation q-mb-md">
      <div class="row items-center">
        <div class="col">
          <q-tabs
            v-model="activeTab"
            dense
            indicator-color="primary"
            active-color="primary"
            align="justify"
            narrow-indicator
          >
            <q-tab
              name="annotations"
              icon="article"
              label="Annotations"
              :alert="!hasAnnotations"
              alert-icon="cancel"
              :disable="!hasAnnotations"
            />
            <q-tab
              name="pageInfo"
              icon="info"
              label="Page Info"
              :alert="!hasPageInfo"
              alert-icon="cancel"
              :disable="!hasPageInfo"
            />
          </q-tabs>
        </div>
      </div>
      <q-separator />
    </div>

    <!-- Tab panels content -->
    <q-tab-panels v-model="activeTab" animated>
      <!-- Annotations tab -->
      <q-tab-panel name="annotations" class="q-pa-none">
        <PageAnnotationsTab
          :detections="detections"
          :loading="loading"
          @scrollToAnnotation="handleScrollToAnnotation"
          @selectAnnotation="handleSelectAnnotation"
        />
      </q-tab-panel>

      <!-- Page Info tab -->
      <q-tab-panel name="pageInfo" class="q-pa-none">
        <PageInfoTab :image="image" :loading="loading" />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<style lang="scss" scoped>
.annotation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-navigation {
  background-color: white;
  border-radius: 4px;
}
</style>
