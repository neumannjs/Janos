<script setup lang="ts">
import { ref, computed } from 'vue';
import { NButton, NBadge, NTooltip, NPopover } from 'naive-ui';
import {
  GitBranchOutline,
  SyncOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
  NotificationsOutline,
  TrashOutline,
  CloseOutline,
} from '@vicons/ionicons5';
import { useGitStore } from '../../stores/git';
import { useBuildStore } from '../../stores/build';
import { useNotificationsStore } from '../../stores/notifications';
import { useEditorStore } from '../../stores/editor';

const isDev = import.meta.env.DEV;
const showNotifications = ref(false);

async function resetFilesystem() {
  if (!confirm('Delete the janos-fs IndexedDB and reload?')) return;
  const dbs = await indexedDB.databases();
  for (const db of dbs) {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }
  window.location.reload();
}

const gitStore = useGitStore();
const buildStore = useBuildStore();
const notificationsStore = useNotificationsStore();
const editorStore = useEditorStore();

const gitStatusText = computed(() => {
  if (gitStore.loading) return 'Syncing...';
  if (!gitStore.isRepo) return 'No repository';
  if (gitStore.hasChanges) {
    const count = gitStore.stagedFiles.length + gitStore.unstagedFiles.length;
    return `${count} change${count !== 1 ? 's' : ''}`;
  }
  return 'Clean';
});

const buildStatusText = computed(() => {
  switch (buildStore.status) {
    case 'idle':
      return 'Build: Ready';
    case 'running':
      return buildStore.currentPlugin
        ? `Building: ${buildStore.currentPlugin}`
        : `Building... ${buildStore.progress}%`;
    case 'success':
      return `Build: ${buildStore.formattedDuration}`;
    case 'error':
      return 'Build: Failed';
    default:
      return 'Build';
  }
});

const buildStatusIcon = computed(() => {
  switch (buildStore.status) {
    case 'running':
      return SyncOutline;
    case 'success':
      return CheckmarkCircleOutline;
    case 'error':
      return AlertCircleOutline;
    default:
      return null;
  }
});

const cursorPosition = computed(() => {
  const tab = editorStore.activeTab;
  if (!tab?.cursorPosition) return null;
  return `Ln ${tab.cursorPosition.line}, Col ${tab.cursorPosition.column}`;
});

const fileLanguage = computed(() => {
  const tab = editorStore.activeTab;
  if (!tab) return null;
  return tab.language.charAt(0).toUpperCase() + tab.language.slice(1);
});
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <!-- Git status -->
      <NTooltip v-if="gitStore.isRepo" placement="top">
        <template #trigger>
          <NButton text size="tiny" class="status-item">
            <template #icon>
              <GitBranchOutline />
            </template>
            {{ gitStore.currentBranch ?? 'main' }}
          </NButton>
        </template>
        {{ gitStatusText }}
      </NTooltip>

      <!-- Build status -->
      <NButton
        text
        size="tiny"
        class="status-item"
        :class="{
          'status-running': buildStore.isRunning,
          'status-success': buildStore.isSuccess,
          'status-error': buildStore.isError,
        }"
      >
        <template v-if="buildStatusIcon" #icon>
          <component :is="buildStatusIcon" :class="{ spin: buildStore.isRunning }" />
        </template>
        {{ buildStatusText }}
      </NButton>
    </div>

    <div class="status-right">
      <!-- Cursor position -->
      <span v-if="cursorPosition" class="status-item status-text">
        {{ cursorPosition }}
      </span>

      <!-- File language -->
      <span v-if="fileLanguage" class="status-item status-text">
        {{ fileLanguage }}
      </span>

      <!-- Dev: Reset filesystem -->
      <NTooltip v-if="isDev" placement="top">
        <template #trigger>
          <NButton text size="tiny" class="status-item status-dev" @click="resetFilesystem">
            <template #icon>
              <TrashOutline />
            </template>
            Reset FS
          </NButton>
        </template>
        Delete IndexedDB and reload
      </NTooltip>

      <!-- Notifications -->
      <NPopover
        v-model:show="showNotifications"
        placement="top-end"
        trigger="click"
        :show-arrow="false"
        style="padding: 0;"
      >
        <template #trigger>
          <NBadge
            :value="notificationsStore.count"
            :max="9"
            :show="notificationsStore.hasNotifications"
            type="error"
          >
            <NButton text size="tiny" class="status-item">
              <template #icon>
                <NotificationsOutline />
              </template>
            </NButton>
          </NBadge>
        </template>
        <div class="notifications-panel">
          <div class="notifications-header">
            <span>Notifications</span>
            <NButton
              v-if="notificationsStore.hasNotifications"
              text
              size="tiny"
              @click="notificationsStore.clearAll()"
            >
              Clear all
            </NButton>
          </div>
          <div v-if="!notificationsStore.hasNotifications" class="notifications-empty">
            No notifications
          </div>
          <div v-else class="notifications-list">
            <div
              v-for="n in notificationsStore.notifications"
              :key="n.id"
              class="notification-item"
              :class="`notification-${n.type}`"
            >
              <div class="notification-content">
                <span class="notification-title">{{ n.title }}</span>
                <span v-if="n.message" class="notification-message">{{ n.message }}</span>
              </div>
              <NButton
                text
                size="tiny"
                class="notification-dismiss"
                @click="notificationsStore.dismiss(n.id)"
              >
                <template #icon>
                  <CloseOutline />
                </template>
              </NButton>
            </div>
          </div>
        </div>
      </NPopover>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  height: 20px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.status-item:hover {
  color: var(--color-text);
}

.status-text {
  cursor: default;
}

.status-running {
  color: var(--color-warning);
}

.status-success {
  color: var(--color-success);
}

.status-error {
  color: var(--color-error);
}

.status-dev {
  color: var(--color-warning);
}

.notifications-panel {
  width: 320px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.notifications-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.notifications-list {
  overflow-y: auto;
  max-height: 350px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  border-left: 3px solid transparent;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-info {
  border-left-color: var(--color-info, #70c0e8);
}

.notification-success {
  border-left-color: var(--color-success);
}

.notification-warning {
  border-left-color: var(--color-warning);
}

.notification-error {
  border-left-color: var(--color-error);
}

.notification-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
}

.notification-message {
  font-size: 11px;
  color: var(--color-text-secondary);
  word-break: break-word;
}

.notification-dismiss {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Badge adjustments */
.status-bar :deep(.n-badge-sup) {
  font-size: 9px;
  height: 14px;
  min-width: 14px;
  padding: 0 4px;
}
</style>
