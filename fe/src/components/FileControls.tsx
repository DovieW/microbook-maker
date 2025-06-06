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
  HiddenFileInput
} from './styled';

const FileControls: React.FC = () => {
  const { fileState } = useAppContext();
  const { uploadRef, handleFileChange, handleUploadFile } = useFileHandling();

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
          title={fileState.fileName}
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
        <Button
          variant="contained"
          disabled={fileState.disableUpload}
          onClick={handleUploadFile}
          endIcon={<PictureAsPdfIcon />}
        >
          Generate
        </Button>
      </ButtonContainer>
    </ControlsContainer>
  );
};

export default FileControls;
