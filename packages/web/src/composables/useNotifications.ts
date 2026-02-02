import { useNotification, type NotificationOptions } from 'naive-ui';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotifyOptions {
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
}

export function useNotifications() {
  const notification = useNotification();

  function notify(type: NotificationType, options: NotifyOptions): void {
    const notificationOptions: NotificationOptions = {
      title: options.title,
      content: options.message,
      duration: options.duration ?? getDefaultDuration(type),
      closable: options.closable ?? true,
    };

    switch (type) {
      case 'info':
        notification.info(notificationOptions);
        break;
      case 'success':
        notification.success(notificationOptions);
        break;
      case 'warning':
        notification.warning(notificationOptions);
        break;
      case 'error':
        notification.error(notificationOptions);
        break;
    }
  }

  function getDefaultDuration(type: NotificationType): number {
    switch (type) {
      case 'info':
        return 4000;
      case 'success':
        return 3000;
      case 'warning':
        return 5000;
      case 'error':
        return 0; // Don't auto-dismiss errors
    }
  }

  function info(title: string, message?: string): void {
    notify('info', { title, message });
  }

  function success(title: string, message?: string): void {
    notify('success', { title, message });
  }

  function warning(title: string, message?: string): void {
    notify('warning', { title, message });
  }

  function error(title: string, message?: string): void {
    notify('error', { title, message });
  }

  function destroyAll(): void {
    notification.destroyAll();
  }

  return {
    notify,
    info,
    success,
    warning,
    error,
    destroyAll,
  };
}
