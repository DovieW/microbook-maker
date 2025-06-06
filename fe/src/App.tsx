import React from 'react';
import { Box, Typography, Container, CssBaseline, styled, IconButton, Tooltip, Stack } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { AppProvider, useAppContext } from './context/AppContext';
import { BookInfoForm, FileControls, PdfOptions, GenerationStatus } from './components';
import { PdfGeneratorService } from './services';

const StyledIconButton = styled(IconButton)`
  &:hover {
    background-color: #14035591;
  }
`;

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    }
  }
});

// Main App Content Component
function AppContent() {
  const { fileState, generationState } = useAppContext();

  const handleDownload = () => {
    if (generationState.id) {
      window.open(PdfGeneratorService.getDownloadUrl(generationState.id), '_blank');
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: '#0d0033',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}
    >
      <Container
        component='form'
        maxWidth='sm'
        disableGutters
        sx={{
          backgroundColor: '#dadaff',
          p: 5,
          borderRadius: '10px',
        }}
      >
        <Typography
          variant='h3'
          component='h1'
          fontFamily={'georgia'}
          mb={2}
        >
          MicroBook Maker
        </Typography>
        <Stack spacing={.5} maxWidth='sm'>
          <BookInfoForm />
          <PdfOptions />
          <FileControls />
        </Stack>
      </Container>
      <Container
        maxWidth='sm'
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 3
        }}
      >
        <Typography color='primary' variant='body1' gutterBottom mb={0} sx={{ fontWeight: 'bold' }}>
          Words: {fileState.wordCount === 0 ? '--' : new Intl.NumberFormat().format(fileState.wordCount)}
        </Typography>
        <Box>
          <Tooltip title='Uploads'>
            <StyledIconButton color='primary' onClick={() => window.open('/uploads/', '_blank')}>
              <UploadFileIcon/>
            </StyledIconButton>
          </Tooltip>
          <Tooltip title='History'>
            <StyledIconButton color='primary' onClick={() => window.open('/history/', '_blank')}>
              <HistoryIcon/>
            </StyledIconButton>
          </Tooltip>
        </Box>
      </Container>
      <Container
        maxWidth='sm'
        sx={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center'
        }}
      >
        <Typography color='primary' variant='body1' gutterBottom mb={0} sx={{ fontWeight: 'bold' }}>
          Sheets: {fileState.sheetsCount === 0 ? '--' : new Intl.NumberFormat().format(fileState.sheetsCount)}
        </Typography>
      </Container>
      <Container
        maxWidth='sm'
        sx={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          mt: 0.9
        }}
      >
        <Typography color='primary' variant='body1' gutterBottom mb={0} sx={{ fontWeight: 'bold' }}>
          Read Time: {fileState.readTime}
        </Typography>
      </Container>
      <GenerationStatus onDownload={handleDownload} />
    </Box>
  );
}

// Main App Component with Provider
function App() {
  return (
    <AppProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContent />
      </ThemeProvider>
    </AppProvider>
  );
}

export default App;
