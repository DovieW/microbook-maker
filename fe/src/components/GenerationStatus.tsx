import React from 'react';
import {
  Backdrop,
  Box,
  Button,
  Typography,
} from '@mui/material';
import { useAppContext } from '../context/AppContext';

const GenerationStatus: React.FC = () => {
  const { generationState, setLoading } = useAppContext();

  const handleCheckPdf = () => {
    setLoading(false);
    window.open(`/api/download?id=${generationState.id}`, '_blank');
  };

  return (
    <Backdrop
      open={generationState.loading}
      sx={{ color: '#fff', zIndex: theme => theme.zIndex.drawer + 1 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ mt: 2 }}>
          Click the button below and keep reloading the page to check the
          status of the PDF
        </Typography>
        <Typography sx={{ mt: 2 }}>
          Check the History page for running or completed jobs
        </Typography>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          component="span"
          disableElevation
          onClick={handleCheckPdf}
        >
          Check PDF
        </Button>
      </Box>
    </Backdrop>
  );
};

export default GenerationStatus;
