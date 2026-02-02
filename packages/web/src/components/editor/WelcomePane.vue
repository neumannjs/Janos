<script setup lang="ts">
import { NIcon } from 'naive-ui';
import {
  FolderOpenOutline,
  GitBranchOutline,
  RocketOutline,
} from '@vicons/ionicons5';
import { useUIStore } from '../../stores/ui';

const uiStore = useUIStore();

function openExplorer(): void {
  uiStore.setActivePanel('explorer');
}

function openGit(): void {
  uiStore.setActivePanel('git');
}

function openBuild(): void {
  uiStore.setActivePanel('build');
}
</script>

<template>
  <div class="welcome-pane">
    <div class="welcome-content">
      <h1 class="welcome-title">Janos</h1>
      <p class="welcome-subtitle">Browser-based Static Site Generator</p>

      <div class="quick-actions">
        <h3>Get Started</h3>
        <div class="action-grid">
          <button class="action-card" @click="openExplorer">
            <NIcon :size="24">
              <FolderOpenOutline />
            </NIcon>
            <span class="action-label">Open Files</span>
            <span class="action-hint">Browse your repository</span>
          </button>

          <button class="action-card" @click="openGit">
            <NIcon :size="24">
              <GitBranchOutline />
            </NIcon>
            <span class="action-label">Source Control</span>
            <span class="action-hint">Commit and push changes</span>
          </button>

          <button class="action-card" @click="openBuild">
            <NIcon :size="24">
              <RocketOutline />
            </NIcon>
            <span class="action-label">Build Site</span>
            <span class="action-hint">Generate your static site</span>
          </button>
        </div>
      </div>

      <div class="keyboard-hints">
        <h3>Keyboard Shortcuts</h3>
        <div class="shortcut-list">
          <div class="shortcut">
            <kbd>⌘</kbd><kbd>S</kbd>
            <span>Save file</span>
          </div>
          <div class="shortcut">
            <kbd>⌘</kbd><kbd>W</kbd>
            <span>Close tab</span>
          </div>
          <div class="shortcut">
            <kbd>⌘</kbd><kbd>P</kbd>
            <span>Quick open</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-pane {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  overflow-y: auto;
}

.welcome-content {
  max-width: 500px;
  text-align: center;
}

.welcome-title {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 8px;
}

.welcome-subtitle {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin-bottom: 48px;
}

.quick-actions h3,
.keyboard-hints h3 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 48px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-card:hover {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-primary);
}

.action-card .n-icon {
  color: var(--color-primary);
}

.action-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.action-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.shortcut kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  color: var(--color-text);
}

@media (max-width: 480px) {
  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
