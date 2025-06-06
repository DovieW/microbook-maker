import React from 'react';
import {
  TextField,
  Box,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAppContext } from '../context/AppContext';
import {
  LoadingOverlay,
  LoadingSpinner,
  FormRow,
  FormField,
  NarrowField
} from './styled';

const BookInfoForm: React.FC = () => {
  const {
    bookInfo,
    setBookName,
    setAuthor,
    setSeries,
    setYear,
    fetchBookInfo,
    bookInfoLoading,
  } = useAppContext();

  return (
    <LoadingOverlay className={bookInfoLoading ? 'loading' : ''}>
      {bookInfoLoading && <LoadingSpinner size={40} />}

      <FormRow>
        <FormField
          value={bookInfo.bookName}
          onChange={e => setBookName(e.target.value)}
          label="Book Name"
          variant="outlined"
          margin="normal"
          fullWidth
        />
        <Tooltip title="Reload book info">
          <span>
            <IconButton
              onClick={() => fetchBookInfo(bookInfo.bookName)}
              disabled={!bookInfo.bookName || bookInfoLoading}
              color="primary"
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </FormRow>

      <Box>
        <TextField
          value={bookInfo.series}
          onChange={e => setSeries(e.target.value)}
          label="Series Name and Book Number"
          variant="outlined"
          margin="normal"
          fullWidth
        />
      </Box>

      <Box>
        <Stack
          direction="row"
          spacing={2}
          justifyContent="flex-start"
          sx={{ mt: 2 }}
        >
          <TextField
            value={bookInfo.author}
            onChange={e => setAuthor(e.target.value)}
            label="Author"
            variant="outlined"
            margin="normal"
            sx={{ flexGrow: 1 }}
          />
          <NarrowField
            value={bookInfo.year}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYear(e.target.value)}
            label="Year"
            type="number"
            variant="outlined"
            margin="normal"
          />
        </Stack>
      </Box>
    </LoadingOverlay>
  );
};

export default BookInfoForm;
