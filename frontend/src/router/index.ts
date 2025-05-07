import { route } from 'quasar/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';
import { useLoadingState } from 'src/stores/app/loadingState';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Add global navigation guards for loading state
  Router.beforeEach((to, from, next) => {
    const loadingState = useLoadingState();

    // If navigating to image detail page from collection page
    if (from.name === 'collection' && to.name === 'image') {
      // Ensure loading state is active (in case it was missed)
      if (loadingState.currentOperation !== 'navigatingToImage') {
        loadingState.startLoading('navigatingToImage', 'Loading image...');
      }
    }

    // If navigating to collection detail page from collections list
    if (from.name === 'collections' && to.name === 'collection') {
      // Ensure loading state is active (in case it was missed)
      if (loadingState.currentOperation !== 'navigatingToCollection') {
        loadingState.startLoading(
          'navigatingToCollection',
          'Loading collection...',
        );
      }
    }

    // Avoid conflicting loading states
    if (
      to.name === 'collections' &&
      loadingState.currentOperation === 'navigatingToCollections'
    ) {
      // Allow the loading state to be handled by the collections page component
      console.log(
        'Navigation to collections in progress, handling in component',
      );
    }

    next();
  });

  Router.afterEach((to) => {
    // Clean up any lingering navigation loading states
    const loadingState = useLoadingState();

    // Wait for the DOM to update before stopping the loading indicators
    setTimeout(() => {
      // Handle image navigation loading state
      if (loadingState.currentOperation === 'navigatingToImage') {
        loadingState.stopLoading('navigatingToImage');
      }

      // Handle collection navigation loading state
      if (
        loadingState.currentOperation === 'navigatingToCollection' &&
        to.name === 'collection'
      ) {
        loadingState.stopLoading('navigatingToCollection');
      }

      // Handle collections navigation loading state - make sure it's stopped after a delay
      // to avoid race conditions with the page component's own loading
      if (
        loadingState.currentOperation === 'navigatingToCollections' &&
        to.name === 'collections'
      ) {
        // Use a shorter timeout than the failsafe in the component
        setTimeout(() => {
          if (loadingState.currentOperation === 'navigatingToCollections') {
            loadingState.stopLoading('navigatingToCollections');
          }
        }, 1000);
      }
    }, 300); // Shortened the main delay to make navigation feel more responsive
  });

  return Router;
});
