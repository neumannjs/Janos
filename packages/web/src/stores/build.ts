import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type BuildStatus = 'idle' | 'running' | 'success' | 'error';

export interface BuildLogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  plugin?: string;
}

function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useBuildStore = defineStore('build', () => {
  // State
  const status = ref<BuildStatus>('idle');
  const progress = ref(0);
  const currentPlugin = ref<string | null>(null);
  const logs = ref<BuildLogEntry[]>([]);
  const startTime = ref<Date | null>(null);
  const endTime = ref<Date | null>(null);
  const error = ref<string | null>(null);

  // Computed
  const isRunning = computed(() => status.value === 'running');
  const isIdle = computed(() => status.value === 'idle');
  const isSuccess = computed(() => status.value === 'success');
  const isError = computed(() => status.value === 'error');

  const duration = computed(() => {
    if (!startTime.value) return null;
    const end = endTime.value ?? new Date();
    return end.getTime() - startTime.value.getTime();
  });

  const formattedDuration = computed(() => {
    if (duration.value === null) return '';
    const seconds = Math.floor(duration.value / 1000);
    const ms = duration.value % 1000;
    if (seconds === 0) return `${ms}ms`;
    return `${seconds}.${String(ms).padStart(3, '0')}s`;
  });

  const errorLogs = computed(() =>
    logs.value.filter((l) => l.level === 'error')
  );

  const warningLogs = computed(() =>
    logs.value.filter((l) => l.level === 'warn')
  );

  // Actions
  function startBuild(): void {
    status.value = 'running';
    progress.value = 0;
    currentPlugin.value = null;
    logs.value = [];
    startTime.value = new Date();
    endTime.value = null;
    error.value = null;

    addLog('info', 'Build started');
  }

  function setProgress(value: number, plugin?: string): void {
    progress.value = Math.max(0, Math.min(100, value));
    if (plugin !== undefined) {
      currentPlugin.value = plugin;
    }
  }

  function completeBuild(): void {
    status.value = 'success';
    progress.value = 100;
    currentPlugin.value = null;
    endTime.value = new Date();

    addLog('info', `Build completed in ${formattedDuration.value}`);
  }

  function failBuild(errorMessage: string): void {
    status.value = 'error';
    currentPlugin.value = null;
    endTime.value = new Date();
    error.value = errorMessage;

    addLog('error', `Build failed: ${errorMessage}`);
  }

  function cancelBuild(): void {
    if (status.value === 'running') {
      status.value = 'idle';
      currentPlugin.value = null;
      endTime.value = new Date();

      addLog('warn', 'Build cancelled');
    }
  }

  function resetBuild(): void {
    status.value = 'idle';
    progress.value = 0;
    currentPlugin.value = null;
    startTime.value = null;
    endTime.value = null;
    error.value = null;
  }

  function addLog(
    level: BuildLogEntry['level'],
    message: string,
    plugin?: string
  ): void {
    logs.value.push({
      id: generateLogId(),
      timestamp: new Date(),
      level,
      message,
      plugin: plugin ?? currentPlugin.value ?? undefined,
    });
  }

  function clearLogs(): void {
    logs.value = [];
  }

  // Format log entry for display
  function formatLogEntry(entry: BuildLogEntry): string {
    const time = entry.timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const level = entry.level.toUpperCase().padEnd(5);
    const plugin = entry.plugin ? `[${entry.plugin}] ` : '';

    return `${time} ${level} ${plugin}${entry.message}`;
  }

  return {
    // State
    status,
    progress,
    currentPlugin,
    logs,
    startTime,
    endTime,
    error,

    // Computed
    isRunning,
    isIdle,
    isSuccess,
    isError,
    duration,
    formattedDuration,
    errorLogs,
    warningLogs,

    // Actions
    startBuild,
    setProgress,
    completeBuild,
    failBuild,
    cancelBuild,
    resetBuild,
    addLog,
    clearLogs,
    formatLogEntry,
  };
});
