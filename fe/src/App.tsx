
import { useRef, useEffect, useState } from 'react';
import { Box, Typography, CssBaseline, Stack, Button } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import { AppProvider, useAppContext } from './context/AppContext';
import { JobManagementProvider } from './context/JobManagementContext';
import { BookInfoForm, FileControls, PdfOptions, JobManagement } from './components';
import NotificationContainer from './components/NotificationContainer';
import DragDropZone from './components/DragDropZone';
import { PdfGeneratorService } from './services';
import { theme } from './theme';
import { useFileHandling } from './hooks/useFileHandling';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useNotifications } from './hooks/useNotifications';
import {
  DarkBackground,
  MainFormContainer,
  BoldText,
} from './components/styled';

// Main App Content Component
function AppContent() {
  const { fileState, generationState } = useAppContext();
  const { handleFileDrop } = useFileHandling();
  const { showError } = useNotifications();
  const dragDropRef = useRef<HTMLDivElement>(null);
  const [showJobs, setShowJobs] = useState(false);

  const { isDragActive, isDragOver, bindDragEvents } = useDragAndDrop({
    onFileDrop: handleFileDrop,
    acceptedFileTypes: ['.txt'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    onError: (error) => showError('Drag & Drop Error', error),
  });

  // Bind drag events to the container
  useEffect(() => {
    const cleanup = bindDragEvents(dragDropRef.current);
    return cleanup;
  }, [bindDragEvents]);

  const handleDownload = () => {
    if (generationState.id) {
      window.open(PdfGeneratorService.getDownloadUrl(generationState.id), '_blank');
    }
  };

  return (
    <DarkBackground ref={dragDropRef}>
      {/* Main Layout Container */}
      <Box sx={{
        display: 'flex',
        gap: 3,
        alignItems: 'flex-start',
        width: '100%',
        maxWidth: showJobs ? '1040px' : '600px', // 600px + 400px + 40px gap
        justifyContent: 'center',
      }}>
        {/* Main Content */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '600px',
          flex: '0 0 600px',
        }}>
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
              <FileControls onJobStarted={() => setShowJobs(true)} />
            </Stack>
          </MainFormContainer>

          {/* Two containers side by side below the main card */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mt: '20px',
            px: '10px',
            maxWidth: '600px',
            width: '100%'
          }}>
            {/* Left container for stats */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}>
              <BoldText color='primary' variant='body1'>
                Words: {fileState.wordCount > 0 ? new Intl.NumberFormat().format(fileState.wordCount) : '--'}
              </BoldText>

              <BoldText color='primary' variant='body1'>
                Sheets: {fileState.sheetsCount > 0 ? new Intl.NumberFormat().format(fileState.sheetsCount) : '--'}
              </BoldText>

              <BoldText color='primary' variant='body1'>
                Read Time: {fileState.readTime}
              </BoldText>
            </Box>

            {/* Right container for View Jobs button */}
            <Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowJobs(!showJobs)}
                startIcon={<HistoryIcon />}
              >
                {showJobs ? 'Hide Jobs' : 'View Jobs'}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Jobs Panel - Slides out from under main card */}
        <Box sx={{
          width: showJobs ? '400px' : '0px',
          flex: showJobs ? '0 0 400px' : '0 0 0px',
          overflow: 'hidden',
          transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Perfect easing
          alignSelf: 'flex-start',
        }}>
          <Box sx={{
            width: '400px', // Fixed inner width
            backgroundColor: '#dadaff', // Same as MainFormContainer
            borderRadius: '10px', // Same as MainFormContainer (xlarge)
            boxShadow: 3,
            p: 2,
            opacity: showJobs ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out 0.1s', // Slight delay for opacity
          }}>
            <JobManagement />
          </Box>
        </Box>
      </Box>

      <DragDropZone isDragActive={isDragActive} isDragOver={isDragOver}>
        <></>
      </DragDropZone>


      <NotificationContainer />
    </DarkBackground>
  );
}

// Main App Component with Provider
function App() {
  return (
    <AppProvider>
      <JobManagementProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppContent />
        </ThemeProvider>
      </JobManagementProvider>
    </AppProvider>
  );
}

export default App;
