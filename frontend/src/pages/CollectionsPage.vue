<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'vue-router';
import { CollectionNewType, CollectionType } from 'src/types';
import { useCollections } from 'src/stores';
import { storeToRefs } from 'pinia';
import { useLoadingState } from 'src/stores';
import { useQuasar } from 'quasar';

defineOptions({
  name: 'CollectionsPage',
});

const $q = useQuasar();
const router = useRouter();
const collectionsStore = useCollections();
const loadingState = useLoadingState();

async function loadDataAccess() {
  loadingState.startLoading('loadingCollections', 'Loading collections...');
  try {
    await collectionsStore.loadCollections();
  } catch (error) {
    console.error('Error loading collections:', error);
    $q.notify({
      type: 'negative',
      message: 'Failed to load collections',
      position: 'top',
    });
  } finally {
    loadingState.stopLoading('loadingCollections');
  }
}

onMounted(() => {
  // First check if we're already in a navigation loading state
  if (loadingState.currentOperation === 'navigatingToCollections') {
    // We're already loading from navigation, so wait for that to finish
    // before starting our own loading state
    const checkLoading = setInterval(() => {
      if (loadingState.currentOperation !== 'navigatingToCollections') {
        clearInterval(checkLoading);
        loadDataAccess();
      }
    }, 100);

    // Failsafe in case the navigation loading state gets stuck
    setTimeout(() => {
      clearInterval(checkLoading);
      // If still in navigating state after timeout, force stop it
      if (loadingState.currentOperation === 'navigatingToCollections') {
        loadingState.stopLoading('navigatingToCollections');
        loadDataAccess();
      }
    }, 2000);
  } else {
    // Normal case - no navigation in progress
    loadDataAccess();
  }
});

const { collectionsGetter, loading } = storeToRefs(collectionsStore);

// Compute a thumbnail for each collection (placeholder logic)
const getCollectionThumbnail = (collection: CollectionType) => {
  // Use the first letter of the collection name for a color
  const letter = collection.name.charAt(0).toUpperCase();
  const hue = (letter.charCodeAt(0) - 65) * 15; // Generate a color based on first letter
  return `hsl(${hue}, 70%, 60%)`;
};

const isAddOpen = ref(false);
const isImportOpen = ref(false);
const collectionToAdd = ref<CollectionNewType>({
  description: '',
  id: uuidv4(),
  info: '',
  name: '',
});
const collectionToImport = ref<File | null>(null);

const handleCreate = async () => {
  if (!collectionToAdd.value.name) {
    $q.notify({
      type: 'warning',
      message: 'Collection name is required',
      position: 'top',
    });
    return;
  }

  loadingState.startLoading('addingCollection', 'Creating collection...');
  try {
    await collectionsStore.addCollection(collectionToAdd.value);
    $q.notify({
      type: 'positive',
      message: 'Collection created successfully',
      position: 'top',
    });
    handleResetAdd();
    isAddOpen.value = false;
  } catch (error) {
    console.error('Error creating collection:', error);
    $q.notify({
      type: 'negative',
      message: 'Failed to create collection',
      position: 'top',
    });
  } finally {
    loadingState.stopLoading('addingCollection');
  }
};

const handleResetAdd = () => {
  collectionToAdd.value.description = '';
  collectionToAdd.value.info = '';
  collectionToAdd.value.name = '';
  collectionToAdd.value.id = uuidv4(); // Generate a new ID
};

const handleImport = async () => {
  if (collectionToImport.value) {
    loadingState.startLoading('importingCollection', 'Importing collection...');
    try {
      await collectionsStore.importCollection(collectionToImport.value);
      $q.notify({
        type: 'positive',
        message: 'Collection imported successfully',
        position: 'top',
      });
      handleResetImport();
      isImportOpen.value = false;
    } catch (error) {
      console.error('Error importing collection:', error);
      $q.notify({
        type: 'negative',
        message: 'Failed to import collection',
        position: 'top',
      });
    } finally {
      loadingState.stopLoading('importingCollection');
    }
  } else {
    $q.notify({
      type: 'warning',
      message: 'Please select a file to import',
      position: 'top',
    });
  }
};

const handleResetImport = () => {
  collectionToImport.value = null;
};

const onRowClick = (_evt: Event, row: CollectionType) => {
  // 1. Use the loadingState store to show global loading overlay IMMEDIATELY
  loadingState.startLoading('navigatingToCollection', 'Loading collection...');

  // 2. Force the UI to fully update by using a small timeout
  //    This ensures the loading state is fully rendered before navigation
  setTimeout(() => {
    // 3. Then navigate to the collection detail page
    router
      .push({
        name: 'collection',
        params: { collectionId: row.id },
      })
      .catch((error) => {
        console.error('Navigation error:', error);
        loadingState.stopLoading('navigatingToCollection');
      });
  }, 50); // Small timeout to ensure loading state is fully rendered
};
</script>

