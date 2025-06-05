import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import {
  CssBaseline,
  styled,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Stack from '@mui/material/Stack';

// Components
import {
  BookInfoForm,
  PdfOptions,
  FileControls,
  GenerationStatus,
} from './components';

// Utils and types
import { calculatePapers, calculateReadingTime, getBookInfo } from './utils';
import { UploadParams } from './types';

const StyledIconButton = styled(IconButton)`
  &:hover {
    background-color: #14035591;
  }
`;

function App() {
  const [disableUpload, setDisableUpload] = useState(true);
  const [bookName, setBookName] = useState('');
  const [author, setAuthor] = useState('');
  const [series, setSeries] = useState('');
  const [year, setYear] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [sheetsCount, setSheetsCount] = useState(0);
  const [fontSize, setFontSize] = useState('6');
  const [borderStyle, setBorderStyle] = useState('dashed');
  const [loading, setLoading] = useState(false);
  const [bookInfoLoading, setBookInfoLoading] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [readTime, setReadTime] = useState('--');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.endsWith('.txt')) {
        alert('Invalid file type. Please select a .txt file.');
        return;
      }

      const bookNiceName = file.name.split('.')[0];

      setDisableUpload(false);
      setBookName(bookNiceName);
      setFileName(file.name);
      handleGetBookInfo(bookNiceName);

      const reader = new FileReader();
      reader.onload = e => {
        const text = (e.target?.result as string).trim();
        const wordSplit = text.split(' ').length;
        setWordCount(wordSplit);
        setSheetsCount(calculatePapers(wordSplit, fontSize));
        setReadTime(calculateReadingTime(wordSplit));
      };
      reader.readAsText(file);
    }
  };

  const handleGetBookInfo = async (bookTitle: string): Promise<void> => {
    setBookInfoLoading(true);
    try {
      const bookInfo = await getBookInfo(bookTitle);
      if (bookInfo) {
        if (bookInfo.author) setAuthor(bookInfo.author);
        if (bookInfo.publishYear) setYear(bookInfo.publishYear);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setBookInfoLoading(false);
    }
  };

  const handleUploadFile = async (): Promise<void> => {
    if (uploadRef?.current?.files?.length) {
      setLoading(true);
      const file = uploadRef.current.files[0];

      const formData = new FormData();
      formData.append('file', file);
      const params: UploadParams = {
        bookName: bookName,
        borderStyle: borderStyle,
        headerInfo: {
          series: series,
          sheetsCount: sheetsCount.toString(),
          wordCount: wordCount,
          readTime: readTime,
          author: author,
          year: year,
          fontSize: fontSize,
        },
      };
      formData.append('params', JSON.stringify(params));

      try {
        const response = await fetch(`/api/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setId(data.id);
      } catch (error) {
        console.error('There was a problem with the fetch operation: ', error);
      }
    }
  };

  const handleFontSizeChange = (newFontSize: string) => {
    if (+newFontSize < 4 || +newFontSize > 10) {
      setSheetsCount(0);
      setDisableUpload(true);
    } else if (uploadRef?.current?.files?.length) {
      setDisableUpload(false);
      setSheetsCount(calculatePapers(wordCount, newFontSize));
    }
  };

  const theme = createTheme({
    palette: {
      primary: {
        main: '#3f51b5',
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          backgroundColor: '#0d0033',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Container
          component="form"
          maxWidth="sm"
          disableGutters
          sx={{
            backgroundColor: '#dadaff',
            p: 5,
            borderRadius: '10px',
          }}
        >
          <Typography variant="h3" component="h1" fontFamily={'georgia'} mb={2}>
            MicroBook Maker
          </Typography>
          <Stack spacing={0.5} maxWidth="sm">
            <BookInfoForm
              bookName={bookName}
              setBookName={setBookName}
              author={author}
              setAuthor={setAuthor}
              series={series}
              setSeries={setSeries}
              year={year}
              setYear={setYear}
              bookInfoLoading={bookInfoLoading}
              onRefreshBookInfo={handleGetBookInfo}
            />
            <PdfOptions
              fontSize={fontSize}
              setFontSize={setFontSize}
              borderStyle={borderStyle}
              setBorderStyle={setBorderStyle}
              onFontSizeChange={handleFontSizeChange}
            />
            <FileControls
              uploadRef={uploadRef}
              fileName={fileName}
              disableUpload={disableUpload}
              onFileChange={handleFileChange}
              onUploadFile={handleUploadFile}
            />
          </Stack>
        </Container>
        <Container
          maxWidth="sm"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pt: 3,
          }}
        >
          <Typography
            color="primary"
            variant="body1"
            gutterBottom
            mb={0}
            sx={{ fontWeight: 'bold' }}
          >
            Words:{' '}
            {wordCount === 0 ? '--' : new Intl.NumberFormat().format(wordCount)}
          </Typography>
          <Box>
            <Tooltip title="Uploads">
              <StyledIconButton
                color="primary"
                onClick={() => window.open('/uploads/', '_blank')}
              >
                <UploadFileIcon />
              </StyledIconButton>
            </Tooltip>
            <Tooltip title="History">
              <StyledIconButton
                color="primary"
                onClick={() => window.open('/history/', '_blank')}
              >
                <HistoryIcon />
              </StyledIconButton>
            </Tooltip>
          </Box>
        </Container>
        <Container
          maxWidth="sm"
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <Typography
            color="primary"
            variant="body1"
            gutterBottom
            mb={0}
            sx={{ fontWeight: 'bold' }}
          >
            Sheets:{' '}
            {sheetsCount === 0
              ? '--'
              : new Intl.NumberFormat().format(sheetsCount)}
          </Typography>
        </Container>
        <Container
          maxWidth="sm"
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            mt: 0.9,
          }}
        >
          <Typography
            color="primary"
            variant="body1"
            gutterBottom
            mb={0}
            sx={{ fontWeight: 'bold' }}
          >
            Read Time: {readTime}
          </Typography>
        </Container>
        <GenerationStatus
          loading={loading}
          id={id}
          onClose={() => setLoading(false)}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
