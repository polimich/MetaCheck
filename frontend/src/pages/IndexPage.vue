<template>
  <q-page class="items-center justify-evenly">
    <div class="row">
      <q-list class="full-width">
        <q-item
          v-for="collection in collectionStore.collections"
          v-bind:key="collection.id"
          clickable
          v-ripple
        >
          <q-item-section>
            <q-item-label>
              {{ collection.name }}
            </q-item-label>
            <q-item-label caption>
              {{ collection.description }}
            </q-item-label>
            <q-item-label caption>
              {{ collection.info }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              icon="edit"
              @click="handleUpdate(collection.id)"
            />
            <q-btn
              flat
              dense
              icon="delete"
              @click="handleDelete(collection.id)"
            />
          </q-item-section>
        </q-item>
      </q-list>
    </div>
    <div class="row q-gutter-xs">
      <q-input filled v-model="name" label="Name" />
      <q-input filled v-model="description" label="Description" />
      <q-input filled v-model="info" label="Info" />
      <q-btn @click="handleCreate"> Create </q-btn>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useCollectionStore } from 'src/stores';
defineOptions({
  name: 'IndexPage',
});
const collectionStore = useCollectionStore();

const name = ref('');
const description = ref('');
const info = ref('');

const handleCreate = async () => {
  await collectionStore.addCollection({
    id: uuidv4(),
    name: name.value,
    description: description.value,
    info: info.value,
  });
};

// const handleEdit = async (collection: Collection) => {
//   await collectionStore.editCollection(collection);
// };

const handleDelete = async (id: string) => {
  await collectionStore.deleteCollection(id);
};

const handleUpdate = async (collectionId: string) => {
  await collectionStore.getCollectionImages(collectionId);
};

onMounted(async () => {
  await collectionStore.loadCollections();
});
</script>
