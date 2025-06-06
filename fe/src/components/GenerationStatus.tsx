import React, { useEffect } from 'react';
import {
  Backdrop,
  Typography,
} from '@mui/material';
import { useAppContext } from '../context/AppContext';
import { useProgressPolling } from '../hooks/useProgressPolling';
import { useNotifications } from '../hooks/useNotifications';
import {
  StatusContainer,
  StatusButton,
  ProgressContainer,
  ProgressBar,
} from './styled';

interface GenerationStatusProps {
  onDownload?: () => void;
}

const GenerationStatus: React.FC<GenerationStatusProps> = ({ onDownload }) => {
  const { generationState, setLoading, setProgress } = useAppContext();
  const { showSuccess, showError } = useNotifications();

  const { progress } = useProgressPolling({
    generationId: generationState.id,
    enabled: generationState.loading && !!generationState.id,
    interval: 2000,
    onComplete: (completedProgress) => {
      setProgress(completedProgress);
      setLoading(false);
      showSuccess(
        'PDF Generated Successfully!',
        'Your PDF has been generated and is ready for download.'
      );
    },
    onError: (error) => {
      setLoading(false);
      showError(
        'PDF Generation Failed',
        error || 'An error occurred during PDF generation. Please try again.'
      );
    },
  });

  // Update progress in context when polling provides updates
  useEffect(() => {
    if (progress) {
      setProgress(progress);
    }
  }, [progress, setProgress]);

  const handleDownloadPdf = () => {
    if (onDownload) {
      onDownload();
    } else if (generationState.id) {
      window.open(`/api/download?id=${generationState.id}`, '_blank');
    }
  };

  const handleCancelGeneration = () => {
    setLoading(false);
    setProgress(null);
  };

  const currentProgress = generationState.progress || progress;
  const isGenerating = currentProgress && !currentProgress.isComplete && !currentProgress.isError;
  const isComplete = currentProgress && currentProgress.isComplete;
  const hasError = currentProgress && currentProgress.isError;

  return (
    <Backdrop
      open={generationState.loading}
      sx={{
        color: '#fff',
        zIndex: theme => theme.zIndex.drawer + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)' // Darker backdrop to hide form elements
      }}
    >
      <StatusContainer>
        {isGenerating ? (
          <>
            <Typography variant="h5" sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold', fontFamily: 'inherit' }}>
              Generating Your PDF
            </Typography>

            <ProgressContainer>
              <ProgressBar
                variant="determinate"
                value={currentProgress.percentage}
                sx={{
                  mb: 2,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 6,
                    background: 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)',
                  }
                }}
              />

              <Typography
                variant="h3"
                sx={{
                  mb: 2,
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontFamily: 'inherit',
                  color: '#fff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  fontSize: '2.5rem',
                  letterSpacing: '0.02em'
                }}
              >
                {currentProgress.percentage}% Complete
              </Typography>

              <Typography
                sx={{
                  fontSize: '1.2rem',
                  mb: 2,
                  textAlign: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  textShadow: '0 2px 4px rgba(0,0,0,0.7)',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                {currentProgress.step}
              </Typography>

              {currentProgress.currentSheet && currentProgress.totalSheets && (
                <Typography
                  sx={{
                    fontSize: '1rem',
                    textAlign: 'center',
                    color: '#fff',
                    fontWeight: 500,
                    textShadow: '0 2px 4px rgba(0,0,0,0.7)',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    mt: 1
                  }}
                >
                  Processing sheet {currentProgress.currentSheet} of {currentProgress.totalSheets}
                </Typography>
              )}
            </ProgressContainer>

            <Typography
              sx={{
                mt: 3,
                mb: 2,
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '1rem',
                lineHeight: 1.5,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}
            >
              Please wait while we generate your PDF. This process may take a few moments depending on the size of your document.
            </Typography>

            <StatusButton
              variant="outlined"
              onClick={handleCancelGeneration}
              sx={{
                mt: 1,
                borderColor: 'rgba(255, 255, 255, 0.5)',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Cancel Generation
            </StatusButton>
          </>
        ) : isComplete ? (
          <>
            <Typography variant="h5" sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold', color: '#4caf50', fontFamily: 'inherit' }}>
              PDF Generated Successfully!
            </Typography>

            <ProgressContainer>
              <ProgressBar
                variant="determinate"
                value={100}
                sx={{
                  mb: 2,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 6,
                    backgroundColor: '#4caf50',
                  }
                }}
              />

              <Typography
                variant="h3"
                sx={{
                  mb: 2,
                  textAlign: 'center',
                  color: '#4caf50',
                  fontWeight: 'bold',
                  fontFamily: 'inherit',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  fontSize: '2.5rem',
                  letterSpacing: '0.02em'
                }}
              >
                100% Complete
              </Typography>
            </ProgressContainer>

            <Typography
              sx={{
                mt: 2,
                mb: 3,
                textAlign: 'center',
                color: '#fff',
                fontSize: '1rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}
            >
              Your PDF has been generated successfully and is ready for download.
            </Typography>

            <StatusButton
              variant="contained"
              onClick={handleDownloadPdf}
              sx={{
                mt: 1,
                backgroundColor: '#4caf50',
                '&:hover': {
                  backgroundColor: '#45a049'
                }
              }}
            >
              Download PDF
            </StatusButton>
          </>
        ) : hasError ? (
          <>
            <Typography variant="h5" sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold', color: '#f44336', fontFamily: 'inherit' }}>
              Generation Failed
            </Typography>

            <Typography
              sx={{
                mt: 2,
                mb: 3,
                textAlign: 'center',
                color: '#fff',
                fontSize: '1rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}
            >
              {currentProgress.errorMessage || 'An error occurred during PDF generation.'}
            </Typography>

            <StatusButton
              variant="contained"
              onClick={handleCancelGeneration}
              sx={{
                mt: 1,
                backgroundColor: '#f44336',
                '&:hover': {
                  backgroundColor: '#d32f2f'
                }
              }}
            >
              Try Again
            </StatusButton>
          </>
        ) : (
          <>
            <Typography variant="h5" sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold', fontFamily: 'inherit' }}>
              Starting PDF Generation...
            </Typography>

            <ProgressContainer>
              <ProgressBar
                variant="indeterminate"
                sx={{
                  mb: 2,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                  }
                }}
              />
            </ProgressContainer>

            <Typography
              sx={{
                mt: 2,
                mb: 3,
                textAlign: 'center',
                color: '#fff',
                fontSize: '1rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}
            >
              Initializing PDF generation process...
            </Typography>

            <StatusButton
              variant="outlined"
              onClick={handleCancelGeneration}
              sx={{
                mt: 1,
                borderColor: 'rgba(255, 255, 255, 0.5)',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Cancel
            </StatusButton>
          </>
        )}
      </StatusContainer>
    </Backdrop>
  );
};

export default GenerationStatus;
