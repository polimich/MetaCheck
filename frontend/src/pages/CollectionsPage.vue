<script setup lang="ts">
import { QTableProps } from 'quasar';
import { CollectionAddDto, useCollectionStore } from 'src/stores';
import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'vue-router';

defineOptions({
  name: 'CollectionsPage',
});
const router = useRouter();
const dataStore = useCollectionStore();
dataStore.loadCollections();

const columns: QTableProps['columns'] = [
  {
    name: 'id',
    label: 'ID',
    align: 'left',
    field: 'id',
    sortable: true,
  },
  {
    name: 'name',
    label: 'Name',
    align: 'left',
    field: 'name',
    sortable: true,
  },
  {
    align: 'left',
    field: 'name',
    label: 'Description',
    name: 'description',
    sortable: true,
  },
  {
    align: 'left',
    field: 'info',
    label: 'Info',
    name: 'info',
    sortable: true,
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'right',
    field: 'id',
  },
];
const visibleColumns = ['name', 'description', 'info', 'actions'];
const isAddOpen = ref(false);
const isImportOpen = ref(false);
const collectionToAdd = ref<CollectionAddDto>({
  description: '',
  id: uuidv4(),
  info: '',
  name: '',
});
const collectionToImport = ref<File | null>(null);

const handleCreate = async () => {
  await dataStore.addCollection(collectionToAdd.value);
};

const handleResetAdd = () => {
  collectionToAdd.value.description = '';
  collectionToAdd.value.info = '';
  collectionToAdd.value.name = '';
};

const handleImport = async () => {
  if (collectionToImport.value) {
    await dataStore.importCollection(collectionToImport.value);
  }
};

const handleResetImport = () => {
  collectionToImport.value = null;
};

const onRowClick = (_evt: Event, row: CollectionAddDto) => {
  router.push({
    name: 'collection',
    params: { collectionId: row.id },
  });
};
</script>

<template>
  <div class="q-pa-md">
    <q-table
      title="Collections"
      :rows="dataStore.collections"
      :columns="columns"
      :visible-columns="visibleColumns"
      row-key="name"
      :loading="dataStore.loading"
      @row-click="onRowClick"
    >
      <template v-slot:top-right>
        <q-btn
          color="primary"
          label="Import"
          class="q-mx-sm"
          :disable="dataStore.loading"
          @click="isImportOpen = true"
        />
        <q-btn
          round
          color="primary"
          icon="add"
          :disable="dataStore.loading"
          @click="isAddOpen = true"
        />

        <q-dialog v-model="isAddOpen" @hide="handleResetAdd">
          <q-card style="min-width: 400px">
            <q-form @submit="handleCreate" @reset="handleResetAdd">
              <q-card-section>
                <div class="text-h6">Add dialog</div>
              </q-card-section>
              <q-card-section class="q-pt-none">
                <q-input
                  autofocus
                  filled
                  v-model="collectionToAdd.name"
                  label="Collection Name"
                  hint="What do you want to call this collection?"
                  lazy-rules
                  :rules="[
                    (val) => (val && val.length > 0) || 'Please type something',
                  ]"
                />

                <q-input
                  filled
                  v-model="collectionToAdd.description"
                  label="Collection description"
                  lazy-rules
                  :rules="[
                    (val) => (val && val.length > 0) || 'Please type something',
                  ]"
                />
                <q-input
                  filled
                  v-model="collectionToAdd.info"
                  label="Collection info"
                  lazy-rules
                  :rules="[
                    (val) => (val && val.length > 0) || 'Please type something',
                  ]"
                />
              </q-card-section>

              <q-card-actions align="right">
                <q-btn
                  flat
                  label="Add"
                  color="primary"
                  v-close-popup
                  type="submit"
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
        <q-dialog v-model="isImportOpen" @hide="handleResetImport">
          <q-card style="min-width: 400px">
            <q-form @submit="handleImport" @reset="handleResetImport">
              <q-card-section>
                <div class="text-h6">Import Collection</div>
                <div>Please upload your collection in the YOLO format</div>
              </q-card-section>
              <q-card-section class="q-pt-none">
                <q-file
                  filled
                  label="Upload zip-file"
                  v-model="collectionToImport"
                  :accept="'.zip'"
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  flat
                  label="Import"
                  color="primary"
                  v-close-popup
                  type="submit"
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
    </q-table>
  </div>
</template>

<style scoped></style>
