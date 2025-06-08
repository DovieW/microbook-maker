import React from 'react';
import {
  Button,
  Tooltip,
  Typography,
  Box,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useAppContext } from '../context/AppContext';
import { useFileHandling } from '../hooks/useFileHandling';
import { validateFontSize } from '../utils/validation';
import {
  ControlsContainer,
  ButtonContainer,
  HiddenFileInput,
} from './styled';

interface FileControlsProps {
  onJobStarted?: () => void;
}

const FileControls: React.FC<FileControlsProps> = ({ onJobStarted }) => {
  const { fileState, pdfOptions } = useAppContext();
  const { uploadRef, handleFileChange, createHandleUploadFile } = useFileHandling();

  const handleUploadFile = createHandleUploadFile(onJobStarted);

  // Use centralized validation logic
  const fontSizeValidation = validateFontSize(pdfOptions.fontSize);
  const hasValidFontSize = fontSizeValidation.isValid;
  const hasFile = !!fileState.fileName;

  const getDisabledReason = () => {
    if (!hasFile) return 'Please select a TXT file first';
    if (!hasValidFontSize) return fontSizeValidation.error || 'Please enter a valid font size (4-10)';
    return '';
  };

  const disabledReason = getDisabledReason();

  return (
    <ControlsContainer>
      <ButtonContainer>
        <HiddenFileInput
          type="file"
          onChange={handleFileChange}
          ref={uploadRef}
          accept=".txt"
          id="contained-button-file"
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {fileState.fileName && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {fileState.fileName}
            </Typography>
          )}
          <label htmlFor="contained-button-file">
            <Button
              variant="contained"
              component="span"
              size="small"
            >
              Select TXT
            </Button>
          </label>
        </Box>
      </ButtonContainer>

      <ButtonContainer>
        <Tooltip
          title={disabledReason}
          placement="top"
          arrow
        >
          <span>
            <Button
              variant="contained"
              disabled={fileState.disableUpload}
              onClick={handleUploadFile}
              endIcon={<PictureAsPdfIcon />}
            >
              Generate
            </Button>
          </span>
        </Tooltip>
      </ButtonContainer>
    </ControlsContainer>
  );
};

export default FileControls;
