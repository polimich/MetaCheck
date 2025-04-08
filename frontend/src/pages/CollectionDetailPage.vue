<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { ref, watch, onMounted } from 'vue';
import { Image, ImageAddDto } from 'src/stores';
import { getPreviewImage } from 'utils';
import { useCurrentCollectionState } from 'stores/frontend-state';

defineOptions({
  name: 'CollectionDetailPage',
});

const route = useRoute();
const router = useRouter();
const currentCollection = useCurrentCollectionState();
const collectionId = ref(route.params.collectionId as string);
const grid = ref(true);
const fileTypes = 'image/*';

const isAddOpen = ref(false);
const imageToAdd = ref<ImageAddDto>({
  collection_id: collectionId.value,
  order: 0,
  file: undefined,
});

// Load the collection when component is mounted
onMounted(async () => {
  await loadCurrentCollection();
});

// Watch for route changes to reload data when navigating between collections
watch(
  () => route.params.collectionId,
  async (newCollectionId) => {
    if (newCollectionId && newCollectionId !== collectionId.value) {
      collectionId.value = newCollectionId as string;
      imageToAdd.value.collection_id = collectionId.value;
      await loadCurrentCollection();
    }
  },
);

// Function to load the current collection
const loadCurrentCollection = async () => {
  await currentCollection.loadCollection(collectionId.value);
};

const onRowClick = (_evt: Event, row: Image) => {
  router.push({
    name: 'image',
    params: {
      imageId: row.id,
    },
  });
};

const handleUpload = async () => {
  console.log('handleUpload');
  await currentCollection.uploadImageToCollection(imageToAdd.value);
};
const onReset = () => {
  imageToAdd.value.order = 0;
  imageToAdd.value.file = undefined;
};
</script>

<template>
  <q-page>
    <div class="q-pa-md">
      <q-table
        title="Images"
        :grid="grid"
        :rows="currentCollection.collection?.images || []"
        row-key="name"
        :loading="currentCollection.loading"
        @row-click="onRowClick"
      >
        <template v-slot:top-right>
          <q-btn-toggle
            class="q-mr-md"
            v-model="grid"
            toggle-color="primary"
            :options="[
              { icon: 'apps', value: true },
              { icon: 'list', value: false },
            ]"
          />
          <q-btn
            round
            color="primary"
            icon="add"
            :disable="currentCollection.loading"
            @click="isAddOpen = true"
          />
          <q-dialog v-model="isAddOpen" @hide="onReset">
            <q-card style="min-width: 400px">
              <q-form @submit="handleUpload" @reset="onReset">
                <q-card-section>
                  <div class="text-h6">Upload image to collection</div>
                </q-card-section>
                <q-card-section class="q-gutter-md">
                  <q-input
                    autofocus
                    filled
                    v-model="imageToAdd.order"
                    label="Collection description"
                    lazy-rules
                    type="number"
                  />

                  <q-file
                    filled
                    bottom-slots
                    v-model="imageToAdd.file"
                    label="Image"
                    counter
                    :accept="fileTypes"
                  >
                    <template v-slot:prepend>
                      <q-icon name="cloud_upload" @click.stop.prevent />
                    </template>
                    <template v-slot:append>
                      <q-icon
                        name="close"
                        @click.stop.prevent="imageToAdd.file = undefined"
                        class="cursor-pointer"
                      />
                    </template>
                    <template v-slot:hint> Upload image </template>
                  </q-file>
                </q-card-section>

                <q-card-actions align="right">
                  <q-btn
                    flat
                    label="Add"
                    color="primary"
                    v-close-popup
                    @click="handleUpload"
                  />
                  <q-btn
                    flat
                    label="Cancel"
                    type="reset"
                    color="negative"
                    v-close-popup
                  />
                </q-card-actions>
              </q-form>
            </q-card>
          </q-dialog>
        </template>

        <template v-slot:item="props">
          <div
            class="q-pa-xs col-xs-12 col-sm-6 col-md-4 col-lg-2 grid-style-transition"
            :style="props.selected ? 'transform: scale(0.95);' : ''"
            @click="(e) => onRowClick(e, props.row)"
          >
            <q-card
              bordered
              flat
              :class="
                props.selected
                  ? $q.dark.isActive
                    ? 'bg-grey-9'
                    : 'bg-grey-2'
                  : ''
              "
            >
              <q-card-section> {{ props.row.name }} </q-card-section>
              <q-separator />
              <q-img :src="getPreviewImage(props.row.id)" />
            </q-card>
          </div>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<style scoped></style>
