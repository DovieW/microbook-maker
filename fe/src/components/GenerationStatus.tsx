import React from 'react';
import {
  Backdrop,
} from '@mui/material';
import { useAppContext } from '../context/AppContext';
import {
  StatusContainer,
  StatusText,
  StatusButton
} from './styled';

interface GenerationStatusProps {
  onDownload?: () => void;
}

const GenerationStatus: React.FC<GenerationStatusProps> = ({ onDownload }) => {
  const { generationState, setLoading } = useAppContext();

  const handleCheckPdf = () => {
    setLoading(false);
    if (onDownload) {
      onDownload();
    } else if (generationState.id) {
      window.open(`/api/download?id=${generationState.id}`, '_blank');
    }
  };

  return (
    <Backdrop
      open={generationState.loading}
      sx={{
        color: '#fff',
        zIndex: theme => theme.zIndex.drawer + 1
      }}
    >
      <StatusContainer>
        <StatusText>
          Click the button below and keep reloading the page to check the
          status of the PDF
        </StatusText>
        <StatusText>
          Check the History page for running or completed jobs
        </StatusText>
        <StatusButton
          variant="contained"
          onClick={handleCheckPdf}
        >
          Check PDF
        </StatusButton>
      </StatusContainer>
    </Backdrop>
  );
};

export default GenerationStatus;
