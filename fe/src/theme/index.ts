import { createTheme } from '@mui/material/styles';

// Design tokens for consistent styling
export const designTokens = {
  colors: {
    primary: {
      main: '#3f51b5',
      light: '#757de8',
      dark: '#002984',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#f50057',
      light: '#ff5983',
      dark: '#bb002f',
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
      dark: '#0d0033',
      light: '#dadaff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
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
            backgroundColor: 'rgba(63, 81, 181, 0.08)', // primary.main with 8% opacity
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
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        },
      },
    },
  },
});

export default theme;
