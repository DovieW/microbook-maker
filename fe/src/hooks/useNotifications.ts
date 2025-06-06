import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Notification, NotificationType } from '../types';

/**
 * Custom hook for managing notifications
 * Provides convenient methods for showing different types of notifications
 */
export function useNotifications() {
  const { addNotification, removeNotification, clearNotifications } = useAppContext();

  const showNotification = useCallback((
    type: NotificationType,
    title: string,
    message?: string,
    options?: {
      autoHide?: boolean;
      duration?: number;
    }
  ) => {
    const notification: Notification = {
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message: message || '',
      autoHide: options?.autoHide !== false,
      duration: options?.duration || 5000,
    };

    addNotification(notification);
    return notification.id;
  }, [addNotification]);

  const showSuccess = useCallback((title: string, message?: string, options?: { autoHide?: boolean; duration?: number }) => {
    return showNotification('success', title, message, options);
  }, [showNotification]);

  const showError = useCallback((title: string, message?: string, options?: { autoHide?: boolean; duration?: number }) => {
    return showNotification('error', title, message, { ...options, autoHide: options?.autoHide !== false });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message?: string, options?: { autoHide?: boolean; duration?: number }) => {
    return showNotification('warning', title, message, options);
  }, [showNotification]);

  const showInfo = useCallback((title: string, message?: string, options?: { autoHide?: boolean; duration?: number }) => {
    return showNotification('info', title, message, options);
  }, [showNotification]);

  return {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearNotifications,
  };
}
