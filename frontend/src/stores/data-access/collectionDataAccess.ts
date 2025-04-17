import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  CollectionDA,
  ImageDA,
  DetectionState,
  MetaRoleOption,
} from 'src/types'; // Removed unused WorkState, MetaElementDA, MetaRoleDA, DetectionStateToDa
import {
  getCollection as apiGetCollection,
  getCollections as apiGetCollections,
  getCollectionImages as apiGetCollectionImages,
  addCollection as apiAddCollection,
  editCollection as apiEditCollection,
  deleteCollection as apiDeleteCollection,
  uploadImage as apiUploadImage,
  importCollection as apiImportCollection,
  createDetection as apiCreateDetection,
  updateDetection as apiUpdateDetection,
  deleteDetection as apiDeleteDetection,
  loadMetaRolesForDetection as apiLoadMetaRolesForDetection,
} from 'src/api/services';
import { getMetaRolesForCollection } from 'src/api/metaRoleApiService';
import {
  CollectionAddDto,
  Collection as CollectionType,
} from 'src/stores/collection/types';
import { ImageAddDto } from 'src/stores/image/types';
import { DAResponse } from './types';
import { MetaRoleState } from 'src/types/frontend-state/meta_role.state';

// Cache configuration
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const useCollectionDataAccess = defineStore(
  'collectionDataAccessStore',
  () => {
    // State
    const collection = ref<CollectionDA>();
    const collections = ref<CollectionDA[]>([]);
    const loading = ref(false);
    const loaded = ref(false);
    const error = ref('');
    const currentCollectionId = ref('');
    const availableMetaRoles = ref<MetaRoleState[]>([]);

    // Cache management
    const lastCollectionFetch = ref<Record<string, number>>({});
    const lastCollectionsFetch = ref<number>(0);
    const lastImagesFetch = ref<Record<string, number>>({});
    const pendingRequests = ref<Record<string, Promise<unknown>>>({});

    // Helper functions
    const setLoading = (isLoading: boolean) => {
      loading.value = isLoading;
    };

    const resetState = () => {
      collection.value = undefined;
      loaded.value = false;
      error.value = '';
      availableMetaRoles.value = []; // Reset meta roles when resetting state
    };

    const isCacheValid = (cacheTime: number): boolean => {
      return Date.now() - cacheTime < CACHE_TIMEOUT;
    };

    const generateRequestKey = (operation: string, id?: string): string => {
      return `${operation}${id ? '_' + id : ''}`;
    };

    // Methods with deduplication and caching
    const loadCollection = async (
      collectionId: string,
    ): Promise<DAResponse<CollectionDA>> => {
      // If we're loading a different collection, reset the state
      if (currentCollectionId.value !== collectionId) {
        resetState();
        currentCollectionId.value = collectionId;
      }

      // Check if we already have this collection cached and it's still valid
      if (
        collection.value?.id === collectionId &&
        lastCollectionFetch.value[collectionId] &&
        isCacheValid(lastCollectionFetch.value[collectionId])
      ) {
        console.log(`Using cached collection data for ${collectionId}`);
        return { data: collection.value, error: undefined }; // Return cached data
      }

      // Deduplication: If a request for this collection is already in progress, return that promise
      const requestKey = generateRequestKey('loadCollection', collectionId);
      const existingRequest = pendingRequests.value[requestKey] as
        | Promise<DAResponse<CollectionDA>>
        | undefined;
      if (existingRequest) {
        console.log(
          `Request for collection ${collectionId} already in progress, reusing promise`,
        );
        return existingRequest;
      }

      setLoading(true);
      error.value = '';

      // Create a new promise for this request
      const requestPromise = new Promise<DAResponse<CollectionDA>>(
        async (resolve) => {
          try {
            const response = await apiGetCollection(collectionId); // Use renamed import
            if (response.error) {
              error.value = response.error;
              console.error(response.error);
              resolve({ error: response.error });
            } else if (response.data) {
              collection.value = response.data;
              console.log('collection', collection.value);
              loaded.value = true;
              lastCollectionFetch.value[collectionId] = Date.now();

              // Load meta roles for the collection
              const metaRolesResponse =
                await getMetaRolesForCollection(collectionId);
              if (metaRolesResponse.data && metaRolesResponse.data.length > 0) {
                availableMetaRoles.value = metaRolesResponse.data;
                console.log(
                  `Loaded ${availableMetaRoles.value.length} meta roles for collection ${collectionId}`,
                );
              } else if (metaRolesResponse.error) {
                console.error(
                  `Failed to load meta roles for collection: ${metaRolesResponse.error}`,
                );
              }

              resolve({ data: response.data, error: undefined });
            } else {
              const errorMsg = 'No collection data received';
              error.value = errorMsg;
              console.error(errorMsg);
              resolve({ error: errorMsg });
            }
          } catch (e) {
            const errorMsg = 'Failed to load collection';
            error.value = errorMsg;
            console.error(e);
            resolve({ error: errorMsg });
          } finally {
            setLoading(false);
            // Remove this request from pending requests
            delete pendingRequests.value[requestKey];
          }
        },
      );

      // Store the promise for deduplication
      pendingRequests.value[requestKey] = requestPromise;
      return requestPromise;
    };

    const loadCollections = async (): Promise<DAResponse<CollectionDA[]>> => {
      // Check if we already have collections cached and they're still valid
      if (
        collections.value.length > 0 &&
        lastCollectionsFetch.value &&
        isCacheValid(lastCollectionsFetch.value)
      ) {
        console.log('Using cached collections data');
        return { data: collections.value, error: undefined };
      }

      // Deduplication: If a request for collections is already in progress, return that promise
      const requestKey = generateRequestKey('loadCollections');
      const existingRequest = pendingRequests.value[requestKey] as
        | Promise<DAResponse<CollectionDA[]>>
        | undefined;
      if (existingRequest) {
        console.log(
          'Request for collections already in progress, reusing promise',
        );
        return existingRequest;
      }

      setLoading(true);
      error.value = '';

      // Create a new promise for this request
      const requestPromise = new Promise<DAResponse<CollectionDA[]>>(
        async (resolve) => {
          try {
            const response = await apiGetCollections(); // Use renamed import
            if (response.error) {
              error.value = response.error;
              console.error(response.error);
              resolve({ error: response.error });
            } else {
              // Cast Collection[] to CollectionDA[] - Requires careful type checking or transformation
              // For now, assume Collection is compatible enough or needs mapping
              collections.value = response.data as CollectionDA[];
              lastCollectionsFetch.value = Date.now();
              resolve({ data: collections.value, error: undefined }); // Return the potentially casted data
            }
          } catch (e) {
            const errorMsg = 'Failed to load collections';
            error.value = errorMsg;
            console.error(e);
            resolve({ error: errorMsg });
          } finally {
            setLoading(false);
            // Remove this request from pending requests
            delete pendingRequests.value[requestKey];
          }
        },
      );

      // Store the promise for deduplication
      pendingRequests.value[requestKey] = requestPromise;
      console.log('requestPromise', requestPromise);
      return requestPromise;
    };

    const loadCollectionImages = async (
      collectionId: string,
    ): Promise<DAResponse<ImageDA[]>> => {
      // Check if we already have this collection's images cached and they're still valid
      if (
        collection.value?.id === collectionId &&
        collection.value?.images &&
        lastImagesFetch.value[collectionId] &&
        isCacheValid(lastImagesFetch.value[collectionId])
      ) {
        console.log(`Using cached images data for collection ${collectionId}`);
        return { data: collection.value.images, error: undefined };
      }

      // Deduplication: If a request for this collection's images is already in progress, return that promise
      const requestKey = generateRequestKey(
        'loadCollectionImages',
        collectionId,
      );
      const existingRequest = pendingRequests.value[requestKey] as
        | Promise<DAResponse<ImageDA[]>>
        | undefined;
      if (existingRequest) {
        console.log(
          `Request for collection ${collectionId} images already in progress, reusing promise`,
        );
        return existingRequest;
      }

      setLoading(true);
      error.value = '';

      // Create a new promise for this request
      const requestPromise = new Promise<DAResponse<ImageDA[]>>(
        async (resolve) => {
          try {
            const response = await apiGetCollectionImages(collectionId); // Use renamed import
            if (response.error) {
              error.value = response.error;
              console.error(response.error);
              resolve({ error: response.error });
            } else {
              // Cast Image[] to ImageDA[] - Requires careful type checking or transformation
              // For now, assume Image is compatible enough or needs mapping
              const imagesData = response.data as ImageDA[];

              // Update the collection images if we have the collection loaded
              if (collection.value?.id === collectionId) {
                collection.value.images = imagesData;
              }
              lastImagesFetch.value[collectionId] = Date.now();
              resolve({ data: imagesData, error: undefined });
            }
          } catch (e) {
            const errorMsg = 'Failed to load collection images';
            error.value = errorMsg;
            console.error(e);
            resolve({ error: errorMsg });
          } finally {
            setLoading(false);
            // Remove this request from pending requests
            delete pendingRequests.value[requestKey];
          }
        },
      );

      // Store the promise for deduplication
      pendingRequests.value[requestKey] = requestPromise;
      return requestPromise;
    };

    // Write operations - these invalidate cache
    const addCollection = async (
      collectionData: CollectionAddDto,
    ): Promise<DAResponse> => {
      setLoading(true);
      error.value = '';

      try {
        const errorMsg = await apiAddCollection(collectionData);
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collections cache
          lastCollectionsFetch.value = 0;
          await loadCollections(); // Reload collections
          return { error: undefined, success: true }; // Indicate success
        }
      } catch (e) {
        const errorMsg = 'Failed to add collection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    const editCollection = async (
      collectionData: CollectionType,
    ): Promise<DAResponse> => {
      setLoading(true);
      error.value = '';

      try {
        // API expects Collection, which matches collectionData type now
        const errorMsg = await apiEditCollection(collectionData);
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collections cache and specific collection cache
          lastCollectionsFetch.value = 0;
          // Need to fetch the full CollectionDA after edit if we want to update cache
          // For now, just invalidate the specific collection cache
          if (lastCollectionFetch.value[collectionData.id]) {
            lastCollectionFetch.value[collectionData.id] = 0;
          }

          await loadCollections(); // Reload collections list (might have basic info)

          // If this is our current collection, reload its full DA state
          if (currentCollectionId.value === collectionData.id) {
            // Invalidate specific collection cache before reloading
            if (lastCollectionFetch.value[collectionData.id]) {
              lastCollectionFetch.value[collectionData.id] = 0;
            }
            await loadCollection(collectionData.id); // Reloads the full CollectionDA
          }

          return { error: undefined, success: true }; // Indicate success
        }
      } catch (e) {
        const errorMsg = 'Failed to edit collection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    const deleteCollection = async (id: string): Promise<DAResponse> => {
      setLoading(true);
      error.value = '';

      try {
        const errorMsg = await apiDeleteCollection(id);
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collections cache and specific collection cache
          lastCollectionsFetch.value = 0;
          if (lastCollectionFetch.value[id]) {
            delete lastCollectionFetch.value[id];
          }
          if (lastImagesFetch.value[id]) {
            delete lastImagesFetch.value[id];
          }

          // If this was our current collection, reset state
          if (currentCollectionId.value === id) {
            resetState();
          }

          await loadCollections(); // Reload collections
          return { error: undefined, success: true }; // Indicate success
        }
      } catch (e) {
        const errorMsg = 'Failed to delete collection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    const uploadImageToCollection = async (
      imageData: ImageAddDto,
    ): Promise<DAResponse> => {
      setLoading(true);
      error.value = '';

      try {
        const errorMsg = await apiUploadImage(imageData);
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collection images cache
          if (lastImagesFetch.value[imageData.collection_id]) {
            lastImagesFetch.value[imageData.collection_id] = 0;
          }

          // Reload collection images if this is our current collection
          if (currentCollectionId.value === imageData.collection_id) {
            await loadCollection(imageData.collection_id);
            await loadCollectionImages(imageData.collection_id);
          }

          return { error: undefined, success: true }; // Indicate success
        }
      } catch (e) {
        const errorMsg = 'Failed to upload image';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    const importCollection = async (file: File): Promise<DAResponse> => {
      setLoading(true);
      error.value = '';

      try {
        const errorMsg = await apiImportCollection(file);
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collections cache
          lastCollectionsFetch.value = 0;
          await loadCollections(); // Reload collections
          return { error: undefined, success: true }; // Indicate success
        }
      } catch (e) {
        const errorMsg = 'Failed to import collection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    // Detection-related methods
    const createNewDetection = async (
      detectionData: DetectionState,
    ): Promise<DAResponse<DetectionState>> => {
      setLoading(true);
      error.value = '';

      try {
        const errorMsg = await apiCreateDetection(detectionData); // Returns string
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collection cache as detections have changed
          if (
            collection.value &&
            lastCollectionFetch.value[collection.value.id]
          ) {
            lastCollectionFetch.value[collection.value.id] = 0;
          }
          // Cannot return data as API only returns error string or empty
          return { data: undefined, error: undefined, success: true };
        }
      } catch (e) {
        const errorMsg = 'Failed to create detection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    const updateExistingDetection = async (
      detectionData: DetectionState,
    ): Promise<DAResponse<DetectionState>> => {
      setLoading(true);
      error.value = '';

      try {
        const errorMsg = await apiUpdateDetection(detectionData); // Returns string
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collection cache as detections have changed
          if (
            collection.value &&
            lastCollectionFetch.value[collection.value.id]
          ) {
            lastCollectionFetch.value[collection.value.id] = 0;
          }
          // Cannot return data as API only returns error string or empty
          return { data: undefined, error: undefined, success: true };
        }
      } catch (e) {
        const errorMsg = 'Failed to update detection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    const deleteDetection = async (
      detectionId: string,
    ): Promise<DAResponse> => {
      setLoading(true);
      error.value = '';

      try {
        const errorMsg = await apiDeleteDetection(detectionId);
        if (errorMsg) {
          error.value = errorMsg;
          console.error(errorMsg);
          return { error: errorMsg };
        } else {
          // Invalidate collection cache as detections have changed
          if (
            collection.value &&
            lastCollectionFetch.value[collection.value.id]
          ) {
            lastCollectionFetch.value[collection.value.id] = 0;
          }
          return { error: undefined, success: true }; // Indicate success
        }
      } catch (e) {
        const errorMsg = 'Failed to delete detection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    const getMetaRolesForDetection = async (
      detectionId: string,
    ): Promise<DAResponse<MetaRoleOption[]>> => {
      setLoading(true);
      error.value = '';

      try {
        const response = await apiLoadMetaRolesForDetection(detectionId); // Use renamed import
        if (response.error) {
          error.value = response.error;
          console.error(response.error);
          return { error: response.error };
        } else {
          return { data: response.data, error: undefined };
        }
      } catch (e) {
        const errorMsg = 'Failed to load meta roles for detection';
        error.value = errorMsg;
        console.error(e);
        return { error: errorMsg };
      } finally {
        setLoading(false);
      }
    };

    // Computed properties and helpers
    const getImageById = computed(() => (imageId: string): ImageDA | null => {
      if (!collection.value?.images) return null;
      return (
        collection.value.images.find((img: ImageDA) => img.id === imageId) ||
        null
      );
    });

    const clearCache = () => {
      lastCollectionFetch.value = {};
      lastCollectionsFetch.value = 0;
      lastImagesFetch.value = {};
    };

    const init = () => {
      // Initialize store
      return;
    };

    // Return the state and methods
    return {
      collection,
      collections,
      loading,
      loaded,
      error,
      currentCollectionId,
      availableMetaRoles,
      init,
      loadCollection,
      loadCollections,
      loadCollectionImages,
      addCollection,
      editCollection,
      deleteCollection,
      uploadImageToCollection,
      importCollection,
      createNewDetection,
      updateExistingDetection,
      deleteDetection,
      getMetaRolesForDetection,
      getImageById,
      clearCache,
      resetState,
    };
  },
);
