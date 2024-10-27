import Button from '@mui/material/Button';
import React, { useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import {CssBaseline, Backdrop, styled, Divider} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Stack from '@mui/material/Stack';

const StyledIconButton = styled(IconButton)`
  &:hover {
    background-color: #14035591;
  }
`;

type PaperCountsType = {
  [key: string]: number;
};

const paperCounts: PaperCountsType = {
  "4": 38266,
  "5": 24427,
  "6": 16850,
  "7": 12278,
  "8": 9113,
  "9": 7070,
  "10": 5584
};

const calculatePapers = (wordCount: number, fontSize: string): number => {
  const wordsPerPaper = paperCounts[fontSize];
  if (!wordsPerPaper) return 0;
  return Math.ceil(wordCount / wordsPerPaper);
};

function App() {
  const [disableUpload, setDisableUpload] = useState(true);
  const [bookName, setBookName] = useState('');
  const [author, setAuthor] = useState('');
  const [series, setSeries] = useState('');
  const [year, setYear] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [sheetsCount, setSheetsCount] = useState(0);
  const [fontSize, setFontSize] = useState('6');
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState<string|null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.endsWith('.txt')) {
        alert("Invalid file type. Please select a .txt file.");
        return;
      }

      const bookNiceName = file.name.split('.')[0];

      setDisableUpload(false);
      setBookName(bookNiceName);
      setFileName(file.name);
      getBookInfo(bookNiceName);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string).trim();
        const wordSplit = text.split(' ').length;
        setWordCount(wordSplit);
        setSheetsCount(calculatePapers(wordSplit, fontSize));
      }
      reader.readAsText(file);
    }
  }

  async function getBookInfo(bookTitle: any) {
    const baseURL = 'https://openlibrary.org/search.json';
    const encodedTitle = encodeURIComponent(bookTitle);
    const url = `${baseURL}?q=${encodedTitle}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch book information');
        }

        const data = await response.json();
        if (data.docs && data.docs.length > 0) {
            const book = data.docs[0];
            const bookInfo = {
                author: book.author_name ? book.author_name[0] : '',
                publishYear: book.first_publish_year || '',
            };

            if (bookInfo.author) setAuthor(bookInfo.author);
            if (bookInfo.publishYear) setYear(bookInfo.publishYear);
        } else {
            console.log('No book found with that title.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
  }

  async function uploadFile() {
    if (uploadRef?.current?.files?.length) {
      setLoading(true);
      const file = uploadRef.current.files[0];
  
      const formData = new FormData();
      formData.append('file', file);
      const params = {
        bookName: bookName,
        headerInfo: {
          series: series,
          sheetsCount: sheetsCount.toString(),
          wordCount: wordCount,
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
  }

  const theme = createTheme({
    palette: {
      primary: {
        main: '#3f51b5',
      }
    }
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <Box
        sx={{
          backgroundColor: '#0d0033',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh'
        }}
      >
        <Container
          component='form'
          maxWidth='sm'
          disableGutters
          sx={{
            // display: 'flex',
            // flexDirection: 'column',
            // alignItems: 'center',
            backgroundColor: '#dadaff',
            p: 5,
            borderRadius: '10px',
            // boxShadow: '0px 0px 50px 1px rgba(219, 218, 255, 0.2)',
          }}
        >
          <Typography 
              variant='h3'
              component='h1'
              fontFamily={'georgia'}
              mb={2}
            >
              MicroBook Maker
            </Typography>
          <Stack
            spacing={.5}
            maxWidth='sm'
            // divider=<Divider/>
            // sx={{
            //   backgroundColor: '#dadaff',
            //   padding: 10,
            //   borderRadius: '10px',
            //   boxShadow: 3,
            // }}
          >
            <Box> {/* BOOK NAME */}
              <TextField
                value={bookName}
                onChange={e => setBookName(e.target.value)}
                label='Book Name'
                variant='outlined'
                margin='normal'
                fullWidth
              />
            </Box>
            <Box> {/* SERIES NAME */}
              <TextField
                value={series}
                onChange={e => setSeries(e.target.value)}
                label='Series Name and Book Number'
                variant='outlined'
                margin='normal'
                fullWidth
              />
            </Box>
            <Box> {/* AUTHOR */}
              <TextField
                value={author}
                onChange={e => setAuthor(e.target.value)}
                label='Author'
                variant='outlined'
                margin='normal'
                fullWidth
              />
            </Box>
            <Box> {/* YEAR */}
              <TextField
                value={year}
                onChange={e => setYear(e.target.value)}
                label='Year'
                type='number'
                variant='outlined'
                margin='normal'
                sx={{width: '120px'}}
              />
            </Box>
            <Box> {/* FONT SIZE */}
              <TextField
                value={fontSize}
                onChange={e => {
                  setFontSize(e.target.value);
                  if (+e.target.value < 4 || +e.target.value > 10) {
                    setSheetsCount(0);
                    setDisableUpload(true);
                  } else if (uploadRef?.current?.files?.length) {
                    setDisableUpload(false);
                    setSheetsCount(calculatePapers(wordCount, e.target.value));
                  }
                }}
                label='Font Size'
                type='number'
                variant='outlined'
                margin='normal'
                sx={{width: '120px'}}
                inputProps={{
                  min: 4,
                  max: 10,
                }}
              />
            </Box>
            <Box // BUTTONS
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <Box mt={2}> {/* SELECT TXT */}
                <input
                  type='file'
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  ref={uploadRef} 
                  accept='.txt'
                  id='contained-button-file'
                />
                <Tooltip
                  enterDelay={400}
                  enterNextDelay={400}
                  placement="top"
                  title={fileName}
                >
                  <label htmlFor='contained-button-file'>
                    <Button
                      variant='contained'
                      component='span'
                      disableElevation
                      sx={{ borderRadius: '6px' }}
                      size='small'
                    >
                      Select TXT
                    </Button>
                  </label>
                </Tooltip>
              </Box>
              <Box mt={2}> {/* GENERATE */}
                <Button
                  variant='contained'
                  disabled={disableUpload}
                  onClick={uploadFile}
                  disableElevation
                  endIcon={<PictureAsPdfIcon/>}
                  sx={{ 
                    borderRadius: '6px'
                  }}
                >
                  Generate
                </Button>
              </Box>
            </Box>
          </Stack>
        </Container>
        <Container
          maxWidth='sm'
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pt: 3
          }}
        >
          <Typography color='primary' variant='body1' gutterBottom mb={0} sx={{ fontWeight: 'bold' }}>
            Words: {wordCount === 0 ? '--' : new Intl.NumberFormat().format(wordCount)}
          </Typography>
          <Box>
            <Tooltip title='Uploads'>
              <StyledIconButton color='primary' onClick={() => window.open('/uploads/', '_blank')}>
                <UploadFileIcon/>
              </StyledIconButton>
            </Tooltip>
            <Tooltip title='History'>
              <StyledIconButton color='primary' onClick={() => window.open('/history/', '_blank')}>
                <HistoryIcon/>
              </StyledIconButton>
            </Tooltip>
          </Box>
        </Container>
        <Container
          maxWidth='sm'
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center'
          }}
        >
          <Typography color='primary' variant='body1' gutterBottom mb={0} sx={{ fontWeight: 'bold' }}>
            Sheets: {sheetsCount === 0 ? '--' : new Intl.NumberFormat().format(sheetsCount)}
          </Typography>
        </Container>
        <Backdrop
          open={loading}
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ mt: 2 }}>Click the button below and keep reloading the page to check the status of the PDF</Typography>
            <Typography sx={{ mt: 2 }}>Check the History page for running or completed jobs</Typography>
            <Button
              variant='contained'
              sx={{mt: 2}}
              component='span'
              disableElevation
              onClick={() => {
                setLoading(false);
                window.open(`/api/download?id=${id}`, '_blank');
              }
            }
            >
              Check PDF
            </Button>
          </Box>
        </Backdrop>
      </Box>
    </ThemeProvider>
  );
}

export default App;
