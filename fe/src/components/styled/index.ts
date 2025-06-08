import { styled } from '@mui/material/styles';
import {
  Box,
  Container,
  IconButton,
  TextField,
  Button,
  Typography,
  CircularProgress,
  FormControl,
  Alert,
  LinearProgress
} from '@mui/material';
import { designTokens } from '../../theme';

// Common styled components for consistent styling across the application

// Layout Components
export const FlexContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
}));

export const FlexColumnContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}));

export const CenteredContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}));

export const SpaceBetweenContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: theme.spacing(3),
}));

export const InfoDisplayContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  marginTop: theme.spacing(1),
}));

// Form Components
export const FormRow = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
}));

export const FormField = styled(TextField)(({ theme }) => ({
  flexGrow: 1,
  marginRight: theme.spacing(1),
}));

export const NarrowField = styled(TextField)(() => ({
  width: 120,
}));

export const MediumField = styled(TextField)(() => ({
  width: 150,
}));

export const StyledFormControl = styled(FormControl)(() => ({
  width: 150,
}));

// Button Components
export const StyledIconButton = styled(IconButton)(({ theme }) => ({
  '&:hover': {
    backgroundColor: theme.palette.primary.main + '20', // 20% opacity
  },
}));

export const ActionButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

// Loading Components
export const LoadingOverlay = styled(Box)(() => ({
  position: 'relative',
  '&.loading': {
    opacity: 0.5,
    pointerEvents: 'none',
  },
}));

export const LoadingSpinner = styled(CircularProgress)(() => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  marginTop: -20,
  marginLeft: -20,
}));

// Typography Components
export const BoldText = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold || 700,
  marginBottom: 0,
}));

export const StatusText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: 'center',
}));

// Container Components
export const MainFormContainer = styled(Box)(({ theme }) => ({
  backgroundColor: designTokens.colors.background.light,
  padding: theme.spacing(5),
  borderRadius: designTokens.borderRadius.xlarge,
  maxWidth: '600px',
  width: '100%',
}));

export const ControlsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
}));

export const ButtonContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

// Input Components
export const HiddenFileInput = styled('input')({
  display: 'none',
});

// Background Components
export const DarkBackground = styled(Box)(({ theme }) => ({
  backgroundColor: designTokens.colors.background.dark,
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(2),
  position: 'relative', // Add relative positioning for absolute children
}));

// Status Components
export const StatusContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}));

export const StatusButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

// Utility Components
export const OptionsContainer = styled(Box)(({ theme }) => ({
  // Container for options - can be extended as needed
}));

// Progress Components
export const ProgressContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));

export const ProgressBar = styled(LinearProgress)(({ theme }) => ({
  width: '100%',
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.palette.grey[300],
  '& .MuiLinearProgress-bar': {
    borderRadius: 4,
    transition: 'transform 0.4s ease-in-out',
  },
  '& .MuiLinearProgress-bar1Determinate': {
    transition: 'transform 0.4s ease-in-out',
  },
}));

// Job List Components
export const JobListContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  paddingRight: theme.spacing(0.5), // Small padding to account for scrollbar
}));

export const JobListItem = styled(Box)(({ theme }) => ({
  backgroundColor: 'rgba(255, 255, 255, 0.85)', // Semi-transparent white - distinct but softer than pure white
  borderRadius: designTokens.borderRadius.medium,
  border: `1px solid rgba(218, 218, 255, 0.4)`, // Light purple border for cohesion
  cursor: 'pointer',
  overflow: 'hidden',
  boxShadow: '0px 2px 8px rgba(13, 0, 51, 0.1)', // Subtle shadow using the dark background color
}));

export const JobItemHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'relative',
}));

export const JobItemContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
}));

export const JobItemActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

export const JobExpandedContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'expanded',
})<{ expanded: boolean }>(({ theme, expanded }) => ({
  maxHeight: expanded ? '300px' : '0px',
  overflow: 'hidden',
  transition: 'max-height 0.3s ease-in-out',
  backgroundColor: 'rgba(218, 218, 255, 0.25)', // Light purple tint for expanded content
  borderTop: expanded ? `1px solid rgba(218, 218, 255, 0.3)` : 'none',
}));

export const JobDetailsContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

export const JobDetailRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  '&:not(:last-child)': {
    marginBottom: theme.spacing(0.5),
  },
}));

export const JobActionButtons = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: theme.spacing(1),
  paddingTop: theme.spacing(1),
  borderTop: `1px solid ${theme.palette.grey[200]}`,
}));

export const JobProgressBar = styled(LinearProgress)(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 3,
  borderBottomLeftRadius: designTokens.borderRadius.medium,
  borderBottomRightRadius: designTokens.borderRadius.medium,
  backgroundColor: 'transparent',
  '& .MuiLinearProgress-bar': {
    borderBottomLeftRadius: designTokens.borderRadius.medium,
    borderBottomRightRadius: designTokens.borderRadius.medium,
    transition: 'transform 0.4s ease-in-out',
  },
}));

export const ProgressText = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(0.5),
  textAlign: 'center',
}));

// Notification Components
export const NotificationContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: theme.spacing(2),
  right: theme.spacing(2),
  zIndex: theme.zIndex.snackbar + 1,
  maxWidth: 400,
}));

export const StyledAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  boxShadow: theme.shadows[3],
}));

export const ValidationErrorText = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: '0.75rem',
  marginTop: theme.spacing(0.5),
  marginLeft: theme.spacing(1.75),
}));

// Export all styled components as a single object for easier importing
export const StyledComponents = {
  // Layout
  FlexContainer,
  FlexColumnContainer,
  CenteredContainer,
  SpaceBetweenContainer,
  InfoDisplayContainer,
  
  // Form
  FormRow,
  FormField,
  NarrowField,
  MediumField,
  StyledFormControl,
  
  // Buttons
  StyledIconButton,
  ActionButton,
  
  // Loading
  LoadingOverlay,
  LoadingSpinner,
  
  // Typography
  BoldText,
  StatusText,
  
  // Containers
  MainFormContainer,
  ControlsContainer,
  ButtonContainer,
  
  // Inputs
  HiddenFileInput,
  
  // Background
  DarkBackground,
  
  // Status
  StatusContainer,
  StatusButton,
  
  // Utility
  OptionsContainer,

  // Progress
  ProgressContainer,
  ProgressBar,
  ProgressText,

  // Job List
  JobListContainer,
  JobListItem,
  JobItemHeader,
  JobItemContent,
  JobItemActions,
  JobExpandedContent,
  JobDetailsContainer,
  JobDetailRow,
  JobActionButtons,
  JobProgressBar,

  // Notifications
  NotificationContainer,
  StyledAlert,
  ValidationErrorText,
};

export default StyledComponents;
