<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { NButton, NProgress, NLog, NEmpty, NSpace, NTag } from 'naive-ui';
import {
  PlayOutline,
  StopOutline,
  TrashOutline,
  OpenOutline,
} from '@vicons/ionicons5';
import { useBuildStore } from '../../stores/build';
import { useNotificationsStore } from '../../stores/notifications';

const buildStore = useBuildStore();
const notificationsStore = useNotificationsStore();

const logRef = ref<InstanceType<typeof NLog> | null>(null);

// Formatted log text for NLog
const logText = computed(() =>
  buildStore.logs.map((entry) => buildStore.formatLogEntry(entry)).join('\n')
);

// Auto-scroll log when new entries are added
watch(
  () => buildStore.logs.length,
  async () => {
    await nextTick();
    if (logRef.value) {
      logRef.value.scrollTo({ position: 'bottom', silent: true });
    }
  }
);

// Status color
const statusType = computed(() => {
  switch (buildStore.status) {
    case 'running':
      return 'warning';
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
});

// Start build
async function startBuild(): Promise<void> {
  buildStore.startBuild();

  try {
    // TODO: Integrate with actual pipeline from @janos/core
    // For now, simulate a build process
    const plugins = ['markdown', 'collections', 'permalinks', 'layouts', 'assets'];
    const totalSteps = plugins.length;

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      const progress = Math.round(((i + 1) / totalSteps) * 100);

      buildStore.setProgress(progress, plugin);
      buildStore.addLog('info', `Running ${plugin} plugin...`);

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 500));

      buildStore.addLog('info', `${plugin} completed`);
    }

    buildStore.completeBuild();
    notificationsStore.success('Build Complete', 'Site built successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    buildStore.failBuild(message);
    notificationsStore.error('Build Failed', message);
  }
}

// Cancel build
function cancelBuild(): void {
  buildStore.cancelBuild();
  notificationsStore.info('Build Cancelled', 'Build was cancelled');
}

// Clear logs
function clearLogs(): void {
  buildStore.clearLogs();
}

// Open preview (TODO: implement with Service Worker)
function openPreview(): void {
  notificationsStore.info('Preview', 'Preview functionality coming soon');
  // window.open('/preview/', '_blank');
}
</script>

<template>
  <div class="build-panel">
    <!-- Build actions -->
    <div class="build-actions">
      <NSpace>
        <NButton
          v-if="!buildStore.isRunning"
          type="primary"
          size="small"
          @click="startBuild"
        >
          <template #icon>
            <PlayOutline />
          </template>
          Build
        </NButton>
        <NButton
          v-else
          type="warning"
          size="small"
          @click="cancelBuild"
        >
          <template #icon>
            <StopOutline />
          </template>
          Cancel
        </NButton>

        <NButton
          size="small"
          :disabled="!buildStore.isSuccess"
          @click="openPreview"
        >
          <template #icon>
            <OpenOutline />
          </template>
          Preview
        </NButton>
      </NSpace>
    </div>

    <!-- Build status -->
    <div class="build-status" v-if="buildStore.status !== 'idle'">
      <div class="status-row">
        <NTag :type="statusType" size="small">
          {{ buildStore.status.toUpperCase() }}
        </NTag>
        <span v-if="buildStore.formattedDuration" class="duration">
          {{ buildStore.formattedDuration }}
        </span>
      </div>

      <div v-if="buildStore.isRunning" class="progress-section">
        <NProgress
          type="line"
          :percentage="buildStore.progress"
          :show-indicator="true"
          :height="8"
          :border-radius="4"
          status="success"
        />
        <span v-if="buildStore.currentPlugin" class="current-plugin">
          {{ buildStore.currentPlugin }}
        </span>
      </div>
    </div>

    <!-- Build logs -->
    <div class="build-logs">
      <div class="logs-header">
        <span>Output</span>
        <NButton
          quaternary
          size="tiny"
          @click="clearLogs"
          :disabled="buildStore.logs.length === 0"
        >
          <template #icon>
            <TrashOutline />
          </template>
        </NButton>
      </div>

      <NLog
        v-if="buildStore.logs.length > 0"
        ref="logRef"
        :log="logText"
        :rows="15"
        class="log-output"
        language="log"
      />

      <NEmpty
        v-else
        description="No build output"
        class="empty-logs"
      />
    </div>
  </div>
</template>

<style scoped>
.build-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px 12px;
  gap: 12px;
}

.build-actions {
  flex-shrink: 0;
}

.build-status {
  flex-shrink: 0;
  padding: 8px;
  background-color: var(--color-bg);
  border-radius: 4px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.duration {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.current-plugin {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.build-logs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.log-output {
  flex: 1;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  background-color: var(--color-bg);
  border-radius: 4px;
}

.log-output :deep(.n-log) {
  background-color: var(--color-bg);
}

.empty-logs {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
