import React from 'react';
import {
  Stack,
  Select,
  MenuItem,
  InputLabel,
  FormHelperText,
  Tooltip,
} from '@mui/material';
import { useAppContext } from '../context/AppContext';
import { useFileHandling } from '../hooks/useFileHandling';
import { useFormValidation } from '../hooks/useFormValidation';
import {
  OptionsContainer,
  NarrowField,
  StyledFormControl,
} from './styled';

const PdfOptions: React.FC = () => {
  const {
    pdfOptions,
    setBorderStyle,
  } = useAppContext();

  const { handleFontSizeChange } = useFileHandling();
  const { getFieldError, hasFieldError, getFieldGuidance } = useFormValidation();

  const handleFontSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFontSize = e.target.value;
    handleFontSizeChange(newFontSize);
  };

  const fontSizeError = getFieldError('fontSize');
  const fontSizeGuidance = getFieldGuidance('fontSize');

  return (
    <OptionsContainer>
      <Stack
        direction="row"
        spacing={2}
        justifyContent="flex-start"
        sx={{ mt: 2 }}
      >
        <Tooltip
          title={fontSizeGuidance || "Choose a font size between 4-10. Smaller fonts fit more text per page but may be harder to read."}
          placement="top"
          arrow
        >
          <div>
            <NarrowField
              value={pdfOptions.fontSize}
              onChange={handleFontSizeInputChange}
              label="Font Size"
              type="number"
              variant="outlined"
              margin="normal"
              error={hasFieldError('fontSize')}
              inputProps={{
                min: 4,
                max: 10,
                step: 0.5,
              }}
              helperText={fontSizeError || 'Range: 4-10'}
            />
          </div>
        </Tooltip>

        <Tooltip
          title="Select the border style for page divisions in your PDF"
          placement="top"
          arrow
        >
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
            <FormHelperText>Style for page borders</FormHelperText>
          </StyledFormControl>
        </Tooltip>
      </Stack>
    </OptionsContainer>
  );
};

export default PdfOptions;
