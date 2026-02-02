<script setup lang="ts">
import { computed } from 'vue';
import { useUIStore } from '../../stores/ui';
import ActivityBar from './ActivityBar.vue';
import SidePanel from './SidePanel.vue';
import TabBar from './TabBar.vue';
import StatusBar from './StatusBar.vue';

const uiStore = useUIStore();

const sidePanelWidth = computed(() =>
  uiStore.sidePanelCollapsed ? '0px' : '250px'
);
</script>

<template>
  <div class="editor-layout" :class="{ 'side-collapsed': uiStore.sidePanelCollapsed }">
    <ActivityBar class="activity-bar" />
    <SidePanel class="side-panel" />
    <div class="main-area">
      <TabBar class="tab-bar" />
      <div class="editor-content">
        <slot></slot>
      </div>
    </div>
    <StatusBar class="status-bar" />
  </div>
</template>

<style scoped>
.editor-layout {
  display: grid;
  grid-template-columns: 48px v-bind(sidePanelWidth) 1fr;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    "activity side main"
    "status status status";
  height: 100%;
  overflow: hidden;
  transition: grid-template-columns 0.2s ease;
}

.editor-layout.side-collapsed {
  grid-template-columns: 48px 0px 1fr;
}

.activity-bar {
  grid-area: activity;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
}

.side-panel {
  grid-area: side;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.editor-layout.side-collapsed .side-panel {
  display: none;
}

.main-area {
  grid-area: main;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.tab-bar {
  flex-shrink: 0;
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.editor-content {
  flex: 1;
  overflow: hidden;
  background-color: var(--color-bg);
}

.status-bar {
  grid-area: status;
  background-color: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .editor-layout {
    grid-template-columns: 48px 0px 1fr;
  }

  .editor-layout:not(.side-collapsed) {
    grid-template-columns: 48px 100% 0px;
  }

  .editor-layout:not(.side-collapsed) .main-area {
    display: none;
  }
}
</style>
