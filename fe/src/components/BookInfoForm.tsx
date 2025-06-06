import React from 'react';
import {
  TextField,
  Box,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAppContext } from '../context/AppContext';

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
    <Box
      sx={{
        position: 'relative',
        ...(bookInfoLoading && {
          opacity: 0.5,
          pointerEvents: 'none',
        }),
      }}
    >
      {bookInfoLoading && (
        <CircularProgress
          size={40}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-20px',
            marginLeft: '-20px',
          }}
        />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          value={bookInfo.bookName}
          onChange={e => setBookName(e.target.value)}
          label="Book Name"
          variant="outlined"
          margin="normal"
          fullWidth
          sx={{ flexGrow: 1, mr: 1 }}
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
      </Box>
      <Box>
        {' '}
        {/* SERIES NAME */}
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
        {' '}
        {/* AUTHOR AND YEAR */}
        <Stack
          direction="row"
          spacing={2}
          justifyContent="flex-start"
          sx={{
            mt: 2,
          }}
        >
          <TextField
            value={bookInfo.author}
            onChange={e => setAuthor(e.target.value)}
            label="Author"
            variant="outlined"
            margin="normal"
            sx={{ flexGrow: 1 }}
          />
          <TextField
            value={bookInfo.year}
            onChange={e => setYear(e.target.value)}
            label="Year"
            type="number"
            variant="outlined"
            margin="normal"
            sx={{
              width: '120px',
            }}
          />
        </Stack>
      </Box>
    </Box>
  );
};

export default BookInfoForm;
