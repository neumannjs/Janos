<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NBadge, NTooltip } from 'naive-ui';
import {
  GitBranchOutline,
  SyncOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
  NotificationsOutline,
} from '@vicons/ionicons5';
import { useGitStore } from '../../stores/git';
import { useBuildStore } from '../../stores/build';
import { useNotificationsStore } from '../../stores/notifications';
import { useEditorStore } from '../../stores/editor';

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

      <!-- Notifications -->
      <NTooltip placement="top">
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
        {{ notificationsStore.count }} notification{{ notificationsStore.count !== 1 ? 's' : '' }}
      </NTooltip>
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
