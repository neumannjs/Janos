<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();

onMounted(async () => {
  // Try to restore authentication state
  await authStore.restore();
});
</script>

<template>
  <div id="janos-app">
    <router-view />
  </div>
</template>

<style>
:root {
  --color-bg: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-bg-tertiary: #0f3460;
  --color-primary: #e94560;
  --color-text: #eaeaea;
  --color-text-secondary: #a0a0a0;
  --color-border: #2a2a4a;
  --color-success: #00d26a;
  --color-warning: #ffaa00;
  --color-error: #ff4757;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
}

#janos-app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

a {
  color: var(--color-primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

button {
  cursor: pointer;
  font-family: inherit;
}
</style>
