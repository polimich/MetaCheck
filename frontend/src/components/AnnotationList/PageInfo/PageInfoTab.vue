<!--
@author Michael Polívka (xpoliv07)
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ImageState } from 'src/types/frontend-state';
import PageInfoItem from './PageInfoItem.vue';
import { useImage } from 'src/stores';

const props = defineProps<{
  image: ImageState;
  loading?: boolean;
}>();

// Image store for updating page metadata
const imageStore = useImage();

// Local reactive values to track changes in the image prop
const pageIndex = ref(props.image.page_index || '');
const pageIndexConfidence = ref(props.image.page_index_confidence || 0);
const pageType = ref<string | { value: string; label: string }>(
  props.image.page_type || '',
);
const pageTypeConfidence = ref(props.image.page_type_confidence || 0);

// Watch for changes to the image prop and update local values
watch(
  () => props.image,
  (newImage) => {
    pageIndex.value = newImage.page_index || '';
    pageIndexConfidence.value = newImage.page_index_confidence || 0;
    pageType.value = newImage.page_type || '';
    pageTypeConfidence.value = newImage.page_type_confidence || 0;
  },
  { immediate: true, deep: true },
);

// Helper to extract string value from potentially object-typed page type
const getStringValue = (
  value: string | { value: string; label: string },
): string => {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return value.value;
  }
  return value as string;
};

// Check if we have page info to display
const hasPageInfo = computed(() => {
  return !!pageIndex.value || !!pageType.value;
});

// Handle page info updates
const handlePageInfoUpdate = async ({
  type,
  value,
  confidence,
}: {
  type: 'page_index' | 'page_type';
  value: string | { value: string; label: string };
  confidence: number;
}) => {
  // Extract the string value if value is an object
  const finalValue = getStringValue(value);

  console.log(
    `Updating ${type} to: ${finalValue} with confidence: ${confidence}`,
  );

  // Update local values
  if (type === 'page_index') {
    pageIndex.value = finalValue;
    pageIndexConfidence.value = confidence;
  } else if (type === 'page_type') {
    pageType.value = finalValue;
    pageTypeConfidence.value = confidence;
  }

  // Update the image in the store
  if (imageStore.image) {
    if (type === 'page_index') {
      imageStore.image.page_index = finalValue;
      imageStore.image.page_index_confidence = confidence;
    } else if (type === 'page_type') {
      imageStore.image.page_type = finalValue;
      imageStore.image.page_type_confidence = confidence;
    }

    // Save the image using the new saveImage function
    const result = await imageStore.saveImage();
    if (result.success) {
      console.log(`Successfully saved ${type} update`);
    } else {
      console.error(`Error saving ${type} update: ${result.error}`);
    }
  }
};

// Handle refreshing the image
const handleRefresh = async (imageId: string) => {
  console.log(`Refreshing image data for ${imageId}`);
  // Use loadImage from the store to refresh the image data
  const result = await imageStore.loadImage(imageId);

  if (result.success) {
    console.log('Image refreshed successfully');
  } else {
    console.error(`Error refreshing image: ${result.error}`);
  }
};
</script>

<template>
  <div v-if="hasPageInfo" class="annotation-items q-px-md q-pt-sm q-pb-xl">
    <div class="page-info-header q-pb-md">
      <div class="text-subtitle1 q-pb-xs">Page Metadata</div>
      <div class="text-caption text-grey-7">
        These special annotations provide document structure information. Edit
        the values below to correct the page number or type.
      </div>
    </div>

    <!-- Page Index -->
    <PageInfoItem
      v-if="pageIndex !== undefined"
      type="page_index"
      :value="pageIndex"
      :confidence="pageIndexConfidence"
      :imageId="image.id"
      :loading="loading"
      @save="handlePageInfoUpdate"
      @refresh="handleRefresh"
    />

    <!-- Page Type -->
    <PageInfoItem
      v-if="pageType !== undefined"
      type="page_type"
      :value="getStringValue(pageType)"
      :confidence="pageTypeConfidence"
      :imageId="image.id"
      :loading="loading"
      @save="handlePageInfoUpdate"
      @refresh="handleRefresh"
    />
  </div>

  <div v-else class="empty-state q-pa-md text-center">
    <q-icon name="info_outline" size="48px" color="grey-5" />
    <div class="text-subtitle1 q-mt-sm">No page information</div>
    <div class="text-caption text-grey-7">
      This image doesn't have any page information
    </div>
  </div>
</template>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.page-info-header {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 16px;
}

.annotation-items {
  overflow-y: auto;
  flex: 1;
  padding: 0 4px;
}
</style>
