import React from 'react';
import {
  Stack,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import { useAppContext } from '../context/AppContext';
import { useFileHandling } from '../hooks/useFileHandling';
import {
  OptionsContainer,
  NarrowField,
  StyledFormControl
} from './styled';

const PdfOptions: React.FC = () => {
  const {
    pdfOptions,
    setBorderStyle,
  } = useAppContext();

  const { handleFontSizeChange } = useFileHandling();

  const handleFontSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFontSize = e.target.value;
    handleFontSizeChange(newFontSize);
  };

  return (
    <OptionsContainer>
      <Stack
        direction="row"
        spacing={2}
        justifyContent="flex-start"
        sx={{ mt: 2 }}
      >
        <NarrowField
          value={pdfOptions.fontSize}
          onChange={handleFontSizeInputChange}
          label="Font Size"
          type="number"
          variant="outlined"
          margin="normal"
          inputProps={{
            min: 4,
            max: 10,
          }}
        />
        <StyledFormControl
          variant="outlined"
          margin="normal"
        >
          <InputLabel>Border Style</InputLabel>
          <Select
            value={pdfOptions.borderStyle}
            onChange={e => setBorderStyle(e.target.value)}
            label="Border Style"
          >
            <MenuItem value="dashed">Dashed</MenuItem>
            <MenuItem value="solid">Solid</MenuItem>
            <MenuItem value="dotted">Dotted</MenuItem>
          </Select>
        </StyledFormControl>
      </Stack>
    </OptionsContainer>
  );
};

export default PdfOptions;
