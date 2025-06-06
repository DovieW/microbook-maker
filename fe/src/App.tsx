import React from 'react';
import { Box, Typography, CssBaseline, Tooltip, Stack } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { AppProvider, useAppContext } from './context/AppContext';
import { BookInfoForm, FileControls, PdfOptions, GenerationStatus } from './components';
import { PdfGeneratorService } from './services';
import { theme } from './theme';
import {
  DarkBackground,
  MainFormContainer,
  SpaceBetweenContainer,
  InfoDisplayContainer,
  StyledIconButton,
  BoldText
} from './components/styled';

// Main App Content Component
function AppContent() {
  const { fileState, generationState } = useAppContext();

  const handleDownload = () => {
    if (generationState.id) {
      window.open(PdfGeneratorService.getDownloadUrl(generationState.id), '_blank');
    }
  };

  return (
    <DarkBackground>
      <MainFormContainer>
        <Typography
          variant='h3'
          component='h1'
          sx={{ mb: 2 }}
        >
          MicroBook Maker
        </Typography>
        <Stack spacing={0.5}>
          <BookInfoForm />
          <PdfOptions />
          <FileControls />
        </Stack>
      </MainFormContainer>

      <SpaceBetweenContainer maxWidth='sm'>
        <BoldText color='primary' variant='body1'>
          Words: {fileState.wordCount === 0 ? '--' : new Intl.NumberFormat().format(fileState.wordCount)}
        </BoldText>
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
      </SpaceBetweenContainer>

      <InfoDisplayContainer maxWidth='sm'>
        <BoldText color='primary' variant='body1'>
          Sheets: {fileState.sheetsCount === 0 ? '--' : new Intl.NumberFormat().format(fileState.sheetsCount)}
        </BoldText>
      </InfoDisplayContainer>

      <InfoDisplayContainer maxWidth='sm'>
        <BoldText color='primary' variant='body1'>
          Read Time: {fileState.readTime}
        </BoldText>
      </InfoDisplayContainer>

      <GenerationStatus onDownload={handleDownload} />
    </DarkBackground>
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
