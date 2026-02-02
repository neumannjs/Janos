<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui';
import {
  FolderOpenOutline,
  HammerOutline,
  ExtensionPuzzleOutline,
  ColorPaletteOutline,
  GitBranchOutline,
} from '@vicons/ionicons5';
import { useUIStore, type PanelType } from '../../stores/ui';

const uiStore = useUIStore();

interface ActivityItem {
  id: PanelType;
  icon: typeof FolderOpenOutline;
  label: string;
}

const activities: ActivityItem[] = [
  { id: 'explorer', icon: FolderOpenOutline, label: 'Explorer' },
  { id: 'build', icon: HammerOutline, label: 'Build' },
  { id: 'plugins', icon: ExtensionPuzzleOutline, label: 'Plugins' },
  { id: 'themes', icon: ColorPaletteOutline, label: 'Themes' },
  { id: 'git', icon: GitBranchOutline, label: 'Git' },
];

function isActive(id: PanelType): boolean {
  return uiStore.activePanel === id && !uiStore.sidePanelCollapsed;
}

function handleClick(id: PanelType): void {
  uiStore.setActivePanel(id);
}
</script>

<template>
  <div class="activity-bar">
    <div class="activity-items">
      <NTooltip
        v-for="item in activities"
        :key="item.id"
        placement="right"
        :delay="500"
      >
        <template #trigger>
          <NButton
            quaternary
            :class="{ active: isActive(item.id) }"
            @click="handleClick(item.id)"
          >
            <template #icon>
              <component :is="item.icon" />
            </template>
          </NButton>
        </template>
        {{ item.label }}
      </NTooltip>
    </div>
  </div>
</template>

<style scoped>
.activity-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  height: 100%;
}

.activity-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-bar :deep(.n-button) {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 8px;
}

.activity-bar :deep(.n-button .n-icon) {
  font-size: 20px;
}

.activity-bar :deep(.n-button.active) {
  background-color: rgba(233, 69, 96, 0.2);
  color: var(--color-primary);
}

.activity-bar :deep(.n-button:not(.active):hover) {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
