import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useCollectionDataAccess } from 'stores/data-access';
import {
  CollectionDAtoState,
  CollectionState,
  ImageState,
  MetaElementState,
} from 'src/types';
import { ImageAddDto } from 'src/stores';

export const useCurrentCollectionState = defineStore(
  'currentCollectionState',
  () => {
    // Store
    const collectionDA = useCollectionDataAccess();

    // State - individual refs for all properties
    const id = ref('');
    const name = ref('');
    const description = ref('');
    const info = ref('');
    const confidence = ref<number | undefined>(undefined);
    const work_state = ref<string | undefined>(undefined);
    const image_count = ref(0);
    const detection_count = ref(0);
    const annotated_detection_count = ref(0);
    const images = ref<ImageState[]>([]);
    const meta_elements = ref<MetaElementState[]>([]);
    const volumes = ref<MetaElementState[]>([]);
    const titles = ref<MetaElementState[]>([]);
    const issues = ref<MetaElementState[]>([]);
    const chapters = ref<MetaElementState[]>([]);
    const articles = ref<MetaElementState[]>([]);
    const edited = ref(false);
    const selectedImageId = ref<string>('');

    const loading = ref(false);
    const loaded = ref(false);
    const error = ref('');

    // Computed property to build collection object from individual refs
    const collection = computed<CollectionState>(() => ({
      id: id.value,
      name: name.value,
      description: description.value,
      info: info.value,
      confidence: confidence.value,
      work_state: work_state.value,
      image_count: image_count.value,
      detection_count: detection_count.value,
      annotated_detection_count: annotated_detection_count.value,
      images: images.value,
      meta_elements: meta_elements.value,
      volumes: volumes.value,
      titles: titles.value,
      issues: issues.value,
      chapters: chapters.value,
      articles: articles.value,
      edited: edited.value,
    }));

    //
    const imagesGetter = computed(() => {
      if (images.value) {
        return images.value;
      } else {
        console.error('Images not found');
        return [];
      }
    });

    const setLoading = (isLoading: boolean) => {
      loading.value = isLoading;
    };

    // API Calls

    const init = () => {
      return;
    };

    const resetState = () => {
      id.value = '';
      name.value = '';
      description.value = '';
      info.value = '';
      confidence.value = undefined;
      work_state.value = undefined;
      image_count.value = 0;
      detection_count.value = 0;
      annotated_detection_count.value = 0;
      images.value = [];
      meta_elements.value = [];
      volumes.value = [];
      titles.value = [];
      issues.value = [];
      chapters.value = [];
      articles.value = [];
      edited.value = false;
      selectedImageId.value = '';

      loaded.value = false;
      edited.value = false;
      error.value = '';
    };

    const loadCollection = async (collectionId: string) => {
      setLoading(true);
      // Reset the current state to ensure we don't show stale data
      resetState();

      try {
        // Use the collectionDA to load the collection
        const result = await collectionDA.loadCollection(collectionId);

        if (result.error) {
          error.value = result.error;
          console.error('Failed to load collection:', error.value);
        } else if (collectionDA.collection) {
          const collectionState = CollectionDAtoState(collectionDA.collection);

          // Update all individual refs
          id.value = collectionState.id;
          name.value = collectionState.name;
          description.value = collectionState.description;
          info.value = collectionState.info;
          confidence.value = collectionState.confidence;
          work_state.value = collectionState.work_state;
          image_count.value = collectionState.image_count;
          detection_count.value = collectionState.detection_count;
          annotated_detection_count.value =
            collectionState.annotated_detection_count;
          images.value = collectionState.images;
          meta_elements.value = collectionState.meta_elements;
          volumes.value = collectionState.volumes || [];
          titles.value = collectionState.titles || [];
          issues.value = collectionState.issues || [];
          chapters.value = collectionState.chapters || [];
          articles.value = collectionState.articles || [];
          edited.value = collectionState.edited;

          // Clear selected image when loading a new collection
          selectedImageId.value = '';

          loaded.value = true;
          console.log(
            `Loaded collection ${id.value} with ${images.value?.length || 0} images`,
          );
        } else {
          error.value = 'Collection data not available after load';
          console.error('Collection data not available after load');
        }
      } catch (e) {
        error.value = 'Error loading collection';
        console.error('Error in loadCollection:', e);
      } finally {
        setLoading(false);
      }
    };

    const uploadImageToCollection = async (imageToAdd: ImageAddDto) => {
      console.log('uploadImageToCollection');
      setLoading(true);
      console.log(imageToAdd);
      try {
        // Use the collectionDA to upload the image
        const result = await collectionDA.uploadImageToCollection(imageToAdd);

        if (result.error) {
          error.value = result.error;
          console.error('Failed to upload image:', error.value);
        } else {
          // Reload the collection to reflect the new image
          await loadCollection(imageToAdd.collection_id);
        }
      } catch (e) {
        error.value = 'Error uploading image';
        console.error('Error in uploadImageToCollection:', e);
      } finally {
        setLoading(false);
      }
    };

    const getImageById = (imageId: string) => {
      console.log(`Getting image ${imageId} from collection`);

      if (!loaded.value) {
        console.error('Collection not loaded');
        return null;
      }

      if (!images.value) {
        console.error('No images in collection');
        return null;
      }

      const image = images.value.find((i) => i.id === imageId);
      if (image) {
        console.log(
          `Found image ${imageId} with ${image.detections?.length || 0} detections`,
        );
        return image;
      }

      console.error(`Image ${imageId} not found in collection`);
      return null;
    };

    const selectImage = (imageId: string) => {
      console.log(`Selecting image ${imageId} in collection ${id.value}`);
      if (!imageId) {
        selectedImageId.value = '';
        return;
      }

      // Verify image exists in collection
      const image = getImageById(imageId);
      if (image) {
        selectedImageId.value = imageId;
      } else {
        console.error(
          `Cannot select image ${imageId} - not found in collection`,
        );
      }
    };

    const reloadCollection = async () => {
      if (id.value) {
        await loadCollection(id.value);
      } else {
        console.error('No collection loaded to reload');
      }
    };

    return {
      // Expose individual properties
      id,
      name,
      description,
      info,
      confidence,
      work_state,
      image_count,
      detection_count,
      annotated_detection_count,
      images,
      meta_elements,
      volumes,
      titles,
      issues,
      chapters,
      articles,
      edited,
      selectedImageId,

      // Expose computed collection for backward compatibility
      collection,

      loading,
      loaded,
      error,
      setLoading,
      init,
      loadCollection,
      uploadImageToCollection,
      getImageById,
      selectImage,
      imagesGetter,
      reloadCollection,
      resetState,
    };
  },
);
