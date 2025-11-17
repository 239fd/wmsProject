import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#005FF9',
      contrastText: '#fff',
    },
    secondary: {
      main: '#FFD600',
      contrastText: '#000',
    },
    background: {
      default: '#F7F7F9',
      paper: '#fff',
    },
    text: {
      primary: '#18191C',
      secondary: '#5A5A5A',
    },
  },
  typography: {
    fontFamily: 'Manrope, Arial, sans-serif',
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 18,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 700,
        },
      },
    },
  },
});

export default theme;
