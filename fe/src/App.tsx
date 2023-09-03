import Button from '@mui/material/Button';
import React, { useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import {CssBaseline, Backdrop, CircularProgress} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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
  const [wordCount, setWordCount] = useState(0);
  const [papersCount, setPapersCount] = useState(0);
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

      setDisableUpload(false);
      setBookName(file.name.split('.')[0]);
      setFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string).trim();
        const wordSplit = text.split(' ').length;
        setWordCount(wordSplit);
        setPapersCount(calculatePapers(wordSplit, fontSize));
      }
      reader.readAsText(file);
    }
  }

  async function uploadFile() {
    if (uploadRef?.current?.files?.length) {
      setLoading(true);
      const file = uploadRef.current.files[0];
  
      const formData = new FormData();
      formData.append('file', file);
  
      try {
        const params = new URLSearchParams({
          bookName: bookName,
          fontSize: fontSize,
          wordCount: wordCount.toString(),
          papersCount: papersCount.toString()
        });
        const response = await fetch(`/api/upload?${params.toString()}`, {
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
          backgroundColor: '#000033',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Container
          component='form'
          maxWidth='sm'
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: '#dadaff',
            padding: 3,
            borderRadius: 1,
            boxShadow: 3,
          }}
        >
          <Typography variant='h3' component='h1' gutterBottom fontFamily={'georgia'}>
            MicroBook Maker
          </Typography>
          <Box>
             <TextField
              value={bookName}
              onChange={e => setBookName(e.target.value)}
              label='Book Name'
              variant='outlined'
              margin='normal'
              fullWidth
            />
            <TextField
              value={fontSize}
              onChange={e => {
                setFontSize(e.target.value);
                if (+e.target.value < 4 || +e.target.value > 10) {
                  setPapersCount(0);
                  setDisableUpload(true);
                } else if (uploadRef?.current?.files?.length) {
                  setDisableUpload(false);
                  setPapersCount(calculatePapers(wordCount, e.target.value));
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
          <Box mt={2}>
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
                >
                  Select file
                </Button>
              </label>
            </Tooltip>
          </Box>
          <Typography variant='caption' gutterBottom>
            {new Intl.NumberFormat().format(wordCount)} Words
          </Typography>
          <Typography variant='caption' gutterBottom>
            {new Intl.NumberFormat().format(papersCount)} Sheets
          </Typography>
          <Box mt={2}>
            <Button 
              variant='contained'
              disabled={disableUpload}
              onClick={uploadFile}
              disableElevation
              endIcon={<PictureAsPdfIcon/>}
            >
              Generate
            </Button>
          </Box>
        </Container>
        <Container
          maxWidth='sm'
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 3,
          }}
        >
          <Tooltip title='Uploads'>
            <IconButton color='primary' onClick={() => window.open('/uploads', '_blank')}>
              <UploadFileIcon/>
            </IconButton>
          </Tooltip>
          <Tooltip title='History'>
            <IconButton color='primary' onClick={() => window.open('/generated', '_blank')}>
              <HistoryIcon/>
            </IconButton>
          </Tooltip>
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
            <Button
              variant='contained'
              sx={{mt: 2}}
              component='span'
              disableElevation
              onClick={() => {
                setLoading(false);
                window.open(`/api/download?id=${id}&bookName=${bookName}`, '_blank');
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
