import React from 'react';
import {
  Button,
  Box,
  Tooltip,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useAppContext } from '../context/AppContext';
import { useFileHandling } from '../hooks/useFileHandling';

const FileControls: React.FC = () => {
  const { fileState } = useAppContext();
  const { uploadRef, handleFileChange, handleUploadFile } = useFileHandling();
  return (
    <Box // BUTTONS
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <Box mt={2}>
        {' '}
        {/* SELECT TXT */}
        <input
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          ref={uploadRef}
          accept=".txt"
          id="contained-button-file"
        />
        <Tooltip
          enterDelay={400}
          enterNextDelay={400}
          placement="top"
          title={fileState.fileName}
        >
          <label htmlFor="contained-button-file">
            <Button
              variant="contained"
              component="span"
              disableElevation
              sx={{ borderRadius: '6px' }}
              size="small"
            >
              Select TXT
            </Button>
          </label>
        </Tooltip>
      </Box>
      <Box mt={2}>
        {' '}
        {/* GENERATE */}
        <Button
          variant="contained"
          disabled={fileState.disableUpload}
          onClick={handleUploadFile}
          disableElevation
          endIcon={<PictureAsPdfIcon />}
          sx={{
            borderRadius: '6px',
          }}
        >
          Generate
        </Button>
      </Box>
    </Box>
  );
};

export default FileControls;
