import {
  CollectionDA,
  ImageDA,
  DetectionState,
  MetaRoleOption,
} from 'src/types';
import { ImageAddDto } from 'src/stores/image/types';
import { CollectionAddDto, Collection } from 'src/stores/collection/types';

// Response type for all data-access operations
export interface DAResponse<T = unknown> {
  data?: T;
  error?: string;
  success?: boolean;
}

// Interface for the collection data access store
export interface ICollectionDataAccess {
  // State
  collection: CollectionDA | undefined;
  collections: CollectionDA[];
  loading: boolean;
  loaded: boolean;
  error: string;
  currentCollectionId: string;

  // Collection methods
  loadCollection(collectionId: string): Promise<DAResponse<CollectionDA>>;
  loadCollections(): Promise<DAResponse<CollectionDA[]>>;
  loadCollectionImages(collectionId: string): Promise<DAResponse<ImageDA[]>>;
  addCollection(collectionData: CollectionAddDto): Promise<DAResponse>;
  editCollection(collectionData: Collection): Promise<DAResponse>;
  deleteCollection(id: string): Promise<DAResponse>;

  // Image methods
  uploadImageToCollection(imageData: ImageAddDto): Promise<DAResponse>;
  importCollection(file: File): Promise<DAResponse>;

  // Detection methods
  createNewDetection(
    detectionData: DetectionState,
  ): Promise<DAResponse<DetectionState>>;
  updateExistingDetection(
    detectionData: DetectionState,
  ): Promise<DAResponse<DetectionState>>;
  deleteDetection(detectionId: string): Promise<DAResponse>;
  getMetaRolesForDetection(
    detectionId: string,
  ): Promise<DAResponse<MetaRoleOption[]>>;

  // Helpers
  getImageById: (imageId: string) => ImageDA | null;
  clearCache(): void;
  resetState(): void;
  init(): void;
}
