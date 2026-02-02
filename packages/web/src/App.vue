<script setup lang="ts">
import { onMounted } from 'vue';
import {
  NConfigProvider,
  NNotificationProvider,
  NDialogProvider,
  NMessageProvider,
  NLoadingBarProvider,
  darkTheme,
} from 'naive-ui';
import { useAuthStore } from './stores/auth';
import { janosThemeOverrides } from './theme';

const authStore = useAuthStore();

onMounted(async () => {
  // Try to restore authentication state
  await authStore.restore();
});
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="janosThemeOverrides">
    <NLoadingBarProvider>
      <NNotificationProvider placement="bottom-right">
        <NDialogProvider>
          <NMessageProvider>
            <div id="janos-app">
              <router-view />
            </div>
          </NMessageProvider>
        </NDialogProvider>
      </NNotificationProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
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

html, body, #app {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
}

#janos-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

/* Naive UI global overrides */
.n-config-provider {
  height: 100%;
}
</style>
