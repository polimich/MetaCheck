<script setup lang="ts">
import { computed } from 'vue';
import { ImageState } from 'src/types/frontend-state';
import PageInfoItem from './PageInfoItem.vue';
import { useImage } from 'src/stores';

const props = defineProps<{
  image: ImageState;
  loading?: boolean;
}>();

// Image store for updating page metadata
const imageStore = useImage();

// Check if we have page info to display
const hasPageInfo = computed(() => {
  return !!props.image.page_index || !!props.image.page_type;
});

// Handle page info updates
const handlePageInfoUpdate = async ({
  type,
  value,
  confidence,
}: {
  type: 'page_index' | 'page_type';
  value: string;
  confidence: number;
}) => {
  console.log(`Updating ${type} to: ${value} with confidence: ${confidence}`);

  // Update the image in the store
  if (imageStore.image) {
    if (type === 'page_index') {
      imageStore.image.page_index = value;
      imageStore.image.page_index_confidence = confidence;
    } else if (type === 'page_type') {
      imageStore.image.page_type = value;
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
      v-if="image.page_index !== undefined"
      type="page_index"
      :value="image.page_index"
      :confidence="image.page_index_confidence || 0"
      :imageId="image.id"
      :loading="loading"
      @save="handlePageInfoUpdate"
      @refresh="handleRefresh"
    />

    <!-- Page Type -->
    <PageInfoItem
      v-if="image.page_type !== undefined"
      type="page_type"
      :value="image.page_type"
      :confidence="image.page_type_confidence || 0"
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
