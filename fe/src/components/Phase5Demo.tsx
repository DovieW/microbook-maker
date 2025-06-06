import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Timeline as ProgressIcon,
  Notifications as NotificationIcon,
  Security as ValidationIcon,
} from '@mui/icons-material';
import { useNotifications } from '../hooks/useNotifications';
import { useFormValidation } from '../hooks/useFormValidation';
import { useAppContext } from '../context/AppContext';

/**
 * Demo component showcasing Phase 5 enhancements
 * This component demonstrates all the new features and improvements
 */
const Phase5Demo: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  const { isFormValid, getAllErrors, getInvalidReasons } = useFormValidation();
  const { generationState } = useAppContext();
  const [demoProgress, setDemoProgress] = useState(0);

  const handleNotificationDemo = (type: 'success' | 'error' | 'warning' | 'info') => {
    const messages = {
      success: {
        title: 'Success Demo',
        message: 'This is a success notification with auto-hide functionality!'
      },
      error: {
        title: 'Error Demo',
        message: 'This is an error notification that stays visible until dismissed.'
      },
      warning: {
        title: 'Warning Demo',
        message: 'This is a warning notification with helpful guidance.'
      },
      info: {
        title: 'Info Demo',
        message: 'This is an informational notification with useful tips.'
      }
    };

    const { title, message } = messages[type];
    
    switch (type) {
      case 'success':
        showSuccess(title, message);
        break;
      case 'error':
        showError(title, message, { autoHide: false });
        break;
      case 'warning':
        showWarning(title, message);
        break;
      case 'info':
        showInfo(title, message);
        break;
    }
  };

  const handleProgressDemo = () => {
    setDemoProgress(0);
    const interval = setInterval(() => {
      setDemoProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          showSuccess('Demo Complete!', 'Progress simulation finished successfully.');
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const features = [
    {
      title: 'Real-time Progress Tracking',
      description: 'Visual progress indicators with granular updates during PDF generation',
      icon: <ProgressIcon color="primary" />,
      status: 'implemented'
    },
    {
      title: 'Enhanced Form Validation',
      description: 'Comprehensive validation with user-friendly error messages and guidance',
      icon: <ValidationIcon color="primary" />,
      status: 'implemented'
    },
    {
      title: 'Smart Notification System',
      description: 'Context-aware notifications with different types and auto-management',
      icon: <NotificationIcon color="primary" />,
      status: 'implemented'
    },
    {
      title: 'Improved Error Handling',
      description: 'Graceful error handling with recovery suggestions and clear messaging',
      icon: <ErrorIcon color="primary" />,
      status: 'implemented'
    }
  ];

  const validationFeatures = [
    'Real-time font size validation (4-10 range)',
    'File type validation (.txt files only)',
    'File size validation (max 10MB)',
    'Content validation (empty/short file detection)',
    'Form completeness validation',
    'User guidance with helpful tooltips'
  ];

  const progressFeatures = [
    'Automatic progress polling every 2 seconds',
    'Visual progress bar with percentage',
    'Step-by-step status updates',
    'Sheet-by-sheet progress tracking',
    'Automatic completion detection',
    'Error state handling with recovery options'
  ];

  const notificationFeatures = [
    'Success notifications for completed operations',
    'Error notifications with actionable guidance',
    'Warning notifications for potential issues',
    'Info notifications for helpful tips',
    'Auto-hide functionality with customizable duration',
    'Manual dismissal with close buttons'
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center">
        Phase 5: User Experience Enhancements Demo
      </Typography>
      
      <Typography variant="body1" paragraph align="center" color="text.secondary">
        This demo showcases the enhanced user experience features implemented in Phase 5,
        including real-time progress tracking, improved form validation, and smart notifications.
      </Typography>

      <Grid container spacing={3}>
        {/* Feature Overview */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Enhanced Features Overview" />
            <CardContent>
              <Grid container spacing={2}>
                {features.map((feature, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Box sx={{ textAlign: 'center', p: 2 }}>
                      {feature.icon}
                      <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.description}
                      </Typography>
                      <Chip 
                        label={feature.status} 
                        color="success" 
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Demo */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Smart Notification System" />
            <CardContent>
              <Typography variant="body2" paragraph>
                Test different types of notifications with various behaviors:
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button 
                  variant="contained" 
                  color="success" 
                  size="small"
                  onClick={() => handleNotificationDemo('success')}
                >
                  Success
                </Button>
                <Button 
                  variant="contained" 
                  color="error" 
                  size="small"
                  onClick={() => handleNotificationDemo('error')}
                >
                  Error
                </Button>
                <Button 
                  variant="contained" 
                  color="warning" 
                  size="small"
                  onClick={() => handleNotificationDemo('warning')}
                >
                  Warning
                </Button>
                <Button 
                  variant="contained" 
                  color="info" 
                  size="small"
                  onClick={() => handleNotificationDemo('info')}
                >
                  Info
                </Button>
              </Box>

              <Typography variant="subtitle2" gutterBottom>
                Notification Features:
              </Typography>
              <List dense>
                {notificationFeatures.map((feature, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={feature} 
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Demo */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Progress Tracking System" />
            <CardContent>
              <Typography variant="body2" paragraph>
                Simulate PDF generation progress with real-time updates:
              </Typography>
              
              <Button 
                variant="contained" 
                onClick={handleProgressDemo}
                disabled={demoProgress > 0 && demoProgress < 100}
                sx={{ mb: 2 }}
              >
                {demoProgress === 100 ? 'Run Again' : 'Start Progress Demo'}
              </Button>

              {demoProgress > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <div style={{ 
                        width: '100%', 
                        height: 8, 
                        backgroundColor: '#e0e0e0', 
                        borderRadius: 4 
                      }}>
                        <div style={{ 
                          width: `${demoProgress}%`, 
                          height: '100%', 
                          backgroundColor: '#1976d2', 
                          borderRadius: 4,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </Box>
                    <Typography variant="body2" sx={{ minWidth: 40 }}>
                      {demoProgress}%
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {demoProgress < 100 ? `Processing... ${demoProgress}% complete` : 'Complete!'}
                  </Typography>
                </Box>
              )}

              <Typography variant="subtitle2" gutterBottom>
                Progress Features:
              </Typography>
              <List dense>
                {progressFeatures.map((feature, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={feature} 
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Validation Demo */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Enhanced Form Validation" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Current Form Status:
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {isFormValid() ? (
                      <>
                        <CheckIcon color="success" sx={{ mr: 1 }} />
                        <Typography color="success.main">Form is valid and ready for submission</Typography>
                      </>
                    ) : (
                      <>
                        <ErrorIcon color="error" sx={{ mr: 1 }} />
                        <Typography color="error.main">Form has validation errors</Typography>
                      </>
                    )}
                  </Box>

                  {!isFormValid() && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Issues to resolve:
                      </Typography>
                      <List dense>
                        {getInvalidReasons().map((reason, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText 
                              primary={reason} 
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Validation Features:
                  </Typography>
                  <List dense>
                    {validationFeatures.map((feature, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={feature} 
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Phase5Demo;
