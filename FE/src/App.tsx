import Button from '@mui/material/Button';
import React, {useRef, useState} from 'react';

function App() {
  const [disableUpload, setDisableUpload] = useState(true);
  const uploadRef = useRef<HTMLInputElement>(null);

  async function uploadFile() {
    if (uploadRef?.current?.files) {
      const file = uploadRef.current.files[0];
  
      const formData = new FormData();
      formData.append('file', file);
  
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const blob = await response.blob(); // if you expect a Blob (PDF) as the response
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'output.pdf'); // or any other filename you want
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        console.error('There was a problem with the fetch operation: ', error);
      }
    }
  }
  

  return (
    <>
      <Button 
        variant="contained"
        disabled={disableUpload}
        onClick={uploadFile}
      >
        Upload
      </Button>
      <input type="file" onChange={() => {if (uploadRef && uploadRef.current && uploadRef.current.files) setDisableUpload(false)}} ref={uploadRef} accept=".txt"/>
      <br/><br/>
      <Button variant="contained">Download PDF</Button>
      <Button variant="contained">Print</Button>
    </>
  );
}

export default App;
