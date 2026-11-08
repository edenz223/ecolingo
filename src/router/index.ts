import { route } from 'quasar/wrappers';
import { createRouter, createWebHashHistory } from 'vue-router';

// Quasar CLI requires a router; the app has a single view.
export default route(function () {
  return createRouter({
    history: createWebHashHistory(),
    routes: [{ path: '/', component: () => import('layouts/MainLayout.vue') }],
  });
});
