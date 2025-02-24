import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('pages/CollectionsPage.vue'),
      },
      {
        path: 'new',
        name: 'new',
        component: () => import('pages/NewLabelSystemPage.vue'),
      },

      {
        path: 'collections',
        name: 'collections',
        component: () => import('pages/CollectionsPage.vue'),
      },
      {
        path: 'dev',
        name: 'dev',
        component: () => import('pages/DevPage.vue'),
      },
    ],
  },
  {
    path: '/collections',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: ':collectionId',
        name: 'collection',
        component: () => import('pages/CollectionDetail.vue'),
      },
    ],
  },
  {
    path: '/collections/:collectionId',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: ':imageId',
        name: 'image',
        component: () => import('pages/NewLabelSystemPage.vue'),
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
