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

interface PdfOptionsProps {
  fontSize: string;
  setFontSize: (value: string) => void;
  borderStyle: string;
  setBorderStyle: (value: string) => void;
  onFontSizeChange: (fontSize: string) => void;
}

const PdfOptions: React.FC<PdfOptionsProps> = ({
  fontSize,
  setFontSize,
  borderStyle,
  setBorderStyle,
  onFontSizeChange,
}) => {
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFontSize = e.target.value;
    setFontSize(newFontSize);
    onFontSizeChange(newFontSize);
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
          value={fontSize}
          onChange={handleFontSizeChange}
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
            value={borderStyle}
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
