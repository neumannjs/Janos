import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

// Create Vue app
const app = createApp(App);

// Create Pinia store
const pinia = createPinia();
app.use(pinia);

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('./views/EditorView.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('./views/AuthCallback.vue'),
    },
  ],
});

app.use(router);

// Mount app
app.mount('#app');
