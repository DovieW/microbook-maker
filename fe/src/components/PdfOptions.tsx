import React from 'react';
import {
  TextField,
  Box,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useAppContext } from '../context/AppContext';
import { useFileHandling } from '../hooks/useFileHandling';

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
    <Box>
      {' '}
      {/* FONT SIZE AND BORDER STYLE */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="flex-start"
        sx={{
          mt: 2,
        }}
      >
        <TextField
          value={pdfOptions.fontSize}
          onChange={handleFontSizeInputChange}
          label="Font Size"
          type="number"
          variant="outlined"
          margin="normal"
          sx={{ width: '120px' }}
          inputProps={{
            min: 4,
            max: 10,
          }}
        />
        <FormControl
          variant="outlined"
          margin="normal"
          sx={{ width: '150px' }}
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
        </FormControl>
      </Stack>
    </Box>
  );
};

export default PdfOptions;
