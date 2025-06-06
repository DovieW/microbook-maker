
import { useRef, useEffect, useState } from 'react';
import { Box, Typography, CssBaseline, Tooltip, Stack, Button, Divider } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { AppProvider, useAppContext } from './context/AppContext';
import { BookInfoForm, FileControls, PdfOptions, GenerationStatus, JobManagement } from './components';
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
  StyledIconButton,
  BoldText
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
      <Box sx={{
        display: 'flex',
        gap: 3,
        width: '100%',
        maxWidth: showJobs ? 1400 : 600,
        alignItems: 'flex-start'
      }}>
        {/* Main Form Section */}
        <Box sx={{
          flex: showJobs ? '0 0 600px' : '1 1 auto',
          maxWidth: showJobs ? '600px' : '100%'
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
              <FileControls />
            </Stack>

            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 2,
              px: 3
            }}>
              <BoldText color='primary' variant='body1'>
                Words: {fileState.wordCount > 0 ? new Intl.NumberFormat().format(fileState.wordCount) : '--'}
              </BoldText>
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
          </MainFormContainer>
        </Box>

        {/* Jobs Section */}
        {showJobs && (
          <Box sx={{
            flex: '1 1 auto',
            minWidth: 0, // Allow shrinking
            maxWidth: 800
          }}>
            <JobManagement />
          </Box>
        )}
      </Box>

      <DragDropZone isDragActive={isDragActive} isDragOver={isDragOver}>
        <></>
      </DragDropZone>

      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        mt: 0,
        maxWidth: 600,
        width: '100%',
        px: 3
      }}>
        <BoldText color='primary' variant='body1'>
          Sheets: {fileState.sheetsCount > 0 ? new Intl.NumberFormat().format(fileState.sheetsCount) : '--'}
        </BoldText>
      </Box>

      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        mt: '8.5px',
        maxWidth: 600,
        width: '100%',
        px: 3
      }}>
        <BoldText color='primary' variant='body1'>
          Read Time: {fileState.readTime}
        </BoldText>
      </Box>

      <GenerationStatus onDownload={handleDownload} />
      <NotificationContainer />
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
