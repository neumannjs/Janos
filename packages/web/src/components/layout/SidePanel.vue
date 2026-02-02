<script setup lang="ts">
import { computed } from 'vue';
import { useUIStore } from '../../stores/ui';
import ExplorerPanel from '../panels/ExplorerPanel.vue';
import BuildPanel from '../panels/BuildPanel.vue';
import PluginsPanel from '../panels/PluginsPanel.vue';
import ThemesPanel from '../panels/ThemesPanel.vue';
import GitPanel from '../panels/GitPanel.vue';

const uiStore = useUIStore();

const panelTitle = computed(() => {
  switch (uiStore.activePanel) {
    case 'explorer':
      return 'Explorer';
    case 'build':
      return 'Build';
    case 'plugins':
      return 'Plugins';
    case 'themes':
      return 'Themes';
    case 'git':
      return 'Source Control';
    default:
      return '';
  }
});
</script>

<template>
  <div class="side-panel">
    <div class="side-panel-header">
      {{ panelTitle }}
    </div>
    <div class="side-panel-content">
      <KeepAlive>
        <ExplorerPanel v-if="uiStore.activePanel === 'explorer'" />
        <BuildPanel v-else-if="uiStore.activePanel === 'build'" />
        <PluginsPanel v-else-if="uiStore.activePanel === 'plugins'" />
        <ThemesPanel v-else-if="uiStore.activePanel === 'themes'" />
        <GitPanel v-else-if="uiStore.activePanel === 'git'" />
      </KeepAlive>
    </div>
  </div>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.side-panel-header {
  flex-shrink: 0;
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.side-panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
