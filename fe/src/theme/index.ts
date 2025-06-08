import { createTheme } from '@mui/material/styles';

// Design tokens for consistent styling - Cool Sophisticated Palette
export const designTokens = {
  colors: {
    primary: {
      main: '#3b82f6',      // Modern blue
      light: '#60a5fa',     // Light blue
      dark: '#1d4ed8',      // Dark blue
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b5cf6',      // Violet
      light: '#a78bfa',     // Light violet
      dark: '#7c3aed',      // Dark violet
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc',   // Very light slate
      paper: '#ffffff',     // White
      dark: '#0f172a',      // Slate dark
      light: '#f1f5f9',     // Cool light gray
    },
    text: {
      primary: 'rgba(15, 23, 42, 0.87)',    // Dark slate for better contrast
      secondary: 'rgba(71, 85, 105, 0.8)',  // Slate-600 with opacity
      disabled: 'rgba(148, 163, 184, 0.6)', // Slate-400 with opacity
    },
    accent: {
      main: '#06b6d4',      // Cyan accent
      light: '#22d3ee',     // Light cyan
      dark: '#0891b2',      // Dark cyan
      contrastText: '#ffffff',
    },
    grey: {
      50: '#f8fafc',   // slate-50
      100: '#f1f5f9',  // slate-100
      200: '#e2e8f0',  // slate-200
      300: '#cbd5e1',  // slate-300
      400: '#94a3b8',  // slate-400
      500: '#64748b',  // slate-500
      600: '#475569',  // slate-600
      700: '#334155',  // slate-700
      800: '#1e293b',  // slate-800
      900: '#0f172a',  // slate-900
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
            backgroundColor: 'rgba(59, 130, 246, 0.08)', // Updated to new primary color with 8% opacity
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
          backgroundColor: 'rgba(15, 23, 42, 0.7)', // Updated to use slate-900 for backdrop
        },
      },
    },
  },
});

export default theme;
