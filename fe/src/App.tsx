import Button from '@mui/material/Button';
import React, { useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import {CssBaseline, Backdrop, CircularProgress} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

function App() {
  const [disableUpload, setDisableUpload] = useState(true);
  const [bookName, setBookName] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [fontSize, setFontSize] = useState('5');
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState<string|null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setDisableUpload(false);
      setBookName(event.target.files[0].name.split('.')[0]);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string).trim();
        const wordCount = text.split(/\s+/).length;
        setWordCount(wordCount);
      }
      reader.readAsText(event.target.files[0]);
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
          wordCount: wordCount.toString()
        });
        const response = await fetch(`/api/upload?${params.toString()}`, {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        // const blob = await response.blob();
        // const url = window.URL.createObjectURL(blob);
        // const link = document.createElement('a');
        // link.href = url;
        // link.setAttribute('download', 'output.pdf'); // or any other filename you want
        // document.body.appendChild(link);
        // link.click();
        // link.remove();
        // window.open(url);

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
                if (+e.target.value < 4) setDisableUpload(true);
                else if (uploadRef?.current?.files?.length) setDisableUpload(false);
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
            <label htmlFor='contained-button-file'>
              <Button
               variant='contained' 
               component='span'
               disableElevation
              >
                Select file
              </Button>
            </label>
          </Box>
          <Typography variant='caption' gutterBottom>
            {new Intl.NumberFormat().format(wordCount)} Words
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
            <Typography sx={{ mt: 2 }}>Click the button below and keep reloading the page to check the status of the PDF and to download when complete</Typography>
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
