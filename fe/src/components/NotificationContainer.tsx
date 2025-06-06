import React, { useEffect } from 'react';
import { Fade, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAppContext } from '../context/AppContext';
import {
  NotificationContainer,
  StyledAlert,
} from './styled';

/**
 * Container component for displaying notifications
 * Automatically handles notification lifecycle and removal
 */
const NotificationContainerComponent: React.FC = () => {
  const { generationState, removeNotification } = useAppContext();

  // Auto-remove notifications after their duration
  useEffect(() => {
    generationState.notifications.forEach((notification) => {
      if (notification.autoHide !== false) {
        const duration = notification.duration || 5000; // Default 5 seconds
        const timer = setTimeout(() => {
          removeNotification(notification.id);
        }, duration);

        return () => clearTimeout(timer);
      }
    });
  }, [generationState.notifications, removeNotification]);

  const handleClose = (notificationId: string) => {
    removeNotification(notificationId);
  };

  if (generationState.notifications.length === 0) {
    return null;
  }

  return (
    <NotificationContainer>
      {generationState.notifications.map((notification) => (
        <Fade key={notification.id} in={true} timeout={300}>
          <StyledAlert
            severity={notification.type}
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => handleClose(notification.id)}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            }
          >
            <strong>{notification.title}</strong>
            {notification.message && (
              <>
                <br />
                {notification.message}
              </>
            )}
          </StyledAlert>
        </Fade>
      ))}
    </NotificationContainer>
  );
};

export default NotificationContainerComponent;
