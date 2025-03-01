<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { ref } from 'vue';
import {
  Image,
  ImageAddDto,
  useCollectionStore,
  useImageStore,
} from 'src/stores';
import { getPreviewImage } from 'utils';
import { useCollectionDataAccessStore } from 'stores/data-access';

const route = useRoute();
const router = useRouter();
const collectionStore = useCollectionStore();
const collectionDAStore = useCollectionDataAccessStore();
const imageStore = useImageStore();
const collectionId = route.params.collectionId as string;
collectionStore.loadImagesInCollection(collectionId);
collectionDAStore.loadCollection(collectionId);
const grid = ref(true);
const fileTypes = 'image/*';
console.log(collectionDAStore.collection);

const isAddOpen = ref(false);
const imageToAdd = ref<ImageAddDto>({
  collection_id: collectionId,
  order: 0,
  file: undefined,
});
const onRowClick = (_evt: Event, row: Image) => {
  imageStore.loadImage(row.id);
  router.push({
    name: 'image',
    params: {
      imageId: row.id,
    },
  });
};

const handleUpload = async () => {
  await collectionStore.uploadImageToCollection(imageToAdd.value);
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
        :rows="collectionStore.images"
        row-key="name"
        :loading="collectionStore.loading"
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
            :disable="collectionStore.loading"
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
