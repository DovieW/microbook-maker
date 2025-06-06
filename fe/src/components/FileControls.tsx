import React from 'react';
import {
  Button,
  Tooltip,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useAppContext } from '../context/AppContext';
import { useFileHandling } from '../hooks/useFileHandling';
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

  // Check for validation issues
  const fontSize = parseFloat(pdfOptions.fontSize);
  const hasValidFontSize = !isNaN(fontSize) && fontSize >= 4 && fontSize <= 10;
  const hasFile = !!fileState.fileName;

  const getDisabledReason = () => {
    if (!hasFile) return 'Please select a TXT file first';
    if (!hasValidFontSize) return 'Please enter a valid font size (4-10)';
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
        <Tooltip
          enterDelay={400}
          enterNextDelay={400}
          placement="top"
          title={fileState.fileName || 'No file selected'}
        >
          <label htmlFor="contained-button-file">
            <Button
              variant="contained"
              component="span"
              size="small"
            >
              Select TXT
            </Button>
          </label>
        </Tooltip>
      </ButtonContainer>

      <ButtonContainer>
        <Tooltip
          title={disabledReason || 'Generate your PDF'}
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