<template>
  <q-page padding>
    <div class="collections-container">
      <div class="collections-header">
        <h1 class="text-h4 q-mb-sm">Collections</h1>
        <p class="text-subtitle1 q-mb-lg text-grey-7">
          Manage and organize your document collections
        </p>

        <!-- Action buttons -->
        <div class="actions-container">
          <q-btn
            icon="upload_file"
            label="Import"
            color="primary"
            outline
            class="q-mr-sm"
            @click="isImportOpen = true"
          />
          <q-btn
            icon="add"
            label="New Collection"
            color="primary"
            @click="isAddOpen = true"
          />
        </div>
      </div>

      <!-- Custom skeleton that matches the grid layout -->
      <div
        v-if="loading || loadingState.currentOperation === 'loadingCollections'"
        class="collections-grid"
      >
        <q-card v-for="n in 6" :key="n" class="collection-card" flat bordered>
          <q-skeleton height="120px" class="collection-preview" square />
          <q-card-section>
            <q-skeleton type="text" class="text-h6" />
            <q-skeleton type="text" class="q-mt-sm" />
            <q-skeleton type="text" width="60%" class="q-mt-xs" />
          </q-card-section>
          <q-card-actions>
            <q-skeleton type="QBtn" width="80px" />
          </q-card-actions>
        </q-card>
      </div>

      <!-- No collections message -->
      <div v-else-if="collectionsGetter.length === 0" class="empty-state">
        <q-icon name="folder" size="4rem" color="grey-5" />
        <p class="text-h6 q-mt-md">No collections found</p>
        <p class="text-subtitle1 text-grey-7">
          Get started by creating a new collection or importing one
        </p>
        <div class="q-mt-lg">
          <q-btn
            icon="add"
            label="New Collection"
            color="primary"
            @click="isAddOpen = true"
          />
        </div>
      </div>

      <!-- Collections grid view -->
      <div v-else class="collections-grid">
        <q-card
          v-for="collection in collectionsGetter"
          :key="collection.id"
          class="collection-card"
          flat
          bordered
          @click="onRowClick($event, collection)"
        >
          <q-card-section
            class="collection-preview"
            :style="{ backgroundColor: getCollectionThumbnail(collection) }"
          >
            <div class="collection-letter">
              {{ collection.name.charAt(0).toUpperCase() }}
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-h6 ellipsis">{{ collection.name }}</div>
            <div class="text-caption text-grey-7 ellipsis-2-lines">
              {{ collection.description }}
            </div>
          </q-card-section>
          <q-card-actions>
            <q-btn flat color="primary" label="Open" icon="open_in_new" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <!-- Add Collection Dialog -->
    <q-dialog v-model="isAddOpen" persistent>
      <q-card style="min-width: 400px; max-width: 90vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">New Collection</div>
          <q-space />
          <q-btn
            icon="close"
            flat
            round
            dense
            v-close-popup
            @click="handleResetAdd"
          />
        </q-card-section>

        <q-form @submit="handleCreate" @reset="handleResetAdd">
          <q-card-section class="q-pt-lg">
            <q-input
              v-model="collectionToAdd.name"
              label="Collection Name *"
              filled
              autofocus
              :rules="[(val) => !!val || 'Name is required']"
            >
              <template v-slot:prepend>
                <q-icon name="folder" />
              </template>
            </q-input>

            <q-input
              v-model="collectionToAdd.description"
              label="Description"
              filled
              class="q-mt-md"
              type="textarea"
              rows="3"
            >
              <template v-slot:prepend>
                <q-icon name="description" />
              </template>
            </q-input>

            <q-input
              v-model="collectionToAdd.info"
              label="Additional Information"
              filled
              class="q-mt-md"
            >
              <template v-slot:prepend>
                <q-icon name="info" />
              </template>
            </q-input>
          </q-card-section>

          <q-card-actions align="right" class="q-pa-md">
            <q-btn
              label="Cancel"
              color="grey"
              flat
              v-close-popup
              @click="handleResetAdd"
            />
            <q-btn
              label="Create"
              type="submit"
              color="primary"
              :loading="loadingState.currentOperation === 'addingCollection'"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- Import Collection Dialog -->
    <q-dialog v-model="isImportOpen" persistent>
      <q-card style="min-width: 400px; max-width: 90vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">Import Collection</div>
          <q-space />
          <q-btn
            icon="close"
            flat
            round
            dense
            v-close-popup
            @click="handleResetImport"
          />
        </q-card-section>

        <q-form @submit="handleImport" @reset="handleResetImport">
          <q-card-section class="q-pt-lg">
            <p>Please upload your collection in the YOLO format (ZIP file)</p>

            <q-file
              v-model="collectionToImport"
              label="Select ZIP file"
              filled
              accept=".zip"
              clearable
              :rules="[(val) => !!val || 'Please select a file']"
            >
              <template v-slot:prepend>
                <q-icon name="attach_file" />
              </template>
              <template v-slot:append v-if="collectionToImport">
                <q-icon
                  name="close"
                  @click.stop="collectionToImport = null"
                  class="cursor-pointer"
                />
              </template>
            </q-file>
          </q-card-section>

          <q-card-actions align="right" class="q-pa-md">
            <q-btn
              label="Cancel"
              color="grey"
              flat
              v-close-popup
              @click="handleResetImport"
            />
            <q-btn
              label="Import"
              type="submit"
              color="primary"
              :loading="loadingState.currentOperation === 'importingCollection'"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.collections-container {
  max-width: 1280px;
  margin: 0 auto;
}

.collections-header {
  margin-bottom: 2rem;
}

.actions-container {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 1.5rem;
}

.loading-container {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  background-color: #f8f8f8;
  border-radius: 8px;
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.collection-card {
  transition: all 0.3s ease;
  cursor: pointer;
  height: 100%;
}

.collection-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.collection-preview {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.collection-letter {
  font-size: 3.5rem;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ellipsis-2-lines {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 2.8em;
}
</style>
