import Button from '@mui/material/Button';
import React, {useRef, useState} from 'react';

function App() {
  const [disableUpload, setDisableUpload] = useState(true);
  const uploadRef = useRef<HTMLInputElement>(null);

  function uploadFile() {
    if (uploadRef?.current?.files) {
      const file = uploadRef.current.files[0];
      
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
