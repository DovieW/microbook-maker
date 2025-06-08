import { createTheme } from '@mui/material/styles';

// Design tokens for consistent styling - Warm Modern Palette
export const designTokens = {
  colors: {
    primary: {
      main: '#6366f1',      // Modern indigo
      light: '#818cf8',     // Light indigo
      dark: '#4f46e5',      // Dark indigo
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#f59e0b',      // Warm amber
      light: '#fbbf24',     // Light amber
      dark: '#d97706',      // Dark amber
      contrastText: '#ffffff',
    },
    background: {
      default: '#fefefe',   // Very light warm white
      paper: '#ffffff',     // Pure white
      dark: '#1a1625',      // Warm dark purple-gray
      light: '#f8f6f3',     // Warm off-white
    },
    text: {
      primary: 'rgba(26, 22, 37, 0.87)',    // Warm dark for better contrast
      secondary: 'rgba(75, 85, 99, 0.8)',   // Gray-600 with opacity
      disabled: 'rgba(156, 163, 175, 0.6)', // Gray-400 with opacity
    },
    accent: {
      main: '#10b981',      // Emerald green
      light: '#34d399',     // Light emerald
      dark: '#059669',      // Dark emerald
      contrastText: '#ffffff',
    },
    grey: {
      50: '#f9fafb',   // gray-50 (warm)
      100: '#f3f4f6',  // gray-100
      200: '#e5e7eb',  // gray-200
      300: '#d1d5db',  // gray-300
      400: '#9ca3af',  // gray-400
      500: '#6b7280',  // gray-500
      600: '#4b5563',  // gray-600
      700: '#374151',  // gray-700
      800: '#1f2937',  // gray-800
      900: '#111827',  // gray-900
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    small: 4,
    medium: 6,
    large: 8,
    xlarge: 10,
  },
  typography: {
    fontFamily: {
      primary: '"Roboto", "Helvetica", "Arial", sans-serif',
      secondary: '"Georgia", "Times New Roman", serif',
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },
  shadows: {
    none: 'none',
    light: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    medium: '0px 4px 8px rgba(0, 0, 0, 0.15)',
    heavy: '0px 8px 16px rgba(0, 0, 0, 0.2)',
  },
};

// Enhanced MUI theme with design tokens
export const theme = createTheme({
  palette: {
    primary: {
      main: designTokens.colors.primary.main,
      light: designTokens.colors.primary.light,
      dark: designTokens.colors.primary.dark,
      contrastText: designTokens.colors.primary.contrastText,
    },
    secondary: {
      main: designTokens.colors.secondary.main,
      light: designTokens.colors.secondary.light,
      dark: designTokens.colors.secondary.dark,
      contrastText: designTokens.colors.secondary.contrastText,
    },
    background: {
      default: designTokens.colors.background.default,
      paper: designTokens.colors.background.paper,
    },
    text: {
      primary: designTokens.colors.text.primary,
      secondary: designTokens.colors.text.secondary,
      disabled: designTokens.colors.text.disabled,
    },
    grey: designTokens.colors.grey,
  },
  typography: {
    fontFamily: designTokens.typography.fontFamily.primary,
    h1: {
      fontFamily: designTokens.typography.fontFamily.secondary,
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    h2: {
      fontFamily: designTokens.typography.fontFamily.secondary,
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    h3: {
      fontFamily: designTokens.typography.fontFamily.secondary,
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    h4: {
      fontFamily: designTokens.typography.fontFamily.secondary,
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    h5: {
      fontFamily: designTokens.typography.fontFamily.secondary,
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    h6: {
      fontFamily: designTokens.typography.fontFamily.secondary,
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    body1: {
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    body2: {
      fontWeight: designTokens.typography.fontWeight.regular,
    },
    button: {
      fontWeight: designTokens.typography.fontWeight.medium,
      textTransform: 'none' as const,
    },
  },
  spacing: designTokens.spacing.sm, // Base spacing unit (8px)
  shape: {
    borderRadius: designTokens.borderRadius.large,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.medium,
          textTransform: 'none',
          fontWeight: designTokens.typography.fontWeight.medium,
          padding: `${designTokens.spacing.sm}px ${designTokens.spacing.md}px`,
        },
        contained: {
          boxShadow: designTokens.shadows.none,
          '&:hover': {
            boxShadow: designTokens.shadows.light,
          },
          '&:active': {
            boxShadow: designTokens.shadows.none,
          },
        },
        outlined: {
          borderWidth: 1,
          '&:hover': {
            borderWidth: 1,
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: designTokens.spacing.md,
          paddingRight: designTokens.spacing.md,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: designTokens.borderRadius.medium,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.medium,
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: designTokens.borderRadius.medium,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.medium,
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.08)', // Updated to new primary color with 8% opacity
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: designTokens.colors.grey[800],
          fontSize: '0.75rem',
          borderRadius: designTokens.borderRadius.small,
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(26, 22, 37, 0.7)', // Updated to use warm dark background
        },
      },
    },
  },
});

export default theme;
