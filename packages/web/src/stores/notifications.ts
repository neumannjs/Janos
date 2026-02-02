import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 for no auto-dismiss
  dismissible?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
  createdAt: Date;
}

const DEFAULT_DURATION: Record<NotificationType, number> = {
  info: 4000,
  success: 3000,
  warning: 5000,
  error: 0, // Errors don't auto-dismiss
};

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useNotificationsStore = defineStore('notifications', () => {
  // State
  const notifications = ref<Notification[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  // Computed
  const hasNotifications = computed(() => notifications.value.length > 0);
  const count = computed(() => notifications.value.length);

  // Actions
  function notify(options: {
    type?: NotificationType;
    title: string;
    message?: string;
    duration?: number;
    dismissible?: boolean;
    action?: { label: string; handler: () => void };
  }): string {
    const type = options.type ?? 'info';
    const id = generateId();

    const notification: Notification = {
      id,
      type,
      title: options.title,
      message: options.message,
      duration: options.duration ?? DEFAULT_DURATION[type],
      dismissible: options.dismissible ?? true,
      action: options.action,
      createdAt: new Date(),
    };

    notifications.value.push(notification);

    // Set up auto-dismiss timer
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, notification.duration);
      timers.set(id, timer);
    }

    return id;
  }

  function info(title: string, message?: string): string {
    return notify({ type: 'info', title, message });
  }

  function success(title: string, message?: string): string {
    return notify({ type: 'success', title, message });
  }

  function warning(title: string, message?: string): string {
    return notify({ type: 'warning', title, message });
  }

  function error(title: string, message?: string): string {
    return notify({ type: 'error', title, message });
  }

  function dismiss(id: string): void {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);

      // Clear timer if exists
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
  }

  function clearAll(): void {
    // Clear all timers
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    notifications.value = [];
  }

  function clearByType(type: NotificationType): void {
    const toRemove = notifications.value.filter((n) => n.type === type);
    for (const notification of toRemove) {
      dismiss(notification.id);
    }
  }

  return {
    // State
    notifications,

    // Computed
    hasNotifications,
    count,

    // Actions
    notify,
    info,
    success,
    warning,
    error,
    dismiss,
    clearAll,
    clearByType,
  };
});
