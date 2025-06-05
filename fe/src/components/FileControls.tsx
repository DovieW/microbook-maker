import React from 'react';
import {
  Button,
  Box,
  Tooltip,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

interface FileControlsProps {
  uploadRef: React.RefObject<HTMLInputElement>;
  fileName: string;
  disableUpload: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadFile: () => void;
}

const FileControls: React.FC<FileControlsProps> = ({
  uploadRef,
  fileName,
  disableUpload,
  onFileChange,
  onUploadFile,
}) => {
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
          onChange={onFileChange}
          ref={uploadRef}
          accept=".txt"
          id="contained-button-file"
        />
        <Tooltip
          enterDelay={400}
          enterNextDelay={400}
          placement="top"
          title={fileName}
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
          disabled={disableUpload}
          onClick={onUploadFile}
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
