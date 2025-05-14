import { createApiService } from './apiFactory';
import {
  MetaRoleDetection,
  MetaRoleDetectionNew,
  MetaRoleDetectionUpdate,
} from 'src/stores/data/types';

const crudMetaRoleDetectionApi = createApiService<
  MetaRoleDetection,
  MetaRoleDetectionNew,
  MetaRoleDetectionUpdate
>({
  basePath: '/meta_element_detection',
  entityName: 'meta-role-detection',
});

export const metaRoleDetectionApi = {
  ...crudMetaRoleDetectionApi,
};
