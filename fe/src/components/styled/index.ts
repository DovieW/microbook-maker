import { styled } from '@mui/material/styles';
import { 
  Box, 
  Container, 
  IconButton, 
  TextField, 
  Button, 
  Typography,
  CircularProgress,
  FormControl 
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
};

export default StyledComponents;
