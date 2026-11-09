import { defineRouter } from '#q-app';
import { createRouter, createWebHashHistory } from 'vue-router';

// Quasar CLI requires a router; the app has a single view.
export default defineRouter(function () {
  return createRouter({
    history: createWebHashHistory(),
    routes: [{ path: '/', component: () => import('@/layouts/MainLayout.vue') }],
  });
});
