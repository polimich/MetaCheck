// @author Michael Polívka (xpoliv07)
import { defineStore } from 'pinia';
import { Notify, QNotifyCreateOptions } from 'quasar';

// Types
type NotificationType = 'positive' | 'negative' | 'warning' | 'info';

export const useNotificationStore = defineStore('notification', () => {
  // Base notification function
  const notify = (
    message: string,
    type: NotificationType = 'info',
    options: Partial<QNotifyCreateOptions> = {},
  ) => {
    // Set default options based on type
    const timeout = options.timeout ?? (type === 'negative' ? 0 : 5000);

    // Create notification options
    const notifyOptions: QNotifyCreateOptions = {
      message,
      type,
      position: options.position || 'top-right',
      timeout,
      closeBtn: options.closeBtn ?? true,
      ...options,
    };

    // Use Quasar's Notify
    return Notify.create(notifyOptions);
  };

  // Shorthand methods for different notification types
  const success = (message: string, options?: Partial<QNotifyCreateOptions>) =>
    notify(message, 'positive', options);

  const error = (message: string, options?: Partial<QNotifyCreateOptions>) =>
    notify(message, 'negative', { timeout: 0, ...options });

  const warning = (message: string, options?: Partial<QNotifyCreateOptions>) =>
    notify(message, 'warning', options);

  const info = (message: string, options?: Partial<QNotifyCreateOptions>) =>
    notify(message, 'info', options);

  return {
    notify,
    success,
    error,
    warning,
    info,
  };
});
